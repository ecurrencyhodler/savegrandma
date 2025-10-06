// Gmail Content Script for SaveGrandma Extension
const { emailAnalysisCache, cleanupCache, needsAnalysis, cacheAnalysis } = require('../../common/cache.js');
const { executeWithLock } = require('../../common/locking.js');
const { 
  unifiedStats, 
  sessionStats, 
  persistentStats, 
  extensionStats,
  resetSessionStats, 
  updateStatsUnified, 
  batchPopupNotification,
  updateLegacyStats
} = require('../../common/stats/index.js');
const { 
  emailWhitelist,
  isWhitelisted,
  isWhitelistAtCapacity,
  addToWhitelist,
  getWhitelistSize,
  getAllWhitelistedEmails
} = require('../../common/whitelist/index.js');
const {
  loadStats,
  saveStatsUnified,
  saveWhitelist,
  loadWhitelist,
  captureInitialState,
  getGmailAccountId,
  isChromeContextValid
} = require('../../common/storage/index.js');
const { messaging, ChromeAPI } = require('../../common/chromeApi/index.js');
const {
  EMAIL_ROW_SELECTORS,
  EMAIL_SELECTORS,
  findElements,
  extractEmailData,
  isElementVisible,
  waitForElement,
  addVisualStyles
} = require('../../common/domUtils/index.js');

console.log('SaveGrandma: Gmail content script loading...');

// Expose debug object to global scope for testing
window.SaveGrandmaDebug = null; // Will be set after SaveGrandmaDebug is defined

