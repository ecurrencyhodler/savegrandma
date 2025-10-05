// SaveGrandma Chrome Extension - DOM-based approach
// Privacy-focused implementation without external dependencies

console.log('SaveGrandma: Extension loading (DOM-based approach)...');

// Cache management constants
const MAX_CACHE_SIZE = 200;
const CACHE_EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_FORCE_CLEANUP_THRESHOLD = 250; // Force cleanup if cache exceeds this size

// Whitelist management constants
const MAX_WHITELIST_SIZE = 10000;

// Store analysis data for emails so we can re-add icons after DOM changes
const emailAnalysisCache = new Map();

// Whitelist storage - emails marked as safe by user
let emailWhitelist = new Set();

// Unified statistics structure - single source of truth
let unifiedStats = {
  // Session data (resets on page load)
  session: {
    emailsScanned: 0,
    threatsIdentified: 0,
    sessionStartTime: Date.now()
  },
  // Persistent data (survives page reloads)
  persistent: {
    totalThreatsEverFound: 0,
    emailsWhitelisted: 0,
    totalEmailsScanned: 0, // Cumulative across all sessions
    lastUpdated: Date.now()
  },
  // Metadata
  version: "2.0", // For future migrations
  lastCleanup: null
};

// Change tracking to avoid unnecessary saves
let initialStatsState = null;
let hasDataChanged = false;
let initialWhitelistHash = null;

// Legacy compatibility objects (populated from unified stats)
let sessionStats = unifiedStats.session;
let persistentStats = unifiedStats.persistent;
let extensionStats = {
  totalEmailsScanned: 0,
  threatsIdentified: 0,
  emailsWhitelisted: 0,
  lastUpdated: Date.now()
};

// Helper function to generate whitelist content hash
function generateWhitelistHash() {
  const sortedEmails = Array.from(emailWhitelist).sort();
  return sortedEmails.join('|');
}

// Helper function to capture initial state for change tracking
function captureInitialState() {
  initialStatsState = {
    emailsScanned: unifiedStats.session.emailsScanned,
    threatsIdentified: unifiedStats.session.threatsIdentified,
    totalThreatsEverFound: unifiedStats.persistent.totalThreatsEverFound,
    emailsWhitelisted: unifiedStats.persistent.emailsWhitelisted,
    totalEmailsScanned: unifiedStats.persistent.totalEmailsScanned,
    whitelistSize: emailWhitelist.size
  };
  initialWhitelistHash = generateWhitelistHash();
  hasDataChanged = false;
}

// Helper function to check if meaningful changes have occurred
function hasMeaningfulChanges() {
  if (!initialStatsState) return true; // If no initial state captured, assume changes
  
  return (
    unifiedStats.session.emailsScanned > initialStatsState.emailsScanned ||
    unifiedStats.session.threatsIdentified > initialStatsState.threatsIdentified ||
    unifiedStats.persistent.totalThreatsEverFound > initialStatsState.totalThreatsEverFound ||
    unifiedStats.persistent.emailsWhitelisted > initialStatsState.emailsWhitelisted ||
    unifiedStats.persistent.totalEmailsScanned > initialStatsState.totalEmailsScanned ||
    emailWhitelist.size > initialStatsState.whitelistSize ||
    hasDataChanged
  );
}

// Helper function to mark that data has changed
function markDataChanged() {
  hasDataChanged = true;
}

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
    console.log(`[${timestamp}] SaveGrandma: ${message}`, data || '');
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
      await flushPendingUpdates();
    }
    
    // Save stats at the end of scan (important: this is end-of-scan save)
    await saveStatsUnified();
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
  }
};

// Email row selectors (multiple fallbacks for robustness)
const EMAIL_ROW_SELECTORS = [
  '.zA',                    // Primary Gmail email row class (50 elements found)
  'tr[role="button"]',      // Alternative selector
  'div[role="main"] tr',    // Main content area rows (52 elements found)
  '[data-legacy-thread-id]' // Data attribute based (100 elements found)
];

