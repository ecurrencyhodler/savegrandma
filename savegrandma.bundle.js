/******/ (() => { // webpackBootstrap
/*!****************************!*\
  !*** ./src/savegrandma.js ***!
  \****************************/
// SaveGrandma Chrome Extension - DOM-based approach
// Privacy-focused implementation without external dependencies

console.log('SaveGrandma: Extension loading (DOM-based approach)...');

// Cache management constants
const MAX_CACHE_SIZE = 200;
const CACHE_EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours

// Whitelist management constants
const MAX_WHITELIST_SIZE = 10000;

// Store analysis data for emails so we can re-add icons after DOM changes
const emailAnalysisCache = new Map();

// Whitelist storage - emails marked as safe by user
let emailWhitelist = new Set();

// Statistics tracking
let extensionStats = {
  totalEmailsScanned: 0,
  threatsIdentified: 0,
  emailsWhitelisted: 0,
  lastUpdated: Date.now()
};

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
  log: function (message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] SaveGrandma: ${message}`, data || '');
  },
  error: function (message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] SaveGrandma ERROR: ${message}`, error || '');
    this.errors.push({
      timestamp,
      message,
      error
    });
  },
  updateStatus: function (newStatus) {
    this.status = newStatus;
    this.log(`Status changed to: ${newStatus}`);
  },
  generateScanReport: function () {
    const totalEmails = this.emailRows.length + this.openedEmails.length;
    const scanDuration = this.scanSummary.scanEndTime ? (this.scanSummary.scanEndTime - this.scanSummary.scanStartTime) / 1000 : 0;

    // Sync with extension stats
    extensionStats.totalEmailsScanned = totalEmails;
    extensionStats.threatsIdentified = this.scanSummary.threatsIdentified;
    saveStats();
    console.log('\n📊 === SAVEGRANDMA SCAN REPORT ===');
    console.log(`📧 Total emails scanned: ${totalEmails}`);
    console.log(`🚨 Threats identified: ${this.scanSummary.threatsIdentified}`);
    console.log(`⏱️  Scan duration: ${scanDuration.toFixed(2)} seconds`);
    console.log(`📈 Email rows processed: ${this.emailRows.length}`);
    console.log(`📖 Opened emails processed: ${this.openedEmails.length}`);
    console.log(`❌ Errors encountered: ${this.errors.length}`);
    if (this.scanSummary.threatsIdentified === 0) {
      console.log('✅ No threats detected - all emails appear safe');
    } else {
      console.log(`⚠️  ${this.scanSummary.threatsIdentified} potential threats detected`);
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
  checkScanComplete: function () {
    const now = new Date();
    const timeSinceLastEmail = this.scanSummary.lastEmailProcessedTime ? (now - this.scanSummary.lastEmailProcessedTime) / 1000 : 0;

    // Consider scan complete if no emails processed for 2 seconds
    if (this.scanSummary.isScanActive && timeSinceLastEmail >= 2 && this.emailRows.length > 0) {
      this.scanSummary.isScanActive = false;
      this.scanSummary.scanEndTime = now;
      this.log('Scan finalized - generating report...');
      this.generateScanReport();
    }
  }
};

// Email row selectors (multiple fallbacks for robustness)
const EMAIL_ROW_SELECTORS = ['.zA',
// Primary Gmail email row class (50 elements found)
'tr[role="button"]',
// Alternative selector
'div[role="main"] tr',
// Main content area rows (52 elements found)
'[data-legacy-thread-id]' // Data attribute based (100 elements found)
];

// Email content selectors (based on your exploration results)
const EMAIL_SELECTORS = {
  sender: ['.yP', '[email]'],
  // .yP found 124 elements, [email] found 112 elements
  subject: ['.y6', '.bog'],
  // Both found 50 elements each
  snippet: ['.y2'],
  // Found 50 elements
  body: ['.ii', '.adP'],
  threadId: ['[data-legacy-thread-id]'],
  // Found 100 elements
  messageId: ['[data-message-id]']
};

// Find elements using multiple selectors
function findElements(selectors) {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return elements;
      }
    } catch (e) {
      // Invalid selector, try next
      continue;
    }
  }
  return [];
}