// Debug tracking object
const SaveGrandmaDebug = {
  status: 'loading',
  emailRows: [],
  openedEmails: [],
  errors: [],
  scanSummary: {
    totalEmailsScanned: 0,
    threatsIdentified: 0,
    scanStartTime: null,
    scanEndTime: null,
    isScanActive: false,
    lastEmailProcessedTime: null
  },
  
  log: function(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
      // Format data as readable string to avoid prototype display
      try {
        const cleanData = JSON.parse(JSON.stringify(data));
        console.log(`[${timestamp}] SaveGrandma: ${message}`);
        console.log(JSON.stringify(cleanData, null, 2));
      } catch (e) {
        // If serialization fails, just log the message without data
        console.log(`[${timestamp}] SaveGrandma: ${message}`);
      }
    } else {
      console.log(`[${timestamp}] SaveGrandma: ${message}`);
    }
  },
  
  error: function(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] SaveGrandma ERROR: ${message}`, error || '');
    this.errors.push({ timestamp, message, error });
  },
  
  updateStatus: function(newStatus) {
    this.status = newStatus;
    this.log(`Status changed to: ${newStatus}`);
  },
  
  // Expose analysis function for debugging
  analyzeEmailForPhishing: analyzeEmailForPhishing,
  checkDisplayNameMismatch: checkDisplayNameMismatch,
  extractEmailData: extractEmailData,
  
  // Save failure management functions
  getSaveFailureCounts: function() {
    try {
      const { saveFailureCount } = require('../../common/storage/saveStatsUnified');
      const { saveFailureCount: whitelistSaveFailureCount } = require('../../common/storage/saveWhitelist');
      return {
        stats: saveFailureCount?.stats || 0,
        whitelist: whitelistSaveFailureCount?.whitelist || 0,
        maxFailures: 3 // MAX_SAVE_FAILURES
      };
    } catch (error) {
      this.error('Error getting save failure counts', error);
      return {
        stats: 0,
        whitelist: 0,
        maxFailures: 3
      };
    }
  },
  
  resetSaveFailureCounts: function() {
    try {
      const { saveFailureCount } = require('../../common/storage/saveStatsUnified');
      const { saveFailureCount: whitelistSaveFailureCount } = require('../../common/storage/saveWhitelist');
      
      if (saveFailureCount) saveFailureCount.stats = 0;
      if (whitelistSaveFailureCount) whitelistSaveFailureCount.whitelist = 0;
      
      this.log('🔄 Save failure counts reset to 0', {
        stats: saveFailureCount?.stats || 0,
        whitelist: whitelistSaveFailureCount?.whitelist || 0
      });
      
      // Trigger immediate save of accumulated data
      this.triggerRecoverySave();
    } catch (error) {
      this.error('Error resetting save failure counts', error);
    }
  },
  
  // Trigger immediate save when context recovers
  triggerRecoverySave: async function() {
    try {
      this.log('🔄 Triggering recovery save of accumulated data...');
      
      // Flush any pending batched updates
      const { flushPendingUpdates } = require('../../common/stats/batchingConfig');
      const { saveStatsUnified } = require('../../common/storage');
      
      if (batchSaveTimeout) {
        clearTimeout(batchSaveTimeout);
        batchSaveTimeout = null;
      }
      
      await flushPendingUpdates(saveStatsUnified);
      
      // Also save current unified stats
      await saveStatsUnified(unifiedStats);
      
      this.log('✅ Recovery save completed successfully');
      return true;
    } catch (error) {
      this.error('Failed to trigger recovery save', error);
      return false;
    }
  },
  
  // Debug function to check whitelist state
  debugWhitelistState: function() {
    const failureCounts = this.getSaveFailureCounts();
    const isContextValid = require('../../common/storage/isChromeContextValid')();
    
    this.log('🔍 Whitelist Debug State:', {
      whitelistSize: emailWhitelist.size,
      contextValid: isContextValid,
      saveFailureCounts: failureCounts,
      whitelistContents: [...emailWhitelist]
    });
    
    return {
      whitelistSize: emailWhitelist.size,
      contextValid: isContextValid,
      saveFailureCounts: failureCounts,
      whitelistContents: [...emailWhitelist]
    };
  },
  
  // Test function to force add an email to whitelist (bypasses change detection)
  testAddToWhitelist: async function(email) {
    try {
      this.log(`🧪 Testing whitelist add for: ${email}`);
      
      // Add to whitelist directly
      emailWhitelist.add(email.toLowerCase());
      persistentStats.emailsWhitelisted = emailWhitelist.size;
      updateLegacyStats();
      
      this.log(`✅ Added ${email} to whitelist, size now: ${emailWhitelist.size}`);
      
      // Try to save directly
      const unifiedStatsForSave = { persistent: persistentStats };
      const saveResult = await saveWhitelist(emailWhitelist, unifiedStatsForSave);
      
      this.log(`💾 Save result: ${saveResult}`);
      return saveResult;
      
    } catch (error) {
      this.error('Test whitelist add failed:', error);
      return false;
    }
  },
  
  generateScanReport: async function() {
    // Only count emailRows (opened emails are already included in emailRows)
    const totalEmails = this.emailRows.length;
    
    // Fix scan duration calculation
    let scanDuration = 0;
    if (this.scanSummary.scanStartTime && this.scanSummary.scanEndTime) {
      const startTime = new Date(this.scanSummary.scanStartTime).getTime();
      const endTime = new Date(this.scanSummary.scanEndTime).getTime();
      scanDuration = (endTime - startTime) / 1000;
      
      // Sanity check - if duration seems too long, use session start time instead
      if (scanDuration > 3600) { // More than 1 hour seems suspicious
        const sessionStartTime = new Date(sessionStats.sessionStartTime).getTime();
        scanDuration = (endTime - sessionStartTime) / 1000;
      }
    } else if (this.scanSummary.lastEmailProcessedTime && sessionStats.sessionStartTime) {
      // Fallback: use session start time to last email processed time
      const sessionStartTime = new Date(sessionStats.sessionStartTime).getTime();
      const lastEmailTime = new Date(this.scanSummary.lastEmailProcessedTime).getTime();
      scanDuration = (lastEmailTime - sessionStartTime) / 1000;
    }
    
    // Update session stats (threats are already counted via updateStatsUnified)
    unifiedStats.session.emailsScanned = totalEmails;
    unifiedStats.session.threatsIdentified = this.scanSummary.threatsIdentified;
    
    // Update persistent stats timestamp
    unifiedStats.persistent.lastUpdated = Date.now();
    
    // Update legacy extensionStats for compatibility
    updateLegacyStats();
    
    // Flush any pending batched updates before final save
    if (batchSaveTimeout) {
      clearTimeout(batchSaveTimeout);
      await flushPendingUpdates(saveStatsUnified);
    }
    
    // Save stats at the end of scan (important: this is end-of-scan save)
    await saveStatsUnified(unifiedStats);
    this.log('✅ Stats saved at end of scan');
      
    // Send ONE updateStats message with final scan results
    batchPopupNotification();
      
    // Perform cleanup after scan completion (only if we've processed many emails)
    if (totalEmails > 20) {
      setTimeout(() => {
        performStorageCleanup().then(cleaned => {
          if (cleaned > 0) {
            this.log(`🧹 Post-scan cleanup completed: ${cleaned} items cleaned`);
          }
        });
      }, 5000); // Cleanup 5 seconds after scan completion
    }
    
    console.log('\n📊 === SAVEGRANDMA SCAN REPORT ===');
    console.log(`📧 Emails scanned this session: ${totalEmails}`);
    console.log(`🚨 Threats identified this session: ${this.scanSummary.threatsIdentified}`);
    console.log(`🚨 Total threats ever found: ${unifiedStats.persistent.totalThreatsEverFound}`);
    console.log(`⏱️  Scan duration: ${scanDuration.toFixed(2)} seconds`);
    console.log(`📈 Email rows processed: ${this.emailRows.length}`);
    console.log(`📖 Opened emails processed: ${this.openedEmails.length}`);
    console.log(`❌ Errors encountered: ${this.errors.length}`);
    
    if (this.scanSummary.threatsIdentified === 0) {
      console.log('✅ No threats detected - all emails appear safe');
    } else {
      console.log(`⚠️  ${this.scanSummary.threatsIdentified} potential threats detected this session`);
    }
    
    console.log('=== END SCAN REPORT ===\n');
    
    return {
      totalEmailsScanned: totalEmails,
      threatsIdentified: this.scanSummary.threatsIdentified,
      scanDuration: scanDuration,
      emailRows: this.emailRows.length,
      openedEmails: this.openedEmails.length,
      errors: this.errors.length
    };
  },
  
  checkScanComplete: async function() {
    const now = new Date();
    const timeSinceLastEmail = this.scanSummary.lastEmailProcessedTime ? 
      (now - this.scanSummary.lastEmailProcessedTime) / 1000 : 0;
    
    // Consider scan complete if no emails processed for 2 seconds
    if (this.scanSummary.isScanActive && timeSinceLastEmail >= 2 && this.emailRows.length > 0) {
      this.scanSummary.isScanActive = false;
      this.scanSummary.scanEndTime = now;
      this.log('Scan finalized - generating report...');
      await this.generateScanReport();
    }
  },
  
  // Check if context has recovered and reset failure counts if needed
  checkContextRecovery: async function() {
    try {
      const isChromeContextValid = require('../../common/storage/isChromeContextValid');
      const failureCounts = this.getSaveFailureCounts();
      
      // Check if we have failures and context is now valid
      if ((failureCounts.stats > 0 || failureCounts.whitelist > 0) && isChromeContextValid()) {
        this.log('🔄 Context recovery detected - resetting save failure counts', failureCounts);
        
        // Reset failure counts
        const { saveFailureCount } = require('../../common/storage/saveStatsUnified');
        const { saveFailureCount: whitelistSaveFailureCount } = require('../../common/storage/saveWhitelist');
        
        saveFailureCount.stats = 0;
        whitelistSaveFailureCount.whitelist = 0;
        
        // Trigger immediate save of accumulated data
        const recoverySuccess = await this.triggerRecoverySave();
        
        if (recoverySuccess) {
          this.log('✅ Context recovery completed - saves are now working again');
        } else {
          this.log('⚠️ Context recovery attempted but save failed');
        }
      }
    } catch (error) {
      this.error('Error during context recovery check', error);
    }
  }
};

// Helper function to add email to whitelist with proper dependencies
async function addEmailToWhitelist(senderEmail) {
  try {
    console.log('🔍 addEmailToWhitelist called with:', { 
      senderEmail, 
      whitelistSize: emailWhitelist.size,
      contextValid: isChromeContextValid()
    });
    
    const result = await addToWhitelist(
      senderEmail,
      updateStatsUnified,
      saveWhitelist,
      updateLegacyStats,
      persistentStats
    );
    
    console.log('🔍 addEmailToWhitelist result:', result);
    return result;
  } catch (error) {
    SaveGrandmaDebug.error('Error adding email to whitelist', error);
    return false;
  }
}

// Expose debug object to global scope
window.SaveGrandmaDebug = SaveGrandmaDebug;

// Batch save state
let batchSaveTimeout = null;

/**
 * Check display name mismatch between sender name and email
 */
function checkDisplayNameMismatch(displayName, senderEmail, replyToEmail) {
  if (!displayName || !senderEmail) return false;
  
  const senderParts = senderEmail.split('@');
  const senderFront = senderParts[0]?.toLowerCase();
  const senderDomain = senderParts[1]?.toLowerCase();
  
  const displayLower = displayName.toLowerCase();
  
  // Extract company name from domain (e.g., "cline" from "cline.bot", "dupr" from "pb.dupr.com")
  const getCompanyNameFromDomain = (domain) => {
    if (!domain) return '';
    const parts = domain.split('.');
    
    // If domain has 3+ parts (like pb.dupr.com), take the second part (dupr)
    // If domain has 2 parts (like dupr.com), take the first part (dupr)
    if (parts.length >= 3) {
      return parts[1] || '';
    } else {
      return parts[0] || '';
    }
  };
  
  // Normalize strings by removing spaces, hyphens, and special characters
  const normalizeString = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  
  // Check if two strings have significant overlap (for partial matches)
  const hasSignificantOverlap = (str1, str2, minLength = 4) => {
    if (!str1 || !str2 || str1.length < minLength || str2.length < minLength) return false;
    
    // Check if one string contains a significant portion of the other
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    // Check if the shorter string appears in the longer one
    if (longer.includes(shorter)) return true;
    
    // Check for partial matches (at least 4 characters overlap)
    for (let i = 0; i <= shorter.length - minLength; i++) {
      const substring = shorter.substring(i, i + minLength);
      if (longer.includes(substring)) return true;
    }
    
    return false;
  };
  
  // Enhanced fuzzy matching for names
  const hasFuzzyNameMatch = (displayName, emailPrefix) => {
    const display = displayName.toLowerCase().replace(/[^a-z\s]/g, '');
    const prefix = emailPrefix.toLowerCase();
    
    // Extract first and last names
    const nameParts = display.split(/\s+/).filter(part => part.length > 0);
    
    // Check if email prefix matches any name part
    for (const namePart of nameParts) {
      // Exact match
      if (namePart === prefix) return true;
      
      // Check if prefix is a shortened version of the name (e.g., "aragatz" from "alan ragatz")
      if (namePart.startsWith(prefix) && prefix.length >= 3) return true;
      if (prefix.startsWith(namePart) && namePart.length >= 3) return true;
      
      // Check for common name abbreviations (e.g., "alan" -> "aragatz" with first letter match)
      if (namePart.length >= 3 && prefix.length >= 3 && 
          namePart[0] === prefix[0] && 
          Math.abs(namePart.length - prefix.length) <= 3) {
        return true;
      }
      
      // Check for significant character overlap (at least 60% of shorter string)
      // Use a more sophisticated approach that doesn't double-count characters
      const shorter = namePart.length < prefix.length ? namePart : prefix;
      const longer = namePart.length >= prefix.length ? namePart : prefix;
      
      // Count unique characters that appear in both strings
      const shorterChars = new Set(shorter);
      const longerChars = new Set(longer);
      let matchingChars = 0;
      
      for (const char of shorterChars) {
        if (longerChars.has(char)) {
          matchingChars++;
        }
      }
      
      // Require higher threshold and more characters to match
      const overlapThreshold = Math.max(0.7, Math.ceil(shorter.length * 0.6) / shorter.length);
      if (matchingChars >= Math.ceil(shorter.length * overlapThreshold) && matchingChars >= 4) {
        return true;
      }
    }
    
    return false;
  };
  
  // Check if display name matches sender
  const senderCompanyName = getCompanyNameFromDomain(senderDomain);
  const normalizedDisplay = normalizeString(displayName);
  const normalizedSenderCompany = normalizeString(senderCompanyName);
  const normalizedSenderFront = normalizeString(senderFront);
  
  // Original exact matching logic
  const hasExactMatch = displayLower.includes(senderFront) || 
      displayLower.includes(senderDomain) || 
      (senderCompanyName && displayLower.includes(senderCompanyName)) ||
      (normalizedSenderCompany && normalizedDisplay.includes(normalizedSenderCompany)) ||
      (normalizedSenderCompany && normalizedSenderCompany.includes(normalizedDisplay)) ||
      (normalizedSenderFront && normalizedDisplay.includes(normalizedSenderFront)) ||
      (normalizedSenderFront && normalizedSenderFront.includes(normalizedDisplay)) ||
      hasSignificantOverlap(normalizedDisplay, normalizedSenderCompany) ||
      hasSignificantOverlap(normalizedDisplay, normalizedSenderFront);
  
  // Enhanced fuzzy matching for names
  const hasFuzzyMatch = hasFuzzyNameMatch(displayName, senderFront);
  
  if (hasExactMatch || hasFuzzyMatch) {
    return false; // No mismatch
  }
  
  // Check reply-to if different from sender
  if (replyToEmail && replyToEmail !== senderEmail) {
    const replyToParts = replyToEmail.split('@');
    const replyToFront = replyToParts[0]?.toLowerCase();
    const replyToDomain = replyToParts[1]?.toLowerCase();
    const replyToCompanyName = getCompanyNameFromDomain(replyToDomain);
    const normalizedReplyToCompany = normalizeString(replyToCompanyName);
    const normalizedReplyToFront = normalizeString(replyToFront);
    
    // Check for matches in both directions
    const hasReplyToExactMatch = displayLower.includes(replyToFront) || 
        displayLower.includes(replyToDomain) || 
        (replyToCompanyName && displayLower.includes(replyToCompanyName)) ||
        (normalizedReplyToCompany && normalizedDisplay.includes(normalizedReplyToCompany)) ||
        (normalizedReplyToCompany && normalizedReplyToCompany.includes(normalizedDisplay)) ||
        (normalizedReplyToFront && normalizedDisplay.includes(normalizedReplyToFront)) ||
        (normalizedReplyToFront && normalizedReplyToFront.includes(normalizedDisplay)) ||
        hasSignificantOverlap(normalizedDisplay, normalizedReplyToCompany) ||
        hasSignificantOverlap(normalizedDisplay, normalizedReplyToFront);
    
    const hasReplyToFuzzyMatch = hasFuzzyNameMatch(displayName, replyToFront);
    
    if (hasReplyToExactMatch || hasReplyToFuzzyMatch) {
      return false; // No mismatch
    }
  }
  
  return true; // Mismatch detected
}

/**
 * Analyze email for phishing indicators
 */
function analyzeEmailForPhishing(emailData) {
  SaveGrandmaDebug.log('🔍 Analyzing email for phishing indicators...', {
    senderName: emailData.senderName,
    senderEmail: emailData.senderEmail,
    subject: emailData.subject,
    replyToAddress: emailData.replyToAddress,
    hasBody: !!emailData.body,
    snippetLength: emailData.snippet?.length || 0
  });
  
  // Check if sender is whitelisted
  if (isWhitelisted(emailData.senderEmail)) {
    SaveGrandmaDebug.log('✅ Email sender is whitelisted - skipping analysis', {
      senderEmail: emailData.senderEmail
    });
    return {
      score: 0,
      isPhishing: false,
      indicators: [],
      whitelisted: true
    };
  }
  
  let phishingScore = 0;
  const indicators = [];
  
  // 1. Display name mismatch detection (+3 points)
  if (emailData.senderName && emailData.senderEmail) {
    const displayNameMismatch = checkDisplayNameMismatch(
      emailData.senderName, 
      emailData.senderEmail, 
      emailData.replyToAddress
    );
    
    if (displayNameMismatch) {
      phishingScore += 3;
      indicators.push({
        type: 'display_name_mismatch',
        weight: 3,
        value: `Display: "${emailData.senderName}" vs Sender: "${emailData.senderEmail}"`,
        description: 'Display name does not match sender email address'
      });
    }
  }
  
  // 2. No sender name (+1 point)
  if (!emailData.senderName || emailData.senderName.trim() === '') {
    phishingScore += 1;
    indicators.push({
      type: 'no_sender_name',
      weight: 1,
      value: 'No display name provided',
      description: 'Email has no sender display name'
    });
  }
  
  // 3. Financial terms commonly used in phishing (+1 point)
  const financialTermsPatterns = [
    /overdue|past due|late payment|collection/i,
    /wire transfer|money transfer|bank transfer/i,
    /gift card|prepaid card|voucher|coupon/i,
    /credit score|credit report|credit monitoring/i,
    /loan|mortgage|debt consolidation/i,
    /investment|trading|forex|cryptocurrency|investment opportunity/i,
    /ico|token|token sale|nft|mint|seed|seed phrase|wallet/i,
    /send/i,
    /disbursement|airdrop|cash prize/i,
    /\bssa\b/i
  ];
  
  const bodyText = emailData.body || '';
  const snippetText = emailData.snippet || '';
  const subjectText = emailData.subject || '';
  const bodySnippetText = bodyText || snippetText;
  
  // Check body/snippet for financial terms
  if (bodySnippetText.length > 0) {
    const financialMatches = financialTermsPatterns.filter(pattern => pattern.test(bodySnippetText));
    if (financialMatches.length >= 2) { // Multiple financial terms
      phishingScore += 1;
      indicators.push({
        type: 'financial_terms',
        weight: 1,
        value: `${financialMatches.length} financial terms detected`,
        description: 'Email content contains multiple financial terms commonly used in phishing'
      });
    }
  }
  
  // Check subject for financial terms
  if (subjectText.length > 0) {
    const subjectFinancialMatches = financialTermsPatterns.filter(pattern => pattern.test(subjectText));
    if (subjectFinancialMatches.length >= 1) { // Single financial term in subject is suspicious
      phishingScore += 1;
      indicators.push({
        type: 'financial_terms_subject',
        weight: 1,
        value: subjectFinancialMatches.map(p => subjectText.match(p)[0]).join(', '),
        description: 'Subject line contains financial terms commonly used in phishing'
      });
    }
  }
  
  // 4. Generic greeting detection (+2 points)
  const genericGreetingPatterns = [
    /dear user|dear customer|dear valued customer/i,
    /hello user|hello customer/i,
    /dear account holder|dear member/i,
    /dear sir\/madam|to whom it may concern/i,
    /dear client|dear subscriber/i,
    /greetings user|greetings customer/i
  ];
  
  if (bodySnippetText.length > 0) {
    const genericGreetingMatches = genericGreetingPatterns.filter(pattern => pattern.test(bodySnippetText));
    if (genericGreetingMatches.length >= 1) {
      phishingScore += 2;
      indicators.push({
        type: 'generic_greeting',
        weight: 2,
        value: genericGreetingMatches.map(p => bodySnippetText.match(p)[0]).join(', '),
        description: 'Email uses generic, impersonal greetings commonly found in phishing'
      });
    }
  }
  
  // 5. Urgency indicators (+1 point)
  const urgencyPatterns = [
    /urgent|asap|immediately|act now|limited time|expires/i,
    /verify|confirm|validate|update|suspended|locked/i,
    /click here|click below|follow this link/i
  ];
  
  const urgencyMatches = urgencyPatterns.filter(pattern => pattern.test(bodySnippetText) || pattern.test(subjectText));
  if (urgencyMatches.length >= 2) {
    phishingScore += 1;
    indicators.push({
      type: 'urgency_indicators',
      weight: 1,
      value: `${urgencyMatches.length} urgency indicators`,
      description: 'Email contains multiple urgency indicators commonly used in phishing'
    });
  }
  
  // 6. Suspicious sender domain (+2 points)
  if (emailData.senderEmail) {
    const domain = emailData.senderEmail.split('@')[1]?.toLowerCase();
    if (domain) {
      // Check for suspicious domains
      const suspiciousDomains = [
        /^[a-z0-9.-]+\.tk$/i, // .tk domains
        /^[a-z0-9.-]+\.ml$/i, // .ml domains
        /^[a-z0-9.-]+\.ga$/i, // .ga domains
        /^[a-z0-9.-]+\.cf$/i, // .cf domains
        /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ // IP addresses
      ];
      
      if (suspiciousDomains.some(pattern => pattern.test(domain))) {
        phishingScore += 2;
        indicators.push({
          type: 'suspicious_domain',
          weight: 2,
          value: `Suspicious domain: ${domain}`,
          description: 'Email sender uses a suspicious domain'
        });
      }
    }
  }
  
  // Determine if email is phishing based on score
  const isPhishing = phishingScore >= 3;
  
  SaveGrandmaDebug.log(`📊 Phishing analysis complete: score=${phishingScore}, isPhishing=${isPhishing}`, {
    indicators: indicators.length,
    score: phishingScore
  });
  
  return {
    score: phishingScore,
    isPhishing: isPhishing,
    indicators: indicators,
    whitelisted: false
  };
}

/**
 * Show phishing popup to user
 */
function showPhishingPopup(analysis, emailData) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.savegrandma-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'savegrandma-popup';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'savegrandma-popup-header';
  
  const title = document.createElement('div');
  title.className = 'savegrandma-popup-title';
  title.textContent = 'Suspicious Email Detected';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'savegrandma-popup-close';
  closeButton.innerHTML = '×';
  closeButton.onclick = () => popup.remove();
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create content
  const content = document.createElement('div');
  content.className = 'savegrandma-popup-content';
  
  // Add score
  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'savegrandma-popup-score';
  scoreDiv.textContent = `Suspicious Score: ${analysis.score}/10`;
  content.appendChild(scoreDiv);
  
  // Add email details
  const emailDetails = document.createElement('div');
  emailDetails.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong>From:</strong> ${emailData.senderName || 'Unknown'} &lt;${emailData.senderEmail || 'Unknown'}&gt;<br>
      <strong>Subject:</strong> ${emailData.subject || 'No subject'}
    </div>
  `;
  content.appendChild(emailDetails);
  
  // Add indicators
  if (analysis.indicators && analysis.indicators.length > 0) {
    const indicatorsDiv = document.createElement('div');
    indicatorsDiv.className = 'savegrandma-popup-indicators';
    
    const indicatorsTitle = document.createElement('div');
    indicatorsTitle.style.fontWeight = 'bold';
    indicatorsTitle.style.marginBottom = '8px';
    indicatorsTitle.textContent = 'Suspicious Indicators:';
    indicatorsDiv.appendChild(indicatorsTitle);
    
    analysis.indicators.forEach(indicator => {
      const indicatorDiv = document.createElement('div');
      indicatorDiv.className = 'savegrandma-popup-indicator';
      
      const title = document.createElement('div');
      title.className = 'savegrandma-popup-indicator-title';
      title.textContent = `${indicator.type.replace(/_/g, ' ').toUpperCase()} (+${indicator.weight} points)`;
      
      const description = document.createElement('div');
      description.className = 'savegrandma-popup-indicator-description';
      description.textContent = indicator.description;
      
      const value = document.createElement('div');
      value.className = 'savegrandma-popup-indicator-value';
      value.textContent = `Details: ${indicator.value}`;
      
      indicatorDiv.appendChild(title);
      indicatorDiv.appendChild(description);
      indicatorDiv.appendChild(value);
      indicatorsDiv.appendChild(indicatorDiv);
    });
    
    content.appendChild(indicatorsDiv);
  }
  
  // Add warning message
  const warningDiv = document.createElement('div');
  warningDiv.className = 'savegrandma-popup-warning';
  warningDiv.innerHTML = `
    <strong>Warning:</strong> This email has been flagged as potentially suspicious. 
    Be cautious about clicking links, downloading attachments, or providing personal information.
  `;
  content.appendChild(warningDiv);
  
  // Add whitelist status information
  const statusDiv = document.createElement('div');
  statusDiv.style.marginTop = '12px';
  statusDiv.style.textAlign = 'center';
  statusDiv.style.fontSize = '12px';
  statusDiv.style.color = '#6c757d';
  
  const currentCount = emailWhitelist.size;
  const maxCount = 10000; // MAX_WHITELIST_SIZE
  const isAtCapacity = currentCount >= maxCount;
  
  statusDiv.innerHTML = `
    <div style="margin-bottom: 8px;">
      Whitelist: ${currentCount.toLocaleString()} / ${maxCount.toLocaleString()} emails
    </div>
    ${isAtCapacity ? 
      '<div style="color: #dc3545; font-weight: bold;">⚠️ Whitelist is full!</div>' : 
      '<div style="color: #28a745;">✓ Space available</div>'
    }
  `;
  
  content.appendChild(statusDiv);
  
  // Add "Mark as Safe" button
  const markSafeButton = document.createElement('button');
  const isWhitelistFull = currentCount >= maxCount;
  
  if (isWhitelistFull) {
    // Button is disabled when whitelist is at capacity
    markSafeButton.textContent = 'Mark as Safe';
    markSafeButton.disabled = true;
    
    // Add tooltip for disabled state
    markSafeButton.title = 'Whitelist limit has been reached! Manage the whitelist in the menu';
  } else {
    // Normal enabled button
    markSafeButton.textContent = 'Mark as Safe';
    
    markSafeButton.onclick = async () => {
      if (emailData.senderEmail) {
        try {
          const success = await addEmailToWhitelist(emailData.senderEmail);
          
          if (success) {
            // Update button to show success
            markSafeButton.textContent = '✓ Added to Whitelist';
            markSafeButton.disabled = true;
            
            // Immediately remove warning icons for this sender
            removeWarningIconsForWhitelistedEmails();
            
            SaveGrandmaDebug.log('✅ User marked email as safe', {
              senderEmail: emailData.senderEmail,
              senderName: emailData.senderName
            });
            
            // Notify popup of whitelist change
            try {
              messaging.sendMessageToBackground({
                action: 'whitelistUpdated',
                data: {
                  action: 'add',
                  email: emailData.senderEmail,
                  whitelistSize: emailWhitelist.size
                }
              }).catch(error => {
                console.log('Could not notify popup of whitelist change:', error);
              });
            } catch (error) {
              console.log('Error notifying popup of whitelist change:', error);
            }
          } else {
            // Failed to add (shouldn't happen with capacity check, but just in case)
            markSafeButton.textContent = 'Failed to Add';
            markSafeButton.style.backgroundColor = '#dc3545';
            setTimeout(() => {
              markSafeButton.textContent = 'Mark as Safe';
              markSafeButton.style.backgroundColor = '#28a745';
            }, 2000);
          }
        } catch (error) {
          SaveGrandmaDebug.error('Error adding email to whitelist', error);
          markSafeButton.textContent = 'Error - Try Again';
          markSafeButton.style.backgroundColor = '#dc3545';
          setTimeout(() => {
            markSafeButton.textContent = 'Mark as Safe';
            markSafeButton.style.backgroundColor = '#28a745';
          }, 2000);
        }
      }
    };
  }
  
  content.appendChild(markSafeButton);
  
  // Assemble popup
  popup.appendChild(header);
  popup.appendChild(content);
  
  // Add to page
  document.body.appendChild(popup);
  
  // Add click-outside-to-close functionality
  const handleClickOutside = (event) => {
    if (!popup.contains(event.target)) {
      popup.remove();
      document.removeEventListener('click', handleClickOutside);
    }
  };
  
  // Add the event listener after a small delay to prevent immediate closure
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 100);
  
  SaveGrandmaDebug.log('Phishing popup displayed', {
    score: analysis.score,
    indicators: analysis.indicators.length
  });
}