// Email content selectors (based on your exploration results)
const EMAIL_SELECTORS = {
  sender: ['.yP', '[email]'],           // .yP found 124 elements, [email] found 112 elements
  subject: ['.y6', '.bog'],             // Both found 50 elements each
  snippet: ['.y2'],                     // Found 50 elements
  body: ['.ii', '.adP'],
  threadId: ['[data-legacy-thread-id]'], // Found 100 elements
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
  
  // Force cleanup if cache is getting too large
  if (emailAnalysisCache.size > CACHE_FORCE_CLEANUP_THRESHOLD) {
    const entries = Array.from(emailAnalysisCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp
    
    // Remove oldest 25% of entries
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
    toRemove.forEach(([threadId]) => {
      emailAnalysisCache.delete(threadId);
      removedCount++;
    });
  }
  // Regular cleanup if cache is still too large
  else if (emailAnalysisCache.size > MAX_CACHE_SIZE) {
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

// Comprehensive storage cleanup function
async function performStorageCleanup() {
  try {
    SaveGrandmaDebug.log('🧹 Starting comprehensive storage cleanup...');
    let totalCleaned = 0;
    
    // 1. Clean up email analysis cache
    const initialCacheSize = emailAnalysisCache.size;
    cleanupCache();
    const cacheCleaned = initialCacheSize - emailAnalysisCache.size;
    totalCleaned += cacheCleaned;
    
    // 2. Clean up Chrome storage (if context is valid)
    if (isChromeContextValid()) {
      try {
        const accountId = getGmailAccountId();
        const statsKey = `savegrandma_stats_${accountId}`;
        
        // Get current stats
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get([statsKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
        
        if (result[statsKey]) {
          const stats = result[statsKey];
          
          // Clean up old session data (keep only last 7 days)
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          if (stats.sessionStats && stats.sessionStats.sessionStartTime < sevenDaysAgo) {
            // Reset session stats if older than 7 days
            const cleanedStats = {
              ...stats,
              sessionStats: {
                emailsScannedThisSession: 0,
                threatsIdentifiedThisSession: 0,
                sessionStartTime: Date.now()
              },
              lastUpdated: Date.now()
            };
            
            await new Promise((resolve, reject) => {
              chrome.storage.local.set({ [statsKey]: cleanedStats }, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
            
            SaveGrandmaDebug.log('🗑️ Cleaned up old session data from Chrome storage');
            totalCleaned++;
          }
        }
      } catch (error) {
        SaveGrandmaDebug.error('Error cleaning Chrome storage', error);
      }
    }
    
    // 3. Clean up debug data (keep only last 100 errors)
    if (SaveGrandmaDebug.errors.length > 100) {
      const errorsToKeep = SaveGrandmaDebug.errors.slice(-100); // Keep last 100 errors
      SaveGrandmaDebug.errors = errorsToKeep;
      SaveGrandmaDebug.log(`🗑️ Cleaned up debug errors (kept last 100 of ${SaveGrandmaDebug.errors.length + 100})`);
      totalCleaned++;
    }
    
    if (totalCleaned > 0) {
      SaveGrandmaDebug.log(`✅ Storage cleanup completed: ${totalCleaned} items cleaned`);
    } else {
      SaveGrandmaDebug.log('✅ Storage cleanup completed: no cleanup needed');
    }
    
    return totalCleaned;
  } catch (error) {
    SaveGrandmaDebug.error('Error during storage cleanup', error);
    return 0;
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

// Extract Gmail account ID from URL (e.g., u/0, u/1, etc.)
function getGmailAccountId(url = null) {
  // Use provided URL or fall back to window location
  const targetUrl = url || window.location.href;
  if (!targetUrl) return 'default';
  
  // More robust regex that handles various Gmail URL patterns including query params and fragments
  const patterns = [
    /mail\.google\.com\/mail\/u\/(\d+)(?:\/|#|\?|$)/,  // Standard pattern with query params
    /inbox\.google\.com\/u\/(\d+)(?:\/|#|\?|$)/,      // Inbox pattern
    /mail\.google\.com\/u\/(\d+)(?:\/|#|\?|$)/        // Alternative pattern
  ];
  
  for (const pattern of patterns) {
    const match = targetUrl.match(pattern);
    if (match) {
      return `u_${match[1]}`;
    }
  }
  
  return 'default';
}


// Unified batching system - all stats updates go through this
let pendingUpdates = {
  emailsScanned: 0,
  threatsIdentified: 0,
  emailsWhitelisted: 0,
  timestamp: Date.now()
};

let batchSaveTimeout = null;
let isBatchSaving = false; // Prevent concurrent saves

// Global save lock and operation queue to prevent race conditions
let globalSaveLock = false;
let operationQueue = [];
let isProcessingQueue = false;

// Batch configuration
const BATCH_SAVE_DELAY = 2000; // 2 seconds
const MAX_BATCH_SIZE = 100; // Prevent batches from getting too large

// Helper function to check if chrome APIs are available
function isChromeContextValid() {
  try {
    return !!(chrome && chrome.storage && chrome.storage.local);
  } catch (error) {
    return false;
  }
}

// Global save lock and queue management functions
async function acquireSaveLock() {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (!globalSaveLock) {
        globalSaveLock = true;
        resolve();
      } else {
        // Add to queue and wait
        operationQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function releaseSaveLock() {
  globalSaveLock = false;
  if (operationQueue.length > 0) {
    const nextOperation = operationQueue.shift();
    nextOperation();
  }
}

async function processOperationQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  while (operationQueue.length > 0) {
    const operation = operationQueue.shift();
    try {
      await operation();
    } catch (error) {
      SaveGrandmaDebug.error('Error processing queued operation', error);
    }
  }
  
  isProcessingQueue = false;
}

// Wrapper function to ensure operations are queued properly
async function executeWithLock(operation, operationName) {
  await acquireSaveLock();
  try {
    SaveGrandmaDebug.log(`🔒 Acquired save lock for: ${operationName}`);
    const result = await operation();
    SaveGrandmaDebug.log(`🔓 Released save lock for: ${operationName}`);
    return result;
  } finally {
    releaseSaveLock();
  }
}



// Unified stats update function - all stats changes go through this
async function updateStatsUnified(type, increment = 1) {
  // Validate input
  if (!['emailsScanned', 'threatsIdentified', 'emailsWhitelisted'].includes(type)) {
    SaveGrandmaDebug.error(`Invalid stats type: ${type}`);
    return;
  }
  
  if (increment < 0) {
    SaveGrandmaDebug.error(`Negative increment not allowed: ${increment}`);
    return;
  }
  
  // Mark that data has changed
  markDataChanged();
  
  // Add to pending updates
  pendingUpdates[type] += increment;
  pendingUpdates.timestamp = Date.now();
  
  // Update in-memory stats immediately for UI responsiveness
  updateInMemoryStats(type, increment);
  
  // Clear existing timeout
  if (batchSaveTimeout) {
    clearTimeout(batchSaveTimeout);
  }
  
  // Set new timeout to batch the updates
  batchSaveTimeout = setTimeout(() => {
    flushPendingUpdates();
  }, BATCH_SAVE_DELAY);
  
  // Force flush if batch gets too large
  if (pendingUpdates.emailsScanned + pendingUpdates.threatsIdentified + pendingUpdates.emailsWhitelisted > MAX_BATCH_SIZE) {
    if (batchSaveTimeout) {
      clearTimeout(batchSaveTimeout);
    }
    flushPendingUpdates();
  }
}

// Update in-memory stats immediately (for UI responsiveness)
function updateInMemoryStats(type, increment) {
  switch (type) {
    case 'emailsScanned':
      unifiedStats.session.emailsScanned += increment;
      unifiedStats.persistent.totalEmailsScanned += increment;
      break;
    case 'threatsIdentified':
      unifiedStats.session.threatsIdentified += increment;
      unifiedStats.persistent.totalThreatsEverFound += increment;
      break;
    case 'emailsWhitelisted':
      unifiedStats.persistent.emailsWhitelisted += increment;
      break;
  }
  
  // Update legacy compatibility objects
  updateLegacyStats();
}

// Flush pending updates to storage
async function flushPendingUpdates() {
  if (isBatchSaving) {
    SaveGrandmaDebug.log('Batch save already in progress, skipping...');
    return;
  }
  
  const hasUpdates = pendingUpdates.emailsScanned > 0 || 
                    pendingUpdates.threatsIdentified > 0 || 
                    pendingUpdates.emailsWhitelisted > 0;
  
  if (!hasUpdates) {
    batchSaveTimeout = null;
    return;
  }
  
  isBatchSaving = true;
  
  try {
    // Reset pending updates BEFORE saving to prevent race conditions
    const updatesToSave = { ...pendingUpdates };
    pendingUpdates.emailsScanned = 0;
    pendingUpdates.threatsIdentified = 0;
    pendingUpdates.emailsWhitelisted = 0;
    pendingUpdates.timestamp = Date.now();
    
    // Save to storage using the locking mechanism (the batched data is already applied to in-memory stats)
    const saveSuccess = await saveStatsUnified();
    
    if (saveSuccess) {
      SaveGrandmaDebug.log(`✅ Flushed ${updatesToSave.emailsScanned} emails, ${updatesToSave.threatsIdentified} threats, ${updatesToSave.emailsWhitelisted} whitelist changes`);
    } else {
      // Restore pending updates on failure
      pendingUpdates.emailsScanned += updatesToSave.emailsScanned;
      pendingUpdates.threatsIdentified += updatesToSave.threatsIdentified;
      pendingUpdates.emailsWhitelisted += updatesToSave.emailsWhitelisted;
      SaveGrandmaDebug.error('Failed to save stats, restored pending updates');
    }
    
  } catch (error) {
    SaveGrandmaDebug.error('Error flushing pending updates', error);
    
    // Restore pending updates on failure
    pendingUpdates.emailsScanned += updatesToSave.emailsScanned;
    pendingUpdates.threatsIdentified += updatesToSave.threatsIdentified;
    pendingUpdates.emailsWhitelisted += updatesToSave.emailsWhitelisted;
  } finally {
    isBatchSaving = false;
    batchSaveTimeout = null;
  }
}

function batchPopupNotification() {
  // Send immediate popup notification (no batching needed since it's only called at end of scan)
  if (isChromeContextValid()) {
    try {
      chrome.runtime.sendMessage({
        action: 'updateStats',
        stats: extensionStats
      });
      SaveGrandmaDebug.log('📤 End-of-scan popup notification sent');
    } catch (error) {
      SaveGrandmaDebug.log('Could not send end-of-scan popup notification:', error);
    }
  } else {
    SaveGrandmaDebug.log('Chrome context not valid, skipping popup notification');
  }
}

// Helper function to update legacy extensionStats for compatibility
function updateLegacyStats() {
  extensionStats.totalEmailsScanned = unifiedStats.session.emailsScanned;
  extensionStats.threatsIdentified = unifiedStats.session.threatsIdentified;
  extensionStats.emailsWhitelisted = unifiedStats.persistent.emailsWhitelisted;
  extensionStats.lastUpdated = unifiedStats.persistent.lastUpdated;
  
  // Also update the old session/persistent objects for backward compatibility
  sessionStats.emailsScannedThisSession = unifiedStats.session.emailsScanned;
  sessionStats.threatsIdentifiedThisSession = unifiedStats.session.threatsIdentified;
  sessionStats.sessionStartTime = unifiedStats.session.sessionStartTime;
  
  persistentStats.totalThreatsEverFound = unifiedStats.persistent.totalThreatsEverFound;
  persistentStats.emailsWhitelisted = unifiedStats.persistent.emailsWhitelisted;
  persistentStats.lastUpdated = unifiedStats.persistent.lastUpdated;
}

// Session management functions
function resetSessionStats() {
  unifiedStats.session = {
    emailsScanned: 0,
    threatsIdentified: 0,
    sessionStartTime: Date.now()
  };
  updateLegacyStats();
  
  // Recapture initial state after reset
  captureInitialState();
  
  SaveGrandmaDebug.log('🔄 Session stats reset - starting fresh count');
}

// Statistics management functions
async function loadStats() {
  try {
    const accountId = getGmailAccountId();
    const statsKey = `savegrandma_stats_${accountId}`;
    
    SaveGrandmaDebug.log(`Loading stats for account: ${accountId}, key: ${statsKey}`);
    
    // Try chrome.storage.local first, fallback to localStorage
    if (isChromeContextValid()) {
      try {
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get([statsKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
        
        SaveGrandmaDebug.log(`Storage query result for key ${statsKey}:`, result);
        
        if (result[statsKey]) {
          const loadedStats = result[statsKey];
          
          // Load persistent stats (threats and whitelist count)
          if (loadedStats.totalThreatsEverFound !== undefined) {
            persistentStats.totalThreatsEverFound = loadedStats.totalThreatsEverFound;
          }
          if (loadedStats.emailsWhitelisted !== undefined) {
            persistentStats.emailsWhitelisted = loadedStats.emailsWhitelisted;
          }
          if (loadedStats.lastUpdated) {
            persistentStats.lastUpdated = loadedStats.lastUpdated;
          }
          
          // Legacy support - if old format stats exist, migrate them
          if (loadedStats.totalEmailsScanned !== undefined && loadedStats.totalThreatsEverFound === undefined) {
            // This is old format data, migrate threats to persistent stats
            persistentStats.totalThreatsEverFound = loadedStats.threatsIdentified || 0;
            SaveGrandmaDebug.log('🔄 Migrated legacy stats format to new session/persistent structure');
          }
          
          // Session stats always start fresh
          resetSessionStats();
          
          SaveGrandmaDebug.log(`📊 Loaded persistent stats for account ${accountId}: ${persistentStats.totalThreatsEverFound} total threats, ${persistentStats.emailsWhitelisted} whitelisted`);
        } else {
          SaveGrandmaDebug.log(`No stats found in storage for key: ${statsKey}`);
          // Initialize fresh session stats
          resetSessionStats();
        }
      } catch (storageError) {
        SaveGrandmaDebug.error('Chrome storage error loading stats', storageError);
        // Initialize fresh stats on error
        resetSessionStats();
      }
    } else {
      SaveGrandmaDebug.error('Chrome context not valid, cannot load stats');
      // Initialize fresh stats
      resetSessionStats();
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error loading stats', error);
  }
}


// Unified save function - saves the complete unified stats structure
async function saveStatsUnified() {
  return await executeWithLock(async () => {
    try {
      
      // Check if there are meaningful changes to save
      if (!hasMeaningfulChanges()) {
        SaveGrandmaDebug.log('⏭️ Skipping stats save - no meaningful changes detected');
        return true; // Return true to indicate "success" (no save needed)
      }
      
      // Update timestamp only when we're actually saving meaningful data
      unifiedStats.persistent.lastUpdated = Date.now();
      
      const accountId = getGmailAccountId();
      const statsKey = `savegrandma_stats_${accountId}`;
      
      // Prepare data to save (include both unified structure and legacy compatibility)
      const statsToSave = {
        // New unified structure
        unifiedStats: unifiedStats,
        // Legacy compatibility fields
        sessionStats: {
          emailsScannedThisSession: unifiedStats.session.emailsScanned,
          threatsIdentifiedThisSession: unifiedStats.session.threatsIdentified,
          sessionStartTime: unifiedStats.session.sessionStartTime
        },
        totalThreatsEverFound: unifiedStats.persistent.totalThreatsEverFound,
        emailsWhitelisted: unifiedStats.persistent.emailsWhitelisted,
        lastUpdated: unifiedStats.persistent.lastUpdated,
        totalEmailsScanned: unifiedStats.persistent.totalEmailsScanned,
        threatsIdentified: unifiedStats.session.threatsIdentified
      };
      
      // Save to chrome.storage.local
      if (isChromeContextValid()) {
        try {
          // Validate data size before saving (Chrome storage limit is ~5MB)
          const dataSize = JSON.stringify(statsToSave).length;
          const maxSize = 4 * 1024 * 1024; // 4MB limit to be safe
          
          if (dataSize > maxSize) {
            SaveGrandmaDebug.error(`Stats data too large: ${dataSize} bytes (max: ${maxSize})`);
            return false;
          }
          
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ [statsKey]: statsToSave }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
          SaveGrandmaDebug.log(`💾 Saved unified stats to chrome.storage for account ${accountId}: ${unifiedStats.session.emailsScanned} emails this session, ${unifiedStats.persistent.totalThreatsEverFound} total threats`);
          return true;
        } catch (storageError) {
          SaveGrandmaDebug.error('Chrome storage error saving stats', storageError);
          return false;
        }
      } else {
        SaveGrandmaDebug.error('Chrome context not valid, cannot save stats');
        return false;
      }
    } catch (error) {
      SaveGrandmaDebug.error('Error saving unified stats', error);
      return false;
    }
  }, 'saveStatsUnified');
}

// Legacy saveStats function for backward compatibility
async function saveStats() {
  return await saveStatsUnified();
}


// Legacy updateStats function - now redirects to unified system
async function updateStats(type, increment = 1, shouldSave = false) {
  // Map old type names to new ones
  const typeMap = {
    'totalEmailsScanned': 'emailsScanned',
    'threatsIdentified': 'threatsIdentified',
    'emailsWhitelisted': 'emailsWhitelisted'
  };
  
  const newType = typeMap[type] || type;
  
  if (['emailsScanned', 'threatsIdentified', 'emailsWhitelisted'].includes(newType)) {
    // Use the new unified system
    await updateStatsUnified(newType, increment);
    
    // Handle immediate save if requested
    if (shouldSave) {
      await flushPendingUpdates();
    }
  } else {
    SaveGrandmaDebug.error(`Unknown stats type: ${type}`);
  }
}

// Whitelist management functions
async function loadWhitelist() {
  try {
    const accountId = getGmailAccountId();
    const whitelistKey = `savegrandma_whitelist_${accountId}`;
    
    // Try chrome.storage.local first, fallback to localStorage
    if (isChromeContextValid()) {
      try {
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get([whitelistKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
        
        if (result[whitelistKey]) {
          emailWhitelist = new Set(result[whitelistKey]);
          persistentStats.emailsWhitelisted = emailWhitelist.size;
          updateLegacyStats();
          SaveGrandmaDebug.log(`📋 Loaded whitelist with ${emailWhitelist.size} entries from chrome.storage for account ${accountId}`);
        }
      } catch (storageError) {
        SaveGrandmaDebug.error('Chrome storage error loading whitelist', storageError);
        // Initialize empty whitelist on error
        emailWhitelist = new Set();
      }
    } else {
      SaveGrandmaDebug.error('Chrome context not valid, cannot load whitelist');
      // Initialize empty whitelist
      emailWhitelist = new Set();
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error loading whitelist', error);
    emailWhitelist = new Set();
  }
}


async function saveWhitelist() {
  return await executeWithLock(async () => {
    try {
      
      // Check if whitelist has meaningful changes (both size and content)
      const currentWhitelistHash = generateWhitelistHash();
      if (initialStatsState && 
          emailWhitelist.size === initialStatsState.whitelistSize && 
          initialWhitelistHash === currentWhitelistHash && 
          !hasDataChanged) {
        SaveGrandmaDebug.log('⏭️ Skipping whitelist save - no changes detected');
        return true; // Return true to indicate "success" (no save needed)
      }
      
      const accountId = getGmailAccountId();
      const whitelistKey = `savegrandma_whitelist_${accountId}`;
      
      // Save to chrome.storage.local
      if (isChromeContextValid()) {
        try {
          // Validate data size before saving (Chrome storage limit is ~5MB)
          const whitelistData = [...emailWhitelist];
          const dataSize = JSON.stringify(whitelistData).length;
          const maxSize = 4 * 1024 * 1024; // 4MB limit to be safe
          
          if (dataSize > maxSize) {
            SaveGrandmaDebug.error(`Whitelist data too large: ${dataSize} bytes (max: ${maxSize})`);
            return false;
          }
          
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ [whitelistKey]: whitelistData }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
          // Update timestamp when whitelist is saved
          unifiedStats.persistent.lastUpdated = Date.now();
          SaveGrandmaDebug.log(`💾 Saved whitelist with ${emailWhitelist.size} entries to chrome.storage for account ${accountId}`);
          return true;
        } catch (storageError) {
          SaveGrandmaDebug.error('Chrome storage error saving whitelist', storageError);
          return false;
        }
      } else {
        SaveGrandmaDebug.error('Chrome context not valid, cannot save whitelist');
        return false;
      }
    } catch (error) {
      SaveGrandmaDebug.error('Error saving whitelist', error);
      return false;
    }
  }, 'saveWhitelist');
}


async function addToWhitelist(senderEmail) {
  if (!senderEmail) return false;
  
  // Check if whitelist is at capacity
  if (emailWhitelist.size >= MAX_WHITELIST_SIZE) {
    SaveGrandmaDebug.log(`❌ Cannot add ${senderEmail} to whitelist - limit of ${MAX_WHITELIST_SIZE} reached`);
    return false;
  }
  
  emailWhitelist.add(senderEmail.toLowerCase());
  persistentStats.emailsWhitelisted = emailWhitelist.size;
  updateLegacyStats();
  
  // Mark that data has changed
  markDataChanged();
  
  // Update the batching system with the whitelist count change
  updateStatsUnified('emailsWhitelisted').catch(error => {
    SaveGrandmaDebug.error('Error updating whitelist stats', error);
  });
  
  // Save whitelist and let batching system handle stats
  try {
    const whitelistSaveSuccess = await saveWhitelist();
    if (!whitelistSaveSuccess) {
      SaveGrandmaDebug.error('Failed to save whitelist changes');
      // Rollback the change
      emailWhitelist.delete(senderEmail.toLowerCase());
      persistentStats.emailsWhitelisted = emailWhitelist.size;
      updateLegacyStats();
      return false;
    }
    
    SaveGrandmaDebug.log(`✅ Added ${senderEmail} to whitelist`);
    
    // Note: Popup notifications now only happen at end of scan to reduce Chrome API calls
    
    return true;
  } catch (error) {
    SaveGrandmaDebug.error('Error saving whitelist changes', error);
    // Rollback the change
    emailWhitelist.delete(senderEmail.toLowerCase());
    persistentStats.emailsWhitelisted = emailWhitelist.size;
    updateLegacyStats();
    return false;
  }
}

async function removeFromWhitelist(senderEmail) {
  if (!senderEmail) return false;
  
  const removed = emailWhitelist.delete(senderEmail.toLowerCase());
  if (removed) {
    persistentStats.emailsWhitelisted = emailWhitelist.size;
    updateLegacyStats();
    
    // Mark that data has changed
    markDataChanged();
    
    // Update the batching system with the whitelist count change
    updateStatsUnified('emailsWhitelisted').catch(error => {
      SaveGrandmaDebug.error('Error updating whitelist stats', error);
    });
    
    // Save whitelist and let batching system handle stats
    try {
      const whitelistSaveSuccess = await saveWhitelist();
      if (!whitelistSaveSuccess) {
        SaveGrandmaDebug.error('Failed to save whitelist changes');
        // Rollback the change
        emailWhitelist.add(senderEmail.toLowerCase());
        persistentStats.emailsWhitelisted = emailWhitelist.size;
        updateLegacyStats();
        return false;
      }
      
      SaveGrandmaDebug.log(`❌ Removed ${senderEmail} from whitelist`);
      
      // Note: Popup notifications now only happen at end of scan to reduce Chrome API calls
    } catch (error) {
      SaveGrandmaDebug.error('Error saving whitelist changes', error);
      // Rollback the change
      emailWhitelist.add(senderEmail.toLowerCase());
      persistentStats.emailsWhitelisted = emailWhitelist.size;
      updateLegacyStats();
      return false;
    }
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
        // Try to get email address from attribute first
        const emailAttr = senderEl.getAttribute('email');
        if (emailAttr) {
          emailData.senderEmail = emailAttr;
        }
        
        // Get sender name from text content
        const senderText = senderEl.textContent?.trim();
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
        emailData.subject = subjectEl.textContent?.trim();
        break;
      }
    }
    
    // Enhanced snippet extraction - try to get as much content as possible from inbox view
    for (const selector of EMAIL_SELECTORS.snippet) {
      const snippetEl = element.querySelector(selector);
      if (snippetEl) {
        emailData.snippet = snippetEl.textContent?.trim();
        break;
      }
    }
    
    // Try to get additional content from the email row itself
    if (!emailData.snippet || emailData.snippet.length < 50) {
      const rowText = element.innerText || element.textContent || '';
      if (rowText.length > (emailData.snippet?.length || 0)) {
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
        emailData.body = bodyEl.textContent?.trim();
        break;
      }
    }
    
    // Find reply-to address (look in email headers for opened emails)
    const replyToEl = element.querySelector('[name="Reply-To"]') || 
                     element.querySelector('meta[name="Reply-To"]') ||
                     element.querySelector('[data-reply-to]');
    if (replyToEl) {
      emailData.replyToAddress = replyToEl.getAttribute('content') || 
                                replyToEl.getAttribute('data-reply-to') ||
                                replyToEl.textContent?.trim();
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
      const shorter = namePart.length < prefix.length ? namePart : prefix;
      const longer = namePart.length >= prefix.length ? namePart : prefix;
      let matchingChars = 0;
      
      for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) {
          matchingChars++;
        }
      }
      
      if (matchingChars >= Math.ceil(shorter.length * 0.6)) {
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

// Analyze email for phishing indicators
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
  
  // Determine if email is flagged (3-point threshold)
  const isPhishing = phishingScore >= 3;
  
  
  // Track threats for summary report (single counting)
  if (isPhishing) {
    // Update the unified stats system (this handles both in-memory and batching)
    updateStatsUnified('threatsIdentified').catch(error => {
      SaveGrandmaDebug.error('Error updating threats stats', error);
    });
    
    // Update scan summary for session reporting
    SaveGrandmaDebug.scanSummary.threatsIdentified++;
    
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

// Update the whitelist counter in the current popup
function updatePopupWhitelistCounter() {
  const popup = document.querySelector('.savegrandma-popup');
  if (!popup) return;
  
  const statusDiv = popup.querySelector('div[style*="margin-top: 12px"]');
  if (!statusDiv) return;
  
  const currentCount = emailWhitelist.size;
  const maxCount = MAX_WHITELIST_SIZE;
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
    ${isAtCapacity ? 
      '<div style="color: #dc3545; font-weight: bold;">⚠️ Whitelist is full!</div>' : 
      '<div style="color: #28a745;">✓ Space available</div>'
    }
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
          
          // Immediately remove warning icons for this sender
          removeWarningIconsForWhitelistedEmails();
          
          // Update the whitelist counter in the popup
          updatePopupWhitelistCounter();
          
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
        
        // Proactive cache cleanup if cache is getting large
        if (emailAnalysisCache.size > CACHE_FORCE_CLEANUP_THRESHOLD) {
          cleanupCache();
        }
      }
      
      // Create warning icon
      const warningIcon = document.createElement('span');
      warningIcon.className = 'savegrandma-warning-icon';
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
        threadId: emailData?.threadId
      });
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error adding visual indicator', error);
  }
}

// Remove warning icons from emails with whitelisted senders
function removeWarningIconsForWhitelistedEmails() {
  const emailRows = findElements(EMAIL_ROW_SELECTORS);
  let iconsRemoved = 0;
  
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
        // Find and remove the warning icon
        const subjectElement = row.querySelector('.y6') || row.querySelector('.bog');
        if (subjectElement) {
          const warningIcon = subjectElement.querySelector('.savegrandma-warning-icon');
          if (warningIcon) {
            // Remove the warning icon and restore original subject text
            const subjectContainer = subjectElement.querySelector('.savegrandma-subject-container');
            if (subjectContainer) {
              // Get the text content (without the icon)
              const textContent = subjectContainer.textContent;
              subjectElement.innerHTML = textContent;
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
      
      // Check if sender is now whitelisted (don't re-add icon if whitelisted)
      if (isWhitelisted(cachedData.emailData.senderEmail)) {
        return; // Sender is whitelisted, don't add warning icon
      }
      
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
      warningIcon.onclick = (e) => {
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
      // Check if this email was already processed (deduplication by threadId)
      const alreadyProcessed = SaveGrandmaDebug.emailRows.find(
        existing => existing.data.threadId && existing.data.threadId === emailData.threadId
      );
      
      if (!alreadyProcessed) {
        // New email - add to tracking and increment counter
        SaveGrandmaDebug.emailRows.push({
          element: element,
          data: emailData
        });
        
        // Update scan tracking
        SaveGrandmaDebug.scanSummary.isScanActive = true;
        SaveGrandmaDebug.scanSummary.lastEmailProcessedTime = new Date();
        
        // Initialize scan start time if this is the first email
        if (!SaveGrandmaDebug.scanSummary.scanStartTime) {
          SaveGrandmaDebug.scanSummary.scanStartTime = new Date();
        }
        updateStatsUnified('emailsScanned').catch(error => {
          SaveGrandmaDebug.error('Error updating email scan stats', error);
        });
        
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
        // Analyze for phishing with visual indicators
        const analysis = analyzeEmailForPhishing(emailData);
        addVisualIndicator(element, analysis.isPhishing, analysis, emailData);
      } else {
        // Re-add icon from cache, but check whitelist first
        const cachedData = emailAnalysisCache.get(emailData.threadId);
        if (cachedData && cachedData.analysis.isPhishing) {
          // Check if sender is now whitelisted
          if (!isWhitelisted(cachedData.emailData.senderEmail)) {
            addVisualIndicator(element, true, cachedData.analysis, cachedData.emailData);
          }
          // If whitelisted, don't add the icon (it will be removed)
        }
      }
      
      // Check if scan is complete (will trigger report if no more emails for 2 seconds)
      setTimeout(async () => {
        await SaveGrandmaDebug.checkScanComplete();
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
          const email = href.replace('mailto:', '');
          const linkText = link.textContent?.trim();
          
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
        emailData.subject = subjectEl.textContent?.trim();
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
      emailData.body = bodyEl.textContent?.trim();
    }
    
    // Merge with extracted data from container
    return { ...emailData, ...extractedData };
    
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
      // Check if this opened email was already processed (deduplication by threadId)
      const alreadyInRows = SaveGrandmaDebug.emailRows.find(
        row => row.data.threadId && row.data.threadId === emailData.threadId
      );
      
      const alreadyOpened = SaveGrandmaDebug.openedEmails.find(
        opened => opened.data.threadId && opened.data.threadId === emailData.threadId
      );
      
      // Only add to openedEmails if not already there
      // Note: We don't increment the counter here because the email should already be in emailRows
      if (!alreadyOpened) {
        SaveGrandmaDebug.openedEmails.push({
          data: emailData
        });
        
        SaveGrandmaDebug.log('📧 Opened email processed - FULL BODY AVAILABLE', {
          senderName: emailData.senderName,
          senderEmail: emailData.senderEmail,
          subject: emailData.subject,
          replyToAddress: emailData.replyToAddress,
          bodyLength: emailData.body?.length || 0,
          bodyPreview: emailData.body?.substring(0, 200) + '...',
          threadId: emailData.threadId,
          totalOpened: SaveGrandmaDebug.openedEmails.length,
          alreadyInEmailRows: !!alreadyInRows
        });
        
        // Log the full body separately for easy viewing
        if (emailData.body) {
          SaveGrandmaDebug.log('📄 FULL EMAIL BODY:', emailData.body);
        }
      } else {
        SaveGrandmaDebug.log('📧 Opened email already processed', {
          threadId: emailData.threadId
        });
      }
      
      // Analyze for phishing (no visual indicators for opened emails)
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
    const observer = new MutationObserver((mutations) => {
      let hasSignificantChanges = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
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
          flushPendingUpdates();
        }
        
        // Save stats before navigating away
        const saveSuccess = await saveStats();
        if (saveSuccess) {
          SaveGrandmaDebug.log('✅ Stats saved before URL change');
        } else {
          SaveGrandmaDebug.error('Failed to save stats before URL change');
        }
        
        currentUrl = window.location.href;
        SaveGrandmaDebug.log('Gmail navigation detected', { url: currentUrl });
        
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
    
    // Save stats on page unload/refresh
    window.addEventListener('beforeunload', () => {
      // Flush any pending batched updates before page unload
      if (batchSaveTimeout) {
        clearTimeout(batchSaveTimeout);
        flushPendingUpdates();
      }
      
      // Save stats on page unload
      const accountId = getGmailAccountId();
      const statsKey = `savegrandma_stats_${accountId}`;
      const statsToSave = {
        sessionStats: sessionStats,
        totalThreatsEverFound: persistentStats.totalThreatsEverFound,
        emailsWhitelisted: persistentStats.emailsWhitelisted,
        lastUpdated: persistentStats.lastUpdated,
        totalEmailsScanned: extensionStats.totalEmailsScanned,
        threatsIdentified: extensionStats.threatsIdentified
      };
      
      try {
        // Try chrome.storage.local first, but don't block on it since beforeunload is time-sensitive
        if (isChromeContextValid()) {
          chrome.storage.local.set({ [statsKey]: statsToSave }, () => {
            if (chrome.runtime.lastError) {
              SaveGrandmaDebug.error('Error saving on unload to chrome.storage:', chrome.runtime.lastError);
            } else {
              SaveGrandmaDebug.log('✅ Stats saved on page unload (chrome.storage)');
            }
          });
        }
      } catch (error) {
        SaveGrandmaDebug.error('Error saving on unload', error);
      }
    });
    
    // Also try to save on visibilitychange (when tab becomes hidden)
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        // Flush any pending batched updates before tab becomes hidden
        if (batchSaveTimeout) {
          clearTimeout(batchSaveTimeout);
          flushPendingUpdates();
        }
        
        const saveSuccess = await saveStats();
        if (saveSuccess) {
          SaveGrandmaDebug.log('✅ Stats saved on tab hidden');
        } else {
          SaveGrandmaDebug.error('Failed to save stats on tab hidden');
        }
      }
    });
    
    SaveGrandmaDebug.updateStatus('initialized');
    SaveGrandmaDebug.log('DOM monitoring initialized successfully');
    
    // Add debug object to window
    window.SaveGrandmaDebug = SaveGrandmaDebug;
    
    // Add helper functions for debugging
    window.SaveGrandmaDebug.inspectCurrentEmail = function() {
      const emailData = extractOpenedEmailData();
      console.log('🔍 Current opened email data:', emailData);
      return emailData;
    };
    
    window.SaveGrandmaDebug.inspectAllEmails = function() {
      console.log('📧 All processed emails:');
      console.log('Email rows (snippets only):', SaveGrandmaDebug.emailRows);
      console.log('Opened emails (full body):', SaveGrandmaDebug.openedEmails);
      return {
        emailRows: SaveGrandmaDebug.emailRows,
        openedEmails: SaveGrandmaDebug.openedEmails
      };
    };
    
    window.SaveGrandmaDebug.testEmailExtraction = function() {
      const emailRows = findElements(EMAIL_ROW_SELECTORS);
      console.log(`🧪 Testing email extraction on ${emailRows.length} email rows:`);
      
      emailRows.slice(0, 3).forEach((row, index) => {
        const emailData = extractEmailData(row);
        console.log(`Email ${index + 1} (SNIPPET ONLY):`, {
          senderName: emailData.senderName,
          senderEmail: emailData.senderEmail,
          subject: emailData.subject,
          snippetLength: emailData.snippet?.length || 0,
          snippetPreview: emailData.snippet?.substring(0, 100) + '...'
        });
      });
    };
    
    window.SaveGrandmaDebug.showFullBodies = function() {
      console.log('📄 All captured full email bodies:');
      SaveGrandmaDebug.openedEmails.forEach((email, index) => {
        console.log(`\n--- Email ${index + 1} Full Body ---`);
        console.log(email.data.body);
      });
    };
    
    window.SaveGrandmaDebug.testVisualIndicators = function() {
      console.log('🧪 Visual indicators are now enabled!');
      console.log('Phishing emails will show a red ⚠️ icon in the subject line');
      console.log('Use testPhishingDetection() to test the visual indicators');
    };
    
    window.SaveGrandmaDebug.enableVisualIndicators = function() {
      console.log('✅ Visual indicators are already enabled');
      console.log('Phishing emails will show a red ⚠️ icon in the subject line');
    };
    
    window.SaveGrandmaDebug.testPhishingDetection = function() {
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
      return { tested: Math.min(5, emailRows.length), suspiciousEmails, threshold: 3 };
    };
    
    // Expose the analysis function for manual testing
    window.SaveGrandmaDebug.analyzeEmailForPhishing = analyzeEmailForPhishing;
    
    // Whitelist management functions
    window.SaveGrandmaDebug.addToWhitelist = addToWhitelist;
    window.SaveGrandmaDebug.removeFromWhitelist = removeFromWhitelist;
    window.SaveGrandmaDebug.isWhitelisted = isWhitelisted;
    window.SaveGrandmaDebug.isWhitelistAtCapacity = isWhitelistAtCapacity;
    window.SaveGrandmaDebug.removeWarningIconsForWhitelistedEmails = removeWarningIconsForWhitelistedEmails;
    window.SaveGrandmaDebug.updatePopupWhitelistCounter = updatePopupWhitelistCounter;
    window.SaveGrandmaDebug.getWhitelist = function() {
      console.log('📋 Current whitelist:', [...emailWhitelist]);
      return [...emailWhitelist];
    };
    window.SaveGrandmaDebug.getWhitelistStatus = function() {
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
    window.SaveGrandmaDebug.clearWhitelist = async function() {
      emailWhitelist.clear();
      const saveSuccess = await saveWhitelist();
      if (saveSuccess) {
        console.log('🗑️ Whitelist cleared');
      } else {
        console.error('Failed to save cleared whitelist');
      }
    };
    
  // Storage management functions
  window.SaveGrandmaDebug.performStorageCleanup = performStorageCleanup;
  window.SaveGrandmaDebug.cleanupCache = cleanupCache;
  
  // Race condition monitoring functions
  window.SaveGrandmaDebug.getSaveLockStatus = function() {
    const status = {
      globalSaveLock: globalSaveLock,
      operationQueueLength: operationQueue.length,
      isProcessingQueue: isProcessingQueue,
      isBatchSaving: isBatchSaving,
      batchSaveTimeout: batchSaveTimeout !== null
    };
    console.log('🔒 Save Lock Status:', status);
    return status;
  };
  
  window.SaveGrandmaDebug.testRaceConditionFix = function() {
    console.log('🧪 Testing race condition fix...');
    console.log('This will simulate concurrent save operations to verify the lock works');
    
    // Simulate concurrent operations
    const operations = [
      () => saveStatsUnified(),
      () => saveWhitelist(),
      () => flushPendingUpdates()
    ];
    
    // Run them concurrently
    Promise.all(operations.map(op => op())).then(results => {
      console.log('✅ All operations completed successfully:', results);
    }).catch(error => {
      console.error('❌ Error in concurrent operations:', error);
    });
  };
  
  // Stats validation and repair functions
  window.SaveGrandmaDebug.validateStats = function() {
    const issues = [];
    
    // Check for negative values
    if (unifiedStats.session.emailsScanned < 0) {
      issues.push(`Negative session emails scanned: ${unifiedStats.session.emailsScanned}`);
      unifiedStats.session.emailsScanned = 0;
    }
    
    if (unifiedStats.session.threatsIdentified < 0) {
      issues.push(`Negative session threats: ${unifiedStats.session.threatsIdentified}`);
      unifiedStats.session.threatsIdentified = 0;
    }
    
    if (unifiedStats.persistent.totalThreatsEverFound < 0) {
      issues.push(`Negative total threats: ${unifiedStats.persistent.totalThreatsEverFound}`);
      unifiedStats.persistent.totalThreatsEverFound = 0;
    }
    
    if (unifiedStats.persistent.emailsWhitelisted < 0) {
      issues.push(`Negative whitelist count: ${unifiedStats.persistent.emailsWhitelisted}`);
      unifiedStats.persistent.emailsWhitelisted = 0;
    }
    
    // Check for impossible relationships
    if (unifiedStats.session.threatsIdentified > unifiedStats.session.emailsScanned) {
      issues.push(`Session threats (${unifiedStats.session.threatsIdentified}) > emails scanned (${unifiedStats.session.emailsScanned})`);
      unifiedStats.session.threatsIdentified = Math.min(unifiedStats.session.threatsIdentified, unifiedStats.session.emailsScanned);
    }
    
    // Check whitelist consistency
    const actualWhitelistSize = emailWhitelist.size;
    if (Math.abs(actualWhitelistSize - unifiedStats.persistent.emailsWhitelisted) > 0) {
      issues.push(`Whitelist size mismatch: actual=${actualWhitelistSize}, recorded=${unifiedStats.persistent.emailsWhitelisted}`);
      unifiedStats.persistent.emailsWhitelisted = actualWhitelistSize;
    }
    
    // Check for stale timestamps
    const now = Date.now();
    if (unifiedStats.persistent.lastUpdated > now + 60000) { // More than 1 minute in future
      issues.push(`Future timestamp detected: ${new Date(unifiedStats.persistent.lastUpdated).toISOString()}`);
      unifiedStats.persistent.lastUpdated = now;
    }
    
    if (issues.length > 0) {
      console.log('🔧 Stats validation found issues:', issues);
      updateLegacyStats(); // Update legacy objects
      return { fixed: issues.length, issues: issues };
    } else {
      console.log('✅ Stats validation passed - no issues found');
      return { fixed: 0, issues: [] };
    }
  };
  
  window.SaveGrandmaDebug.resetAllStats = function() {
    console.log('⚠️ Resetting all stats...');
    
    unifiedStats.session = {
      emailsScanned: 0,
      threatsIdentified: 0,
      sessionStartTime: Date.now()
    };
    
    unifiedStats.persistent = {
      totalThreatsEverFound: 0,
      emailsWhitelisted: 0,
      totalEmailsScanned: 0,
      lastUpdated: Date.now()
    };
    
    emailWhitelist.clear();
    emailAnalysisCache.clear();
    
    updateLegacyStats();
    
    console.log('✅ All stats reset to zero');
  };
    
    window.SaveGrandmaDebug.getStorageInfo = function() {
      const accountId = getGmailAccountId();
      const statsKey = `savegrandma_stats_${accountId}`;
      const whitelistKey = `savegrandma_whitelist_${accountId}`;
      
      const info = {
        accountId: accountId,
        cacheSize: emailAnalysisCache.size,
        inMemoryStats: {
          sessionStats: sessionStats,
          persistentStats: persistentStats,
          extensionStats: extensionStats
        },
        chromeStorage: {
          contextValid: isChromeContextValid(),
          statsKey: statsKey,
          whitelistKey: whitelistKey
        },
        errors: SaveGrandmaDebug.errors.length
      };
      
      console.log('📊 Storage Information:', info);
      return info;
    };
    
    SaveGrandmaDebug.log('Debug object available at window.SaveGrandmaDebug');
    SaveGrandmaDebug.log('Helper functions: inspectCurrentEmail(), inspectAllEmails(), testEmailExtraction(), showFullBodies(), testVisualIndicators(), testPhishingDetection(), analyzeEmailForPhishing(), addToWhitelist(), removeFromWhitelist(), isWhitelistAtCapacity(), getWhitelist(), getWhitelistStatus(), clearWhitelist(), performStorageCleanup(), cleanupCache(), getStorageInfo(), validateStats(), resetAllStats(), getSaveLockStatus(), testRaceConditionFix()');
    
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
if (isChromeContextValid()) {
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    try {
      switch (message.action) {
        case 'getStats':
          SaveGrandmaDebug.log('Popup requested stats:', extensionStats);
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
              removeFromWhitelist(message.data.email).then(() => {
                sendResponse({ success: true });
              }).catch(error => {
                SaveGrandmaDebug.error('Error removing from whitelist', error);
                sendResponse({ success: false, error: error.message });
              });
              return true; // Keep message channel open for async response
            } else if (message.data.action === 'clear') {
              emailWhitelist.clear();
              extensionStats.emailsWhitelisted = 0;
              try {
                const whitelistSaveSuccess = await saveWhitelist();
                if (whitelistSaveSuccess) {
                  sendResponse({ success: true });
                } else {
                  SaveGrandmaDebug.error('Failed to save cleared whitelist');
                  sendResponse({ success: false, error: 'Failed to save whitelist' });
                }
              } catch (error) {
                SaveGrandmaDebug.error('Error clearing whitelist', error);
                sendResponse({ success: false, error: error.message });
              }
              return true; // Keep message channel open for async response
            }
          }
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      SaveGrandmaDebug.error('Error handling message', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
  });
} else {
  SaveGrandmaDebug.log('Chrome context not valid, skipping message listener setup');
}

// Initialize when DOM is ready
async function initializeExtension() {
  try {
    // Suppress Gmail's cache storage errors from affecting our extension
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      // Filter out Gmail's cache storage errors
      if (message.includes('Cache storage prefetch failed') || 
          message.includes('meetsw.js') ||
          message.includes('Content Security Policy')) {
        return; // Suppress these errors
      }
      // Log other errors normally
      originalConsoleError.apply(console, args);
    };
    
    // Load data in parallel for better performance
    await Promise.all([loadStats(), loadWhitelist()]);
    
    // Capture initial state after loading data for change tracking
    captureInitialState();
    
    // Validate and fix any stats inconsistencies
    if (window.SaveGrandmaDebug && window.SaveGrandmaDebug.validateStats) {
      const validation = window.SaveGrandmaDebug.validateStats();
      if (validation.fixed > 0) {
        SaveGrandmaDebug.log(`🔧 Auto-fixed ${validation.fixed} stats inconsistencies on startup`);
      }
    }
    
    addVisualStyles();
    initializeDOMMonitoring();
    
    // Perform initial cleanup after a short delay
    setTimeout(() => {
      performStorageCleanup().then(cleaned => {
        if (cleaned > 0) {
          SaveGrandmaDebug.log(`🧹 Initial cleanup completed: ${cleaned} items cleaned`);
        }
      });
    }, 10000); // Cleanup 10 seconds after initialization
    
    // Notify background script that content script is ready
    if (isChromeContextValid()) {
      try {
        chrome.runtime.sendMessage({
          action: 'contentScriptReady'
        });
        SaveGrandmaDebug.log('Content script ready signal sent');
      } catch (error) {
        SaveGrandmaDebug.error('Failed to send ready signal', error);
      }
    } else {
      SaveGrandmaDebug.log('Chrome context not valid, skipping ready signal');
    }
  } catch (error) {
    SaveGrandmaDebug.error('Error initializing extension', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Periodic checks removed - using event-driven approach instead
// Cache cleanup is handled proactively when cache size exceeds limits
// Status logging is available on-demand via debug functions