// Cache management functions
function cleanupCache() {
  const now = Date.now();
  let removedCount = 0;

  // Remove expired entries
  for (const [threadId, data] of emailAnalysisCache) {
    if (now - data.timestamp > CACHE_EXPIRY_TIME) {
      emailAnalysisCache.delete(threadId);
      removedCount++;
    }
  }

  // Remove oldest entries if cache is still too large
  if (emailAnalysisCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(emailAnalysisCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp

    const toRemove = entries.slice(0, emailAnalysisCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([threadId]) => {
      emailAnalysisCache.delete(threadId);
      removedCount++;
    });
  }
  if (removedCount > 0) {
    SaveGrandmaDebug.log(`🧹 Cache cleanup: removed ${removedCount} entries, ${emailAnalysisCache.size} remaining`);
  }
}

// Check if email needs to be analyzed (not in cache or expired)
function needsAnalysis(threadId) {
  if (!threadId) return true;
  const cachedData = emailAnalysisCache.get(threadId);
  if (!cachedData) return true;

  // Check if cache entry is expired
  const now = Date.now();
  if (now - cachedData.timestamp > CACHE_EXPIRY_TIME) {
    emailAnalysisCache.delete(threadId);
    return true;
  }
  return false;
}

// Statistics management functions
function loadStats() {
  try {
    const stored = localStorage.getItem('savegrandma_stats');
    if (stored) {
      const parsedStats = JSON.parse(stored);
      extensionStats = {
        ...extensionStats,
        ...parsedStats
      };
      SaveGrandmaDebug.log(`📊 Loaded stats: ${extensionStats.totalEmailsScanned} emails, ${extensionStats.threatsIdentified} threats`);
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error loading stats', error);
  }
}
function saveStats() {
  try {
    extensionStats.lastUpdated = Date.now();
    localStorage.setItem('savegrandma_stats', JSON.stringify(extensionStats));
    SaveGrandmaDebug.log(`💾 Saved stats: ${extensionStats.totalEmailsScanned} emails, ${extensionStats.threatsIdentified} threats`);
  } catch (error) {
    SaveGrandmaDebug.error('Error saving stats', error);
  }
}
function updateStats(type, increment = 1) {
  if (extensionStats.hasOwnProperty(type)) {
    extensionStats[type] += increment;
    saveStats();
  }
}

// Whitelist management functions
function loadWhitelist() {
  try {
    const stored = localStorage.getItem('savegrandma_whitelist');
    if (stored) {
      emailWhitelist = new Set(JSON.parse(stored));
      extensionStats.emailsWhitelisted = emailWhitelist.size;
      SaveGrandmaDebug.log(`📋 Loaded whitelist with ${emailWhitelist.size} entries`);
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error loading whitelist', error);
    emailWhitelist = new Set();
  }
}
function saveWhitelist() {
  try {
    localStorage.setItem('savegrandma_whitelist', JSON.stringify([...emailWhitelist]));
    SaveGrandmaDebug.log(`💾 Saved whitelist with ${emailWhitelist.size} entries`);
  } catch (error) {
    SaveGrandmaDebug.error('Error saving whitelist', error);
  }
}
function addToWhitelist(senderEmail) {
  if (!senderEmail) return false;

  // Check if whitelist is at capacity
  if (emailWhitelist.size >= MAX_WHITELIST_SIZE) {
    SaveGrandmaDebug.log(`❌ Cannot add ${senderEmail} to whitelist - limit of ${MAX_WHITELIST_SIZE} reached`);
    return false;
  }
  emailWhitelist.add(senderEmail.toLowerCase());
  extensionStats.emailsWhitelisted = emailWhitelist.size;
  saveWhitelist();
  saveStats();
  SaveGrandmaDebug.log(`✅ Added ${senderEmail} to whitelist`);
  return true;
}
function removeFromWhitelist(senderEmail) {
  if (!senderEmail) return false;
  const removed = emailWhitelist.delete(senderEmail.toLowerCase());
  if (removed) {
    extensionStats.emailsWhitelisted = emailWhitelist.size;
    saveWhitelist();
    saveStats();
    SaveGrandmaDebug.log(`❌ Removed ${senderEmail} from whitelist`);
  }
  return removed;
}
function isWhitelisted(senderEmail) {
  if (!senderEmail) return false;
  return emailWhitelist.has(senderEmail.toLowerCase());
}
function isWhitelistAtCapacity() {
  return emailWhitelist.size >= MAX_WHITELIST_SIZE;
}

// Extract email data from DOM element
function extractEmailData(element) {
  const emailData = {
    threadId: null,
    messageId: null,
    senderName: null,
    senderEmail: null,
    subject: null,
    snippet: null,
    body: null,
    replyToAddress: null,
    timestamp: new Date().toISOString()
  };
  try {
    // Find thread ID
    const threadIdEl = element.querySelector('[data-legacy-thread-id]');
    if (threadIdEl) {
      emailData.threadId = threadIdEl.getAttribute('data-legacy-thread-id');
    }

    // Find message ID
    const messageIdEl = element.querySelector('[data-message-id]');
    if (messageIdEl) {
      emailData.messageId = messageIdEl.getAttribute('data-message-id');
    }

    // Find sender name and email
    for (const selector of EMAIL_SELECTORS.sender) {
      const senderEl = element.querySelector(selector);
      if (senderEl) {
        var _senderEl$textContent;
        // Try to get email address from attribute first
        const emailAttr = senderEl.getAttribute('email');
        if (emailAttr) {
          emailData.senderEmail = emailAttr;
        }

        // Get sender name from text content
        const senderText = (_senderEl$textContent = senderEl.textContent) === null || _senderEl$textContent === void 0 ? void 0 : _senderEl$textContent.trim();
        if (senderText) {
          // If no email attribute, try to extract email from text
          if (!emailData.senderEmail && senderText.includes('@')) {
            const emailMatch = senderText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) {
              emailData.senderEmail = emailMatch[0];
              emailData.senderName = senderText.replace(emailMatch[0], '').trim();
            } else {
              emailData.senderName = senderText;
            }
          } else {
            emailData.senderName = senderText;
          }

          // Try to get full name from title attribute if text is truncated
          const titleAttr = senderEl.getAttribute('title');
          if (titleAttr && titleAttr.length > senderText.length) {
            emailData.senderName = titleAttr;
          }
        }
        break;
      }
    }

    // Find subject
    for (const selector of EMAIL_SELECTORS.subject) {
      const subjectEl = element.querySelector(selector);
      if (subjectEl) {
        var _subjectEl$textConten;
        emailData.subject = (_subjectEl$textConten = subjectEl.textContent) === null || _subjectEl$textConten === void 0 ? void 0 : _subjectEl$textConten.trim();
        break;
      }
    }

    // Enhanced snippet extraction - try to get as much content as possible from inbox view
    for (const selector of EMAIL_SELECTORS.snippet) {
      const snippetEl = element.querySelector(selector);
      if (snippetEl) {
        var _snippetEl$textConten;
        emailData.snippet = (_snippetEl$textConten = snippetEl.textContent) === null || _snippetEl$textConten === void 0 ? void 0 : _snippetEl$textConten.trim();
        break;
      }
    }

    // Try to get additional content from the email row itself
    if (!emailData.snippet || emailData.snippet.length < 50) {
      var _emailData$snippet;
      const rowText = element.innerText || element.textContent || '';
      if (rowText.length > (((_emailData$snippet = emailData.snippet) === null || _emailData$snippet === void 0 ? void 0 : _emailData$snippet.length) || 0)) {
        // Remove sender and subject from row text to get more snippet content
        let enhancedSnippet = rowText;
        if (emailData.senderName) {
          enhancedSnippet = enhancedSnippet.replace(emailData.senderName, '');
        }
        if (emailData.subject) {
          enhancedSnippet = enhancedSnippet.replace(emailData.subject, '');
        }
        emailData.snippet = enhancedSnippet.trim();
      }
    }

    // Find body (for opened emails only)
    for (const selector of EMAIL_SELECTORS.body) {
      const bodyEl = element.querySelector(selector);
      if (bodyEl) {
        var _bodyEl$textContent;
        emailData.body = (_bodyEl$textContent = bodyEl.textContent) === null || _bodyEl$textContent === void 0 ? void 0 : _bodyEl$textContent.trim();
        break;
      }
    }

    // Find reply-to address (look in email headers for opened emails)
    const replyToEl = element.querySelector('[name="Reply-To"]') || element.querySelector('meta[name="Reply-To"]') || element.querySelector('[data-reply-to]');
    if (replyToEl) {
      var _replyToEl$textConten;
      emailData.replyToAddress = replyToEl.getAttribute('content') || replyToEl.getAttribute('data-reply-to') || ((_replyToEl$textConten = replyToEl.textContent) === null || _replyToEl$textConten === void 0 ? void 0 : _replyToEl$textConten.trim());
    }

    // Additional email extraction from headers (for opened emails)
    if (element.closest('.ii') || element.closest('.adP')) {
      // This is an opened email, try to find more detailed header info
      const headerEl = element.closest('.hP') || element.querySelector('.hP');
      if (headerEl) {
        // Look for additional email addresses in headers
        const allLinks = headerEl.querySelectorAll('a[href^="mailto:"]');
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('mailto:')) {
            const email = href.replace('mailto:', '');
            if (!emailData.senderEmail) {
              emailData.senderEmail = email;
            } else if (email !== emailData.senderEmail && !emailData.replyToAddress) {
              emailData.replyToAddress = email;
            }
          }
        });
      }
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error extracting email data', error);
  }
  return emailData;
}