/**
 * Remove warning icons from emails with whitelisted senders
 */
function removeWarningIconsForWhitelistedEmails() {
  const emailRows = findElements(EMAIL_ROW_SELECTORS);
  let iconsRemoved = 0;
  
  console.log(`🔍 Checking ${emailRows.length} email rows for whitelisted senders to remove warning icons`);
  
  emailRows.forEach(row => {
    try {
      // Get thread ID for this email row
      const threadIdEl = row.querySelector('[data-legacy-thread-id]');
      if (!threadIdEl) return;
      
      const threadId = threadIdEl.getAttribute('data-legacy-thread-id');
      if (!threadId) return;
      
      // Check if we have analysis data for this thread
      const cachedData = emailAnalysisCache.get(threadId);
      if (!cachedData) return;
      
      // Check if sender is whitelisted
      if (isWhitelisted(cachedData.emailData.senderEmail)) {
        console.log(`✅ Found whitelisted sender: ${cachedData.emailData.senderEmail}, removing warning icon`);
        // Find and remove the warning icon
        const subjectElement = row.querySelector('.y6') || row.querySelector('.bog');
        if (subjectElement) {
          const warningIcon = subjectElement.querySelector('.savegrandma-warning-icon');
          if (warningIcon) {
            // Remove the warning icon and restore original subject text
            const subjectContainer = subjectElement.querySelector('.savegrandma-subject-container');
            if (subjectContainer) {
              // Get the text content without the warning icon
              // Clone the container and remove the warning icon to get clean text
              const cleanContainer = subjectContainer.cloneNode(true);
              const iconToRemove = cleanContainer.querySelector('.savegrandma-warning-icon');
              if (iconToRemove) {
                iconToRemove.remove();
              }
              const cleanText = cleanContainer.textContent.trim();
              subjectElement.innerHTML = cleanText;
              iconsRemoved++;
            }
          }
        }
      }
    } catch (error) {
      SaveGrandmaDebug.error('Error removing warning icon', error);
    }
  });
  
  if (iconsRemoved > 0) {
    SaveGrandmaDebug.log(`🗑️ Removed ${iconsRemoved} warning icons for whitelisted emails`);
  }
}

/**
 * Add visual indicator to email row
 */
function addVisualIndicator(element, isPhishing, analysis = null, emailData = null, isNewEmail = false) {
  if (!element || !isPhishing) {
    return; // No element or not phishing, skip visual indicator
  }
  
  try {
    // Find the subject element within the email row
    const subjectElement = element.querySelector('.y6') || element.querySelector('.bog');
    
    if (subjectElement) {
      // Check if warning icon already exists
      if (subjectElement.querySelector('.savegrandma-warning-icon')) {
        return; // Already has warning icon
      }
      
      // Store analysis data for this email (using thread ID as key)
      if (emailData && emailData.threadId && analysis) {
        emailAnalysisCache.set(emailData.threadId, {
          analysis: analysis,
          emailData: emailData,
          subject: emailData.subject,
          senderEmail: emailData.senderEmail,
          timestamp: Date.now()
        });
        
        // Proactive cache cleanup if cache is getting large
        if (emailAnalysisCache.size > 250) { // CACHE_FORCE_CLEANUP_THRESHOLD
          cleanupCache();
        }
      }
      
      // Create warning icon
      const warningIcon = document.createElement('span');
      warningIcon.className = 'savegrandma-warning-icon';
      warningIcon.textContent = '⚠️';
      warningIcon.title = 'Click to see why this email is suspicious';
      
      // Add click handler to show popup
      warningIcon.onclick = (e) => {
        e.stopPropagation(); // Prevent email from opening
        if (analysis && emailData) {
          showPhishingPopup(analysis, emailData);
        }
      };
      
      // Wrap the subject text in a container
      const subjectContainer = document.createElement('div');
      subjectContainer.className = 'savegrandma-subject-container';
      
      // Move the subject text into the container
      const subjectText = subjectElement.textContent;
      const textNode = document.createTextNode(' ' + subjectText);
      subjectContainer.appendChild(warningIcon);
      subjectContainer.appendChild(textNode);
      
      // Replace the subject element content
      subjectElement.innerHTML = '';
      subjectElement.appendChild(subjectContainer);
      
      SaveGrandmaDebug.log('⚠️ Visual warning icon added to email subject', {
        subject: subjectText,
        element: element,
        clickable: true,
        threadId: emailData?.threadId
      });
      
      // Update threat statistics when a phishing email is detected (only for new emails)
      if (analysis && analysis.isPhishing && isNewEmail) {
        updateStatsUnified('threatsIdentified');
        SaveGrandmaDebug.scanSummary.threatsIdentified++;
        SaveGrandmaDebug.log('🚨 Threat detected and counted in stats', {
          senderEmail: emailData?.senderEmail,
          subject: emailData?.subject,
          threadId: emailData?.threadId,
          totalThreatsThisSession: SaveGrandmaDebug.scanSummary.threatsIdentified
        });
      }
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error adding visual indicator', error);
  }
}

/**
 * Process individual email row
 */
async function processEmailRow(element) {
  if (!element || SaveGrandmaDebug.emailRows.find(row => row.element === element)) {
    return false; // Already processed
  }
  
  try {
    const emailData = extractEmailData(element);
    
    // Debug logging for specific thread ID
    if (emailData.threadId === "199a8d4a8168bdca") {
      SaveGrandmaDebug.log('🔍 DEBUG: Processing Ledger email', {
        extractedData: emailData,
        elementClasses: element.className,
        elementTag: element.tagName
      });
    }
    
    if (emailData.senderEmail || emailData.subject) {
      // Check if this email was already processed (deduplication by threadId)
      const alreadyProcessed = SaveGrandmaDebug.emailRows.find(
        existing => existing.emailData.threadId && existing.emailData.threadId === emailData.threadId
      );
      
      if (!alreadyProcessed) {
        // New email - add to tracking and increment counter
        SaveGrandmaDebug.emailRows.push({
          element: element,
          emailData: emailData,
          processedAt: new Date()
        });
        
        // Update scan tracking
        SaveGrandmaDebug.scanSummary.isScanActive = true;
        SaveGrandmaDebug.scanSummary.lastEmailProcessedTime = new Date();
        
        // Initialize scan start time if this is the first email
        if (!SaveGrandmaDebug.scanSummary.scanStartTime) {
          SaveGrandmaDebug.scanSummary.scanStartTime = new Date();
        }
        
        await updateStatsUnified('emailsScanned');
        
        SaveGrandmaDebug.log('📧 Email row processed (SNIPPET ONLY)', {
          senderName: emailData.senderName,
          senderEmail: emailData.senderEmail,
          subject: emailData.subject,
          snippetLength: emailData.snippet?.length || 0,
          snippetPreview: emailData.snippet?.substring(0, 100) + '...',
          threadId: emailData.threadId,
          totalRows: SaveGrandmaDebug.emailRows.length
        });
      } else {
        // Already processed - just update the element reference in case DOM changed
        alreadyProcessed.element = element;
        SaveGrandmaDebug.log('📧 Email row already processed, updating element reference', {
          threadId: emailData.threadId
        });
      }
      
      // Check if email needs analysis (not in cache or expired)
      // This runs regardless of whether it's a duplicate, in case we need to re-add icons
      if (needsAnalysis(emailData.threadId)) {
        // Analyze for phishing with visual indicators (new email - count in stats)
        const analysis = analyzeEmailForPhishing(emailData);
        addVisualIndicator(element, analysis.isPhishing, analysis, emailData, true); // true = isNewEmail
        
        // Store analysis data in the row object for later use
        const rowIndex = SaveGrandmaDebug.emailRows.findIndex(
          row => row.emailData.threadId === emailData.threadId
        );
        if (rowIndex !== -1) {
          SaveGrandmaDebug.emailRows[rowIndex].analysis = analysis;
        }
      } else {
        // Re-add icon from cache, but check whitelist first (cached email - don't count in stats)
        const cachedData = emailAnalysisCache.get(emailData.threadId);
        if (cachedData && cachedData.analysis.isPhishing) {
          // Check if sender is now whitelisted
          if (!isWhitelisted(cachedData.emailData.senderEmail)) {
            addVisualIndicator(element, true, cachedData.analysis, cachedData.emailData, false); // false = isNewEmail
          }
          // If whitelisted, don't add the icon (it will be removed)
        }
        
        // Store cached analysis data in the row object for later use
        if (cachedData) {
          const rowIndex = SaveGrandmaDebug.emailRows.findIndex(
            row => row.emailData.threadId === emailData.threadId
          );
          if (rowIndex !== -1) {
            SaveGrandmaDebug.emailRows[rowIndex].analysis = cachedData.analysis;
          }
        }
      }
      
      // Check if scan is complete (will trigger report if no more emails for 2 seconds)
      setTimeout(async () => {
        await SaveGrandmaDebug.checkScanComplete();
      }, 2100); // Check 2.1 seconds after last email
      
      return true; // Successfully processed
    }
    
    return false; // No email data found
  } catch (error) {
    SaveGrandmaDebug.error('Error processing email row', error);
    return false; // Failed to process
  }
}

/**
 * Initialize DOM monitoring
 */
async function initializeDOMMonitoring() {
  SaveGrandmaDebug.updateStatus('initializing');
  SaveGrandmaDebug.log('Setting up DOM monitoring...');
  
  try {
    // Add visual styles
    addVisualStyles();
    
    // Process existing email rows
    const existingRows = findElements(EMAIL_ROW_SELECTORS);
    SaveGrandmaDebug.log(`Found ${existingRows.length} existing email rows`);
    
    // Process each row and track results
    let processedCount = 0;
    let skippedCount = 0;
    for (let i = 0; i < existingRows.length; i++) {
      try {
        const wasProcessed = await processEmailRow(existingRows[i]);
        if (wasProcessed) {
          processedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        SaveGrandmaDebug.error('Error processing email row during initialization', error);
        skippedCount++;
      }
    }
    
    SaveGrandmaDebug.log(`Initial scan complete: ${processedCount} processed, ${skippedCount} skipped`);
    
    // Set up mutation observer for new emails
    const observer = new MutationObserver(async (mutations) => {
      let hasSignificantChanges = false;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            // Check if it's an email row
            for (const selector of EMAIL_ROW_SELECTORS) {
              if (node.classList && node.classList.contains(selector.replace('.', ''))) {
                await processEmailRow(node);
                hasSignificantChanges = true;
                break;
              }
            }
            
            // Check for email rows within the added node
            const emailRows = findElements(EMAIL_ROW_SELECTORS);
            for (let i = 0; i < emailRows.length; i++) {
              const row = emailRows[i];
              if (!SaveGrandmaDebug.emailRows.find(existing => existing.element === row)) {
                const wasProcessed = await processEmailRow(row);
                if (wasProcessed) {
                  hasSignificantChanges = true;
                }
              }
            }
          }
        }
      }
      
      // If significant changes detected, re-add warning icons for existing emails
      if (hasSignificantChanges) {
        setTimeout(() => {
          reAddWarningIcons();
        }, 500); // Small delay to let DOM settle
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Listen for email opening (click events)
    document.addEventListener('click', (event) => {
      const emailRow = event.target.closest('.zA') || event.target.closest('tr[role="button"]');
      if (emailRow) {
        // Email row clicked, wait for email to open
        setTimeout(() => {
          processOpenedEmail();
        }, 1000);
      }
    });
    
    // Listen for URL changes (Gmail navigation)
    let currentUrl = window.location.href;
    const urlObserver = new MutationObserver(async () => {
      if (window.location.href !== currentUrl) {
        // Flush any pending batched updates before navigation
        if (batchSaveTimeout) {
          clearTimeout(batchSaveTimeout);
          await flushPendingUpdates(saveStatsUnified);
        }
        
        // Save stats before navigating away
        const saveSuccess = await saveStatsUnified(unifiedStats);
        if (saveSuccess) {
          SaveGrandmaDebug.log('✅ Stats saved before URL change');
        } else {
          SaveGrandmaDebug.error('Failed to save stats before URL change');
        }
        
        currentUrl = window.location.href;
        SaveGrandmaDebug.log('Gmail navigation detected', { url: currentUrl });
        
        // Process any new emails that appeared and re-add warning icons
        setTimeout(async () => {
          const newRows = findElements(EMAIL_ROW_SELECTORS);
          let newProcessedCount = 0;
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            if (!SaveGrandmaDebug.emailRows.find(existing => existing.element === row)) {
              const wasProcessed = await processEmailRow(row);
              if (wasProcessed) {
                newProcessedCount++;
              }
            }
          }
          
          if (newProcessedCount > 0) {
            SaveGrandmaDebug.log(`📧 Processed ${newProcessedCount} new emails after navigation`);
          }
          
          // Re-add warning icons for emails that were previously flagged
          reAddWarningIcons();
        }, 1000);
      }
    });
    
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Periodic scan completion check
    setInterval(() => {
      SaveGrandmaDebug.checkScanComplete();
    }, 3000);
    
    // Periodic context recovery check (every 30 seconds)
    setInterval(() => {
      SaveGrandmaDebug.checkContextRecovery();
    }, 30000);
    
    SaveGrandmaDebug.updateStatus('active');
    SaveGrandmaDebug.log('✅ DOM monitoring initialized successfully');
    
  } catch (error) {
    SaveGrandmaDebug.error('Failed to initialize DOM monitoring', error);
    SaveGrandmaDebug.updateStatus('error');
  }
}

/**
 * Re-add warning icons for previously analyzed emails
 */
function reAddWarningIcons() {
  SaveGrandmaDebug.emailRows.forEach(row => {
    if (row.element && row.element.isConnected && row.analysis) {
      // Check if indicator still exists
      const existingIndicator = row.element.querySelector('.savegrandma-warning-icon, .savegrandma-safe-icon');
      if (!existingIndicator) {
        // Re-add the indicator (cached email - don't count in stats)
        addVisualIndicator(row.element, row.analysis.isPhishing, row.analysis, row.emailData, false);
      }
    }
  });
}

/**
 * Process opened email (when user clicks on an email)
 */
function processOpenedEmail() {
  // This would handle analysis of opened emails
  // For now, just log that an email was opened
  SaveGrandmaDebug.log('📖 Email opened');
}

/**
 * Perform storage cleanup
 */
async function performStorageCleanup() {
  try {
    // Clean up cache
    cleanupCache();
    
    // Other cleanup tasks could go here
    
    return 0; // Return number of items cleaned
  } catch (error) {
    SaveGrandmaDebug.error('Error during storage cleanup', error);
    return 0;
  }
}

/**
 * Set up message listener for whitelist updates from popup
 */
function setupWhitelistMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.action === 'whitelistUpdated') {
      console.log('Handling whitelist update in content script:', message.data);
      
      if (message.data.action === 'clear') {
        // Store the previously whitelisted emails before clearing
        const previouslyWhitelistedEmails = new Set(emailWhitelist);
        
        // Clear the in-memory whitelist
        emailWhitelist.clear();
        persistentStats.emailsWhitelisted = 0;
        updateLegacyStats();
        
        // For "Clear all", we need to restore warning icons for all previously whitelisted emails
        // that were genuinely suspicious, rather than removing all warning icons
        restoreWarningIconsForClearedWhitelist(previouslyWhitelistedEmails);
        
        console.log('✅ Content script whitelist cleared, size:', emailWhitelist.size);
        console.log('🔍 Processing warning icon restoration for previously whitelisted emails:', previouslyWhitelistedEmails.size);
        
        sendResponse({ success: true });
        return true;
      } else if (message.data.action === 'add') {
        // Add email to in-memory whitelist
        emailWhitelist.add(message.data.email);
        persistentStats.emailsWhitelisted = emailWhitelist.size;
        updateLegacyStats();
        
        // Remove warning icons for this specific sender
        removeWarningIconsForWhitelistedEmails();
        
        console.log(`✅ Content script added ${message.data.email} to whitelist, size: ${emailWhitelist.size}`);
        
        sendResponse({ success: true });
        return true;
      } else if (message.data.action === 'remove') {
        // Remove email from in-memory whitelist
        emailWhitelist.delete(message.data.email);
        persistentStats.emailsWhitelisted = emailWhitelist.size;
        updateLegacyStats();
        
        // Restore warning icons for emails from this sender that were previously suspicious
        restoreWarningIconsForRemovedEmail(message.data.email);
        
        console.log(`✅ Content script removed ${message.data.email} from whitelist, size: ${emailWhitelist.size}`);
        
        sendResponse({ success: true });
        return true;
      }
    }
    
    sendResponse({ success: false, error: 'Unknown action' });
    return true;
  });
  
  console.log('Content script message listener set up');
}