// Check display name mismatch
function checkDisplayNameMismatch(displayName, senderEmail, replyToEmail) {
  var _senderParts$, _senderParts$2;
  if (!displayName || !senderEmail) return false;
  const senderParts = senderEmail.split('@');
  const senderFront = (_senderParts$ = senderParts[0]) === null || _senderParts$ === void 0 ? void 0 : _senderParts$.toLowerCase();
  const senderDomain = (_senderParts$2 = senderParts[1]) === null || _senderParts$2 === void 0 ? void 0 : _senderParts$2.toLowerCase();
  const displayLower = displayName.toLowerCase();

  // Extract company name from domain (e.g., "cline" from "cline.bot", "dupr" from "pb.dupr.com")
  const getCompanyNameFromDomain = domain => {
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
  const normalizeString = str => {
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

  // Check if display name matches sender
  const senderCompanyName = getCompanyNameFromDomain(senderDomain);
  const normalizedDisplay = normalizeString(displayName);
  const normalizedSenderCompany = normalizeString(senderCompanyName);
  const normalizedSenderFront = normalizeString(senderFront);

  // Check for matches in both directions
  const hasMatch = displayLower.includes(senderFront) || displayLower.includes(senderDomain) || senderCompanyName && displayLower.includes(senderCompanyName) || normalizedSenderCompany && normalizedDisplay.includes(normalizedSenderCompany) || normalizedSenderCompany && normalizedSenderCompany.includes(normalizedDisplay) || normalizedSenderFront && normalizedDisplay.includes(normalizedSenderFront) || normalizedSenderFront && normalizedSenderFront.includes(normalizedDisplay) || hasSignificantOverlap(normalizedDisplay, normalizedSenderCompany) || hasSignificantOverlap(normalizedDisplay, normalizedSenderFront);
  if (hasMatch) {
    return false; // No mismatch
  }

  // Check reply-to if different from sender
  if (replyToEmail && replyToEmail !== senderEmail) {
    var _replyToParts$, _replyToParts$2;
    const replyToParts = replyToEmail.split('@');
    const replyToFront = (_replyToParts$ = replyToParts[0]) === null || _replyToParts$ === void 0 ? void 0 : _replyToParts$.toLowerCase();
    const replyToDomain = (_replyToParts$2 = replyToParts[1]) === null || _replyToParts$2 === void 0 ? void 0 : _replyToParts$2.toLowerCase();
    const replyToCompanyName = getCompanyNameFromDomain(replyToDomain);
    const normalizedReplyToCompany = normalizeString(replyToCompanyName);
    const normalizedReplyToFront = normalizeString(replyToFront);

    // Check for matches in both directions
    const hasReplyToMatch = displayLower.includes(replyToFront) || displayLower.includes(replyToDomain) || replyToCompanyName && displayLower.includes(replyToCompanyName) || normalizedReplyToCompany && normalizedDisplay.includes(normalizedReplyToCompany) || normalizedReplyToCompany && normalizedReplyToCompany.includes(normalizedDisplay) || normalizedReplyToFront && normalizedDisplay.includes(normalizedReplyToFront) || normalizedReplyToFront && normalizedReplyToFront.includes(normalizedDisplay) || hasSignificantOverlap(normalizedDisplay, normalizedReplyToCompany) || hasSignificantOverlap(normalizedDisplay, normalizedReplyToFront);
    if (hasReplyToMatch) {
      return false; // No mismatch
    }
  }
  return true; // Mismatch detected
}

// Analyze email for phishing indicators
function analyzeEmailForPhishing(emailData) {
  var _emailData$snippet2;
  SaveGrandmaDebug.log('🔍 Analyzing email for phishing indicators...', {
    senderName: emailData.senderName,
    senderEmail: emailData.senderEmail,
    subject: emailData.subject,
    replyToAddress: emailData.replyToAddress,
    hasBody: !!emailData.body,
    snippetLength: ((_emailData$snippet2 = emailData.snippet) === null || _emailData$snippet2 === void 0 ? void 0 : _emailData$snippet2.length) || 0
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
    const displayNameMismatch = checkDisplayNameMismatch(emailData.senderName, emailData.senderEmail, emailData.replyToAddress);
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
  const financialTermsPatterns = [/overdue|past due|late payment|collection/i, /wire transfer|money transfer|bank transfer/i, /gift card|prepaid card|voucher|coupon/i, /credit score|credit report|credit monitoring/i, /loan|mortgage|debt consolidation/i, /investment|trading|forex|cryptocurrency|investment opportunity/i, /ico|token|token sale|nft|mint|seed|seed phrase|wallet/i, /send/i, /disbursement|airdrop|cash prize/i, /\bssa\b/i];
  const bodyText = emailData.body || '';
  const snippetText = emailData.snippet || '';
  const subjectText = emailData.subject || '';
  const bodySnippetText = bodyText || snippetText;

  // Check body/snippet for financial terms
  if (bodySnippetText.length > 0) {
    const financialMatches = financialTermsPatterns.filter(pattern => pattern.test(bodySnippetText));
    if (financialMatches.length >= 2) {
      // Multiple financial terms
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
    if (subjectFinancialMatches.length >= 1) {
      // Single financial term in subject is suspicious
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
  const genericGreetingPatterns = [/dear user|dear customer|dear valued customer/i, /hello user|hello customer/i, /dear account holder|dear member/i, /dear sir\/madam|to whom it may concern/i, /dear client|dear subscriber/i, /greetings user|greetings customer/i];
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

  // Determine if email is flagged (3-point threshold)
  const isPhishing = phishingScore >= 3;

  // Track threats for summary report
  if (isPhishing) {
    SaveGrandmaDebug.scanSummary.threatsIdentified++;
    updateStats('threatsIdentified');
    SaveGrandmaDebug.log('🚨 SUSPICIOUS EMAIL DETECTED!', {
      score: phishingScore,
      indicators: indicators,
      emailData: {
        sender: emailData.senderEmail,
        subject: emailData.subject,
        hasFullBody: !!emailData.body
      }
    });
  }
  return {
    score: phishingScore,
    isPhishing: isPhishing,
    indicators: indicators
  };
}

// Show popup with phishing analysis details
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
  title.textContent = '⚠️ Suspicious Email Detected';
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
  warningDiv.style.marginTop = '16px';
  warningDiv.style.padding = '12px';
  warningDiv.style.backgroundColor = '#f8d7da';
  warningDiv.style.border = '1px solid #f5c6cb';
  warningDiv.style.borderRadius = '4px';
  warningDiv.style.color = '#721c24';
  warningDiv.innerHTML = `
    <strong>⚠️ Warning:</strong> This email has been flagged as potentially suspicious. 
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
  const maxCount = MAX_WHITELIST_SIZE;
  const isAtCapacity = currentCount >= maxCount;
  statusDiv.innerHTML = `
    <div style="margin-bottom: 8px;">
      Whitelist: ${currentCount.toLocaleString()} / ${maxCount.toLocaleString()} emails
    </div>
    ${isAtCapacity ? '<div style="color: #dc3545; font-weight: bold;">⚠️ Whitelist is full!</div>' : '<div style="color: #28a745;">✓ Space available</div>'}
  `;
  content.appendChild(statusDiv);

  // Add "Mark as Safe" button
  const buttonDiv = document.createElement('div');
  buttonDiv.style.marginTop = '8px';
  buttonDiv.style.textAlign = 'center';
  const markSafeButton = document.createElement('button');
  const isWhitelistFull = isWhitelistAtCapacity();
  if (isWhitelistFull) {
    // Button is disabled when whitelist is at capacity
    markSafeButton.textContent = 'Mark as Safe';
    markSafeButton.disabled = true;
    markSafeButton.style.backgroundColor = '#6c757d';
    markSafeButton.style.color = 'white';
    markSafeButton.style.border = 'none';
    markSafeButton.style.padding = '8px 16px';
    markSafeButton.style.borderRadius = '4px';
    markSafeButton.style.cursor = 'not-allowed';
    markSafeButton.style.fontSize = '14px';
    markSafeButton.style.fontWeight = 'bold';
    markSafeButton.style.opacity = '0.6';

    // Add tooltip for disabled state
    markSafeButton.title = 'Whitelist limit has been reached! Manage the whitelist in the menu';

    // No click handler for disabled button
  } else {
    // Normal enabled button
    markSafeButton.textContent = 'Mark as Safe';
    markSafeButton.style.backgroundColor = '#28a745';
    markSafeButton.style.color = 'white';
    markSafeButton.style.border = 'none';
    markSafeButton.style.padding = '8px 16px';
    markSafeButton.style.borderRadius = '4px';
    markSafeButton.style.cursor = 'pointer';
    markSafeButton.style.fontSize = '14px';
    markSafeButton.style.fontWeight = 'bold';
    markSafeButton.style.transition = 'background-color 0.2s ease';
    markSafeButton.onmouseover = () => {
      markSafeButton.style.backgroundColor = '#218838';
    };
    markSafeButton.onmouseout = () => {
      markSafeButton.style.backgroundColor = '#28a745';
    };
    markSafeButton.onclick = () => {
      if (emailData.senderEmail) {
        const success = addToWhitelist(emailData.senderEmail);
        if (success) {
          // Update button to show success
          markSafeButton.textContent = '✓ Added to Whitelist';
          markSafeButton.style.backgroundColor = '#6c757d';
          markSafeButton.disabled = true;
          SaveGrandmaDebug.log('✅ User marked email as safe', {
            senderEmail: emailData.senderEmail,
            senderName: emailData.senderName
          });
        } else {
          // Failed to add (shouldn't happen with capacity check, but just in case)
          markSafeButton.textContent = 'Failed to Add';
          markSafeButton.style.backgroundColor = '#dc3545';
          setTimeout(() => {
            markSafeButton.textContent = 'Mark as Safe';
            markSafeButton.style.backgroundColor = '#28a745';
          }, 2000);
        }
      }
    };
  }
  buttonDiv.appendChild(markSafeButton);
  content.appendChild(buttonDiv);

  // Assemble popup
  popup.appendChild(header);
  popup.appendChild(content);

  // Add to page
  document.body.appendChild(popup);

  // Add click-outside-to-close functionality
  const handleClickOutside = event => {
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

// Add visual indicator for phishing emails
function addVisualIndicator(element, isPhishing, analysis = null, emailData = null) {
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
      }

      // Create warning icon
      const warningIcon = document.createElement('span');
      warningIcon.className = 'savegrandma-warning-icon';
      warningIcon.title = 'Click to see why this email is suspicious';

      // Add click handler to show popup
      warningIcon.onclick = e => {
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
      const textNode = document.createTextNode(subjectText);
      subjectContainer.appendChild(warningIcon);
      subjectContainer.appendChild(textNode);

      // Replace the subject element content
      subjectElement.innerHTML = '';
      subjectElement.appendChild(subjectContainer);
      SaveGrandmaDebug.log('⚠️ Visual warning icon added to email subject', {
        subject: subjectText,
        element: element,
        clickable: true,
        threadId: emailData === null || emailData === void 0 ? void 0 : emailData.threadId
      });
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error adding visual indicator', error);
  }
}

// Re-add warning icons to emails that were previously flagged
function reAddWarningIcons() {
  const emailRows = findElements(EMAIL_ROW_SELECTORS);
  let iconsReAdded = 0;
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

      // Check if warning icon already exists
      const subjectElement = row.querySelector('.y6') || row.querySelector('.bog');
      if (!subjectElement || subjectElement.querySelector('.savegrandma-warning-icon')) {
        return; // Already has warning icon or no subject element
      }

      // Re-add the warning icon
      const warningIcon = document.createElement('span');
      warningIcon.className = 'savegrandma-warning-icon';
      warningIcon.title = 'Click to see why this email is suspicious';

      // Add click handler to show popup
      warningIcon.onclick = e => {
        e.stopPropagation(); // Prevent email from opening
        showPhishingPopup(cachedData.analysis, cachedData.emailData);
      };

      // Wrap the subject text in a container
      const subjectContainer = document.createElement('div');
      subjectContainer.className = 'savegrandma-subject-container';

      // Move the subject text into the container
      const subjectText = subjectElement.textContent;
      const textNode = document.createTextNode(subjectText);
      subjectContainer.appendChild(warningIcon);
      subjectContainer.appendChild(textNode);

      // Replace the subject element content
      subjectElement.innerHTML = '';
      subjectElement.appendChild(subjectContainer);
      iconsReAdded++;
    } catch (error) {
      SaveGrandmaDebug.error('Error re-adding warning icon', error);
    }
  });
  if (iconsReAdded > 0) {
    SaveGrandmaDebug.log(`🔄 Re-added ${iconsReAdded} warning icons after DOM changes`);
  }
}

// Process email row with rescan functionality
function processEmailRow(element) {
  try {
    const emailData = extractEmailData(element);
    if (emailData.sender || emailData.subject) {
      var _emailData$snippet3, _emailData$snippet4;
      SaveGrandmaDebug.emailRows.push({
        element: element,
        data: emailData
      });

      // Update scan tracking
      SaveGrandmaDebug.scanSummary.isScanActive = true;
      SaveGrandmaDebug.scanSummary.lastEmailProcessedTime = new Date();
      updateStats('totalEmailsScanned');
      SaveGrandmaDebug.log('📧 Email row processed (SNIPPET ONLY)', {
        senderName: emailData.senderName,
        senderEmail: emailData.senderEmail,
        subject: emailData.subject,
        snippetLength: ((_emailData$snippet3 = emailData.snippet) === null || _emailData$snippet3 === void 0 ? void 0 : _emailData$snippet3.length) || 0,
        snippetPreview: ((_emailData$snippet4 = emailData.snippet) === null || _emailData$snippet4 === void 0 ? void 0 : _emailData$snippet4.substring(0, 100)) + '...',
        threadId: emailData.threadId,
        totalRows: SaveGrandmaDebug.emailRows.length
      });

      // Check if email needs analysis (not in cache or expired)
      if (needsAnalysis(emailData.threadId)) {
        // Analyze for phishing with visual indicators
        const analysis = analyzeEmailForPhishing(emailData);
        addVisualIndicator(element, analysis.isPhishing, analysis, emailData);
      } else {
        // Re-add icon from cache
        const cachedData = emailAnalysisCache.get(emailData.threadId);
        if (cachedData && cachedData.analysis.isPhishing) {
          addVisualIndicator(element, true, cachedData.analysis, cachedData.emailData);
        }
      }

      // Check if scan is complete (will trigger report if no more emails for 2 seconds)
      setTimeout(() => {
        SaveGrandmaDebug.checkScanComplete();
      }, 2100); // Check 2.1 seconds after last email
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error processing email row', error);
  }
}

// Extract detailed email information from opened email view
function extractOpenedEmailData() {
  const emailData = {
    threadId: null,
    messageId: null,
    senderName: null,
    senderEmail: null,
    subject: null,
    snippet: null,
    body: null,
    replyToAddress: null,
    timestamp: new Date().toISOString()
  };
  try {
    // Find the main email container
    const emailContainer = document.querySelector('.ii') || document.querySelector('.adP');
    if (!emailContainer) return emailData;

    // Extract from email container
    const extractedData = extractEmailData(emailContainer);

    // Look for additional header information
    const headerContainer = document.querySelector('.hP') || document.querySelector('.gE');
    if (headerContainer) {
      // Find all mailto links in headers
      const mailtoLinks = headerContainer.querySelectorAll('a[href^="mailto:"]');
      mailtoLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          var _link$textContent;
          const email = href.replace('mailto:', '');
          const linkText = (_link$textContent = link.textContent) === null || _link$textContent === void 0 ? void 0 : _link$textContent.trim();
          if (!emailData.senderEmail) {
            emailData.senderEmail = email;
            emailData.senderName = linkText || email;
          } else if (email !== emailData.senderEmail && !emailData.replyToAddress) {
            emailData.replyToAddress = email;
          }
        }
      });

      // Look for subject in headers
      const subjectEl = headerContainer.querySelector('.bog') || headerContainer.querySelector('[data-legacy-thread-id]');
      if (subjectEl && !emailData.subject) {
        var _subjectEl$textConten2;
        emailData.subject = (_subjectEl$textConten2 = subjectEl.textContent) === null || _subjectEl$textConten2 === void 0 ? void 0 : _subjectEl$textConten2.trim();
      }
    }

    // Extract thread ID
    const threadIdEl = document.querySelector('[data-legacy-thread-id]');
    if (threadIdEl) {
      emailData.threadId = threadIdEl.getAttribute('data-legacy-thread-id');
    }

    // Extract message ID
    const messageIdEl = document.querySelector('[data-message-id]');
    if (messageIdEl) {
      emailData.messageId = messageIdEl.getAttribute('data-message-id');
    }

    // Get email body
    const bodyEl = emailContainer.querySelector('.adP') || emailContainer;
    if (bodyEl) {
      var _bodyEl$textContent2;
      emailData.body = (_bodyEl$textContent2 = bodyEl.textContent) === null || _bodyEl$textContent2 === void 0 ? void 0 : _bodyEl$textContent2.trim();
    }

    // Merge with extracted data from container
    return {
      ...emailData,
      ...extractedData
    };
  } catch (error) {
    SaveGrandmaDebug.error('Error extracting opened email data', error);
  }
  return emailData;
}

// Process opened email
function processOpenedEmail() {
  try {
    const emailData = extractOpenedEmailData();
    if (emailData.senderName || emailData.senderEmail || emailData.subject) {
      var _emailData$body, _emailData$body2;
      SaveGrandmaDebug.openedEmails.push({
        data: emailData
      });
      SaveGrandmaDebug.log('📧 Opened email processed - FULL BODY AVAILABLE', {
        senderName: emailData.senderName,
        senderEmail: emailData.senderEmail,
        subject: emailData.subject,
        replyToAddress: emailData.replyToAddress,
        bodyLength: ((_emailData$body = emailData.body) === null || _emailData$body === void 0 ? void 0 : _emailData$body.length) || 0,
        bodyPreview: ((_emailData$body2 = emailData.body) === null || _emailData$body2 === void 0 ? void 0 : _emailData$body2.substring(0, 200)) + '...',
        threadId: emailData.threadId,
        totalOpened: SaveGrandmaDebug.openedEmails.length
      });

      // Log the full body separately for easy viewing
      if (emailData.body) {
        SaveGrandmaDebug.log('📄 FULL EMAIL BODY:', emailData.body);
      }

      // Analyze for phishing (no visual indicators)
      const analysis = analyzeEmailForPhishing(emailData);
      addVisualIndicator(null, analysis.isPhishing);
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error processing opened email', error);
  }
}

// Initialize DOM monitoring
function initializeDOMMonitoring() {
  SaveGrandmaDebug.updateStatus('initializing');
  SaveGrandmaDebug.log('Setting up DOM monitoring...');
  try {
    // Process existing email rows
    const existingRows = findElements(EMAIL_ROW_SELECTORS);
    SaveGrandmaDebug.log(`Found ${existingRows.length} existing email rows`);
    existingRows.forEach(processEmailRow);

    // Set up mutation observer for new emails
    const observer = new MutationObserver(mutations => {
      let hasSignificantChanges = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            // Element node
            // Check if it's an email row
            for (const selector of EMAIL_ROW_SELECTORS) {
              if (node.classList && node.classList.contains(selector.replace('.', ''))) {
                processEmailRow(node);
                hasSignificantChanges = true;
                break;
              }
            }

            // Check for email rows within the added node
            const emailRows = findElements(EMAIL_ROW_SELECTORS);
            emailRows.forEach(row => {
              if (!SaveGrandmaDebug.emailRows.find(existing => existing.element === row)) {
                processEmailRow(row);
                hasSignificantChanges = true;
              }
            });
          }
        });
      });

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
    document.addEventListener('click', event => {
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
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        SaveGrandmaDebug.log('Gmail navigation detected', {
          url: currentUrl
        });

        // Process any new emails that appeared and re-add warning icons
        setTimeout(() => {
          const newRows = findElements(EMAIL_ROW_SELECTORS);
          newRows.forEach(row => {
            if (!SaveGrandmaDebug.emailRows.find(existing => existing.element === row)) {
              processEmailRow(row);
            }
          });

          // Re-add warning icons for emails that were previously flagged
          reAddWarningIcons();
        }, 1000);
      }
    });
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    SaveGrandmaDebug.updateStatus('initialized');
    SaveGrandmaDebug.log('DOM monitoring initialized successfully');

    // Add debug object to window
    window.SaveGrandmaDebug = SaveGrandmaDebug;

    // Add helper functions for debugging
    window.SaveGrandmaDebug.inspectCurrentEmail = function () {
      const emailData = extractOpenedEmailData();
      console.log('🔍 Current opened email data:', emailData);
      return emailData;
    };
    window.SaveGrandmaDebug.inspectAllEmails = function () {
      console.log('📧 All processed emails:');
      console.log('Email rows (snippets only):', SaveGrandmaDebug.emailRows);
      console.log('Opened emails (full body):', SaveGrandmaDebug.openedEmails);
      return {
        emailRows: SaveGrandmaDebug.emailRows,
        openedEmails: SaveGrandmaDebug.openedEmails
      };
    };
    window.SaveGrandmaDebug.testEmailExtraction = function () {
      const emailRows = findElements(EMAIL_ROW_SELECTORS);
      console.log(`🧪 Testing email extraction on ${emailRows.length} email rows:`);
      emailRows.slice(0, 3).forEach((row, index) => {
        var _emailData$snippet5, _emailData$snippet6;
        const emailData = extractEmailData(row);
        console.log(`Email ${index + 1} (SNIPPET ONLY):`, {
          senderName: emailData.senderName,
          senderEmail: emailData.senderEmail,
          subject: emailData.subject,
          snippetLength: ((_emailData$snippet5 = emailData.snippet) === null || _emailData$snippet5 === void 0 ? void 0 : _emailData$snippet5.length) || 0,
          snippetPreview: ((_emailData$snippet6 = emailData.snippet) === null || _emailData$snippet6 === void 0 ? void 0 : _emailData$snippet6.substring(0, 100)) + '...'
        });
      });
    };
    window.SaveGrandmaDebug.showFullBodies = function () {
      console.log('📄 All captured full email bodies:');
      SaveGrandmaDebug.openedEmails.forEach((email, index) => {
        console.log(`\n--- Email ${index + 1} Full Body ---`);
        console.log(email.data.body);
      });
    };
    window.SaveGrandmaDebug.testVisualIndicators = function () {
      console.log('🧪 Visual indicators are now enabled!');
      console.log('Phishing emails will show a red ⚠️ icon in the subject line');
      console.log('Use testPhishingDetection() to test the visual indicators');
    };
    window.SaveGrandmaDebug.enableVisualIndicators = function () {
      console.log('✅ Visual indicators are already enabled');
      console.log('Phishing emails will show a red ⚠️ icon in the subject line');
    };
    window.SaveGrandmaDebug.testPhishingDetection = function () {
      console.log('🧪 Testing phishing detection system...');
      const emailRows = findElements(EMAIL_ROW_SELECTORS);
      console.log(`Testing ${emailRows.length} email rows with new scoring system:`);
      let suspiciousEmails = 0;
      emailRows.slice(0, 5).forEach((row, index) => {
        const emailData = extractEmailData(row);
        const analysis = analyzeEmailForPhishing(emailData);
        console.log(`\n--- Email ${index + 1} Analysis ---`);
        console.log(`Sender: ${emailData.senderName || 'No name'} <${emailData.senderEmail || 'No email'}>`);
        console.log(`Subject: ${emailData.subject || 'No subject'}`);
        console.log(`Score: ${analysis.score} points`);
        console.log(`Flagged: ${analysis.isPhishing ? '🚨 YES' : '✅ No'}`);
        if (analysis.indicators.length > 0) {
          console.log('Indicators:');
          analysis.indicators.forEach(indicator => {
            console.log(`  - ${indicator.type}: ${indicator.description} (${indicator.weight} points)`);
            console.log(`    Value: ${indicator.value}`);
          });
        }
        if (analysis.isPhishing) {
          suspiciousEmails++;
        }
      });
      console.log(`\n📊 Results: ${suspiciousEmails} suspicious emails found out of ${Math.min(5, emailRows.length)} tested`);
      console.log(`Threshold: 3 points (emails with 3+ points are flagged)`);
      return {
        tested: Math.min(5, emailRows.length),
        suspiciousEmails,
        threshold: 3
      };
    };

    // Expose the analysis function for manual testing
    window.SaveGrandmaDebug.analyzeEmailForPhishing = analyzeEmailForPhishing;

    // Whitelist management functions
    window.SaveGrandmaDebug.addToWhitelist = addToWhitelist;
    window.SaveGrandmaDebug.removeFromWhitelist = removeFromWhitelist;
    window.SaveGrandmaDebug.isWhitelisted = isWhitelisted;
    window.SaveGrandmaDebug.isWhitelistAtCapacity = isWhitelistAtCapacity;
    window.SaveGrandmaDebug.getWhitelist = function () {
      console.log('📋 Current whitelist:', [...emailWhitelist]);
      return [...emailWhitelist];
    };
    window.SaveGrandmaDebug.getWhitelistStatus = function () {
      const currentCount = emailWhitelist.size;
      const maxCount = MAX_WHITELIST_SIZE;
      const isAtCapacity = currentCount >= maxCount;
      const status = {
        currentCount,
        maxCount,
        isAtCapacity,
        remaining: maxCount - currentCount
      };
      console.log('📊 Whitelist Status:', status);
      return status;
    };
    window.SaveGrandmaDebug.clearWhitelist = function () {
      emailWhitelist.clear();
      saveWhitelist();
      console.log('🗑️ Whitelist cleared');
    };
    SaveGrandmaDebug.log('Debug object available at window.SaveGrandmaDebug');
    SaveGrandmaDebug.log('Helper functions: inspectCurrentEmail(), inspectAllEmails(), testEmailExtraction(), showFullBodies(), testVisualIndicators(), testPhishingDetection(), analyzeEmailForPhishing(), addToWhitelist(), removeFromWhitelist(), isWhitelistAtCapacity(), getWhitelist(), getWhitelistStatus(), clearWhitelist()');
  } catch (error) {
    SaveGrandmaDebug.updateStatus('initialization_failed');
    SaveGrandmaDebug.error('Failed to initialize DOM monitoring', error);
  }
}

// Add visual styles for phishing indicators
function addVisualStyles() {
  // Create and inject CSS for phishing warning icon and popup
  const style = document.createElement('style');
  style.textContent = `
    .savegrandma-warning-icon {
      display: inline-block;
      width: 16px;
      height: 16px;
      background-color: #d32f2f;
      color: white;
      text-align: center;
      line-height: 16px;
      font-size: 12px;
      font-weight: bold;
      margin-right: 6px;
      border-radius: 2px;
      vertical-align: middle;
      flex-shrink: 0;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    
    .savegrandma-warning-icon:hover {
      background-color: #b71c1c;
    }
    
    .savegrandma-warning-icon::before {
      content: "⚠️";
    }
    
    /* Ensure the warning icon appears at the start of the subject line */
    .savegrandma-subject-container {
      display: flex;
      align-items: center;
    }
    
    /* Popup window styles */
    .savegrandma-popup {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      max-height: 600px;
      background: white;
      border: 2px solid #d32f2f;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .savegrandma-popup-header {
      background: #d32f2f;
      color: white;
      padding: 12px 16px;
      border-radius: 6px 6px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .savegrandma-popup-title {
      font-weight: bold;
      font-size: 16px;
    }
    
    .savegrandma-popup-close {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
    }
    
    .savegrandma-popup-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .savegrandma-popup-content {
      padding: 16px;
      max-height: 500px;
      overflow-y: auto;
    }
    
    .savegrandma-popup-score {
      font-size: 18px;
      font-weight: bold;
      color: #d32f2f;
      margin-bottom: 12px;
    }
    
    .savegrandma-popup-indicators {
      margin-top: 12px;
    }
    
    .savegrandma-popup-indicator {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 8px;
    }
    
    .savegrandma-popup-indicator-title {
      font-weight: bold;
      color: #856404;
      margin-bottom: 4px;
    }
    
    .savegrandma-popup-indicator-description {
      color: #856404;
      font-size: 13px;
    }
    
    .savegrandma-popup-indicator-value {
      color: #6c757d;
      font-size: 12px;
      margin-top: 2px;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
  SaveGrandmaDebug.log('Visual styles added for phishing warning icon and popup');
}

// Message handling for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'getStats':
        sendResponse({
          success: true,
          stats: extensionStats
        });
        break;
      case 'getAllData':
        sendResponse({
          success: true,
          stats: extensionStats,
          whitelist: [...emailWhitelist]
        });
        break;
      case 'whitelistUpdated':
        if (message.data) {
          if (message.data.action === 'remove' && message.data.email) {
            removeFromWhitelist(message.data.email);
          } else if (message.data.action === 'clear') {
            emailWhitelist.clear();
            extensionStats.emailsWhitelisted = 0;
            saveWhitelist();
            saveStats();
          }
        }
        sendResponse({
          success: true
        });
        break;
      default:
        sendResponse({
          success: false,
          error: 'Unknown action'
        });
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error handling message', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
  return true; // Keep message channel open for async response
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadWhitelist();
    addVisualStyles();
    initializeDOMMonitoring();
  });
} else {
  loadStats();
  loadWhitelist();
  addVisualStyles();
  initializeDOMMonitoring();
}

// Periodic status logging
setInterval(() => {
  SaveGrandmaDebug.log('Periodic status check', {
    status: SaveGrandmaDebug.status,
    emailRows: SaveGrandmaDebug.emailRows.length,
    openedEmails: SaveGrandmaDebug.openedEmails.length,
    errors: SaveGrandmaDebug.errors.length
  });
}, 30000);

// Periodic cache cleanup only (no rescanning to prevent flickering)
setInterval(() => {
  // Clean up expired cache entries
  cleanupCache();
}, 30000); // Run every 30 seconds for cache cleanup only
/******/ })()
;