/**
 * Remove all warning icons from the page
 */
function removeAllWarningIcons() {
  const warningIcons = document.querySelectorAll('.savegrandma-warning-icon');
  let iconsRemoved = 0;
  
  warningIcons.forEach(icon => {
    try {
      const subjectElement = icon.closest('.y6') || icon.closest('.bog');
      if (subjectElement) {
        const subjectContainer = subjectElement.querySelector('.savegrandma-subject-container');
        if (subjectContainer) {
          // Get clean text without the warning icon
          const cleanContainer = subjectContainer.cloneNode(true);
          const iconToRemove = cleanContainer.querySelector('.savegrandma-warning-icon');
          if (iconToRemove) {
            iconToRemove.remove();
          }
          const cleanText = cleanContainer.textContent.trim();
          subjectElement.innerHTML = cleanText;
          iconsRemoved++;
        }
      }
    } catch (error) {
      console.error('Error removing warning icon:', error);
    }
  });
  
  if (iconsRemoved > 0) {
    console.log(`🗑️ Removed ${iconsRemoved} warning icons from all emails`);
  }
}

/**
 * Remove warning icons only for emails from specific senders
 */
function removeWarningIconsForSpecificEmails(targetEmails) {
  const emailRows = findElements(EMAIL_ROW_SELECTORS);
  let iconsRemoved = 0;
  
  console.log(`🔍 Checking ${emailRows.length} email rows for specific emails to remove warning icons`);
  console.log('Target emails:', [...targetEmails]);
  
  emailRows.forEach(row => {
    try {
      // Get thread ID for this email row
      const threadIdEl = row.querySelector('[data-legacy-thread-id]');
      if (!threadIdEl) return;
      
      const threadId = threadIdEl.getAttribute('data-legacy-thread-id');
      if (!threadId) return;
      
      // Check if we have analysis data for this thread
      const cachedData = emailAnalysisCache.get(threadId);
      if (!cachedData) return;
      
      // Check if sender is in the target emails list
      if (targetEmails.has(cachedData.emailData.senderEmail)) {
        console.log(`✅ Found target email: ${cachedData.emailData.senderEmail}, removing warning icon`);
        // Find and remove the warning icon
        const subjectElement = row.querySelector('.y6') || row.querySelector('.bog');
        if (subjectElement) {
          const warningIcon = subjectElement.querySelector('.savegrandma-warning-icon');
          if (warningIcon) {
            // Remove the warning icon and restore original subject text
            const subjectContainer = subjectElement.querySelector('.savegrandma-subject-container');
            if (subjectContainer) {
              // Get the text content without the warning icon
              // Clone the container and remove the warning icon to get clean text
              const cleanContainer = subjectContainer.cloneNode(true);
              const iconToRemove = cleanContainer.querySelector('.savegrandma-warning-icon');
              if (iconToRemove) {
                iconToRemove.remove();
              }
              const cleanText = cleanContainer.textContent.trim();
              subjectElement.innerHTML = cleanText;
              iconsRemoved++;
            }
          }
        }
      }
    } catch (error) {
      SaveGrandmaDebug.error('Error removing warning icon for specific email', error);
    }
  });
  
  if (iconsRemoved > 0) {
    SaveGrandmaDebug.log(`🗑️ Removed ${iconsRemoved} warning icons for specific emails`);
  }
}

/**
 * Restore warning icons for emails from a specific sender that was removed from whitelist
 */
function restoreWarningIconsForRemovedEmail(removedEmail) {
  const emailRows = findElements(EMAIL_ROW_SELECTORS);
  let iconsRestored = 0;
  
  console.log(`🔍 Restoring warning icons for emails from: ${removedEmail}`);
  console.log(`🔍 Checking ${emailRows.length} email rows`);
  
  emailRows.forEach(row => {
    try {
      // Get thread ID for this email row
      const threadIdEl = row.querySelector('[data-legacy-thread-id]');
      if (!threadIdEl) return;
      
      const threadId = threadIdEl.getAttribute('data-legacy-thread-id');
      if (!threadId) return;
      
      // Check if we have analysis data for this thread
      const cachedData = emailAnalysisCache.get(threadId);
      if (!cachedData) return;
      
      // Check if this email is from the removed sender and was previously flagged as suspicious
      if (cachedData.emailData.senderEmail === removedEmail && 
          cachedData.analysis && 
          cachedData.analysis.isPhishing) {
        
        console.log(`✅ Found suspicious email from removed sender: ${removedEmail}, restoring warning icon`);
        
        // Check if warning icon already exists
        const subjectElement = row.querySelector('.y6') || row.querySelector('.bog');
        if (subjectElement) {
          const existingIcon = subjectElement.querySelector('.savegrandma-warning-icon');
          if (!existingIcon) {
            // Re-add the warning icon using the cached analysis data
            addVisualIndicator(row, true, cachedData.analysis, cachedData.emailData, false); // false = not a new email
            iconsRestored++;
          } else {
            console.log(`⚠️ Warning icon already exists for email from ${removedEmail}`);
          }
        }
      }
    } catch (error) {
      SaveGrandmaDebug.error('Error restoring warning icon for removed email', error);
    }
  });
  
  if (iconsRestored > 0) {
    SaveGrandmaDebug.log(`🔔 Restored ${iconsRestored} warning icons for emails from removed sender: ${removedEmail}`);
  } else {
    console.log(`ℹ️ No warning icons needed to be restored for: ${removedEmail}`);
  }
}

/**
 * Restore warning icons for all emails that were previously whitelisted when whitelist is cleared
 */
function restoreWarningIconsForClearedWhitelist(previouslyWhitelistedEmails) {
  const emailRows = findElements(EMAIL_ROW_SELECTORS);
  let iconsRestored = 0;
  let emailsProcessed = 0;
  
  console.log(`🔍 Restoring warning icons for cleared whitelist`);
  console.log(`🔍 Previously whitelisted emails:`, [...previouslyWhitelistedEmails]);
  console.log(`🔍 Checking ${emailRows.length} email rows`);
  
  emailRows.forEach(row => {
    try {
      // Get thread ID for this email row
      const threadIdEl = row.querySelector('[data-legacy-thread-id]');
      if (!threadIdEl) return;
      
      const threadId = threadIdEl.getAttribute('data-legacy-thread-id');
      if (!threadId) return;
      
      // Check if we have analysis data for this thread
      const cachedData = emailAnalysisCache.get(threadId);
      if (!cachedData) return;
      
      // Check if this email was previously whitelisted and was genuinely suspicious
      if (previouslyWhitelistedEmails.has(cachedData.emailData.senderEmail) && 
          cachedData.analysis && 
          cachedData.analysis.isPhishing) {
        
        emailsProcessed++;
        console.log(`✅ Found previously whitelisted suspicious email: ${cachedData.emailData.senderEmail}, restoring warning icon`);
        
        // Check if warning icon already exists
        const subjectElement = row.querySelector('.y6') || row.querySelector('.bog');
        if (subjectElement) {
          const existingIcon = subjectElement.querySelector('.savegrandma-warning-icon');
          if (!existingIcon) {
            // Re-add the warning icon using the cached analysis data
            addVisualIndicator(row, true, cachedData.analysis, cachedData.emailData, false); // false = not a new email
            iconsRestored++;
          } else {
            console.log(`⚠️ Warning icon already exists for email from ${cachedData.emailData.senderEmail}`);
          }
        }
      }
    } catch (error) {
      SaveGrandmaDebug.error('Error restoring warning icon for cleared whitelist', error);
    }
  });
  
  if (iconsRestored > 0) {
    SaveGrandmaDebug.log(`🔔 Restored ${iconsRestored} warning icons for previously whitelisted emails (${emailsProcessed} emails processed)`);
  } else {
    console.log(`ℹ️ No warning icons needed to be restored for cleared whitelist (${emailsProcessed} emails processed)`);
  }
}

/**
 * Initialize the content script
 */
async function initialize() {
  try {
    SaveGrandmaDebug.updateStatus('loading');
    
    // Load stats and whitelist
    await loadStats(unifiedStats, persistentStats, resetSessionStats);
    await loadWhitelist(emailWhitelist, persistentStats, updateLegacyStats);
    
    // Capture initial state for change tracking
    captureInitialState(unifiedStats, emailWhitelist);
    
    // Initialize DOM monitoring
    await initializeDOMMonitoring();
    
    SaveGrandmaDebug.updateStatus('ready');
    SaveGrandmaDebug.log('✅ SaveGrandma content script initialized successfully');
    
    // Set up message listener for whitelist updates from popup
    setupWhitelistMessageListener();
    
  } catch (error) {
    SaveGrandmaDebug.error('Failed to initialize content script', error);
    SaveGrandmaDebug.updateStatus('error');
  }
}

// Start the content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
