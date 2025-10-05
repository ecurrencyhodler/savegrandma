const { MAX_SAVE_FAILURES } = require('../constants');
const { executeWithLock } = require('../locking');
const getGmailAccountId = require('./getGmailAccountId');
const isChromeContextValid = require('./isChromeContextValid');
const { hasMeaningfulChanges } = require('./captureInitialState');
const generateWhitelistHash = require('./generateWhitelistHash');
const { storage, ChromeAPI } = require('../chromeApi/index.js');

// Save failure tracking to prevent infinite retry loops
let saveFailureCount = {
  stats: 0,
  whitelist: 0
};

/**
 * Save whitelist to Chrome storage
 */
async function saveWhitelist(emailWhitelist, unifiedStats) {
  console.log('💾 saveWhitelist called with:', { 
    whitelistSize: emailWhitelist.size, 
    unifiedStats: !!unifiedStats,
    contextValid: isChromeContextValid()
  });
  
  return await executeWithLock(async () => {
    try {
      
      // Check if we've exceeded the maximum number of save failures
      if (saveFailureCount.whitelist >= MAX_SAVE_FAILURES) {
        // Check if context is now valid - if so, reset failure count and proceed
        if (isChromeContextValid()) {
          console.log(`🔄 Context recovered - resetting whitelist failure count from ${saveFailureCount.whitelist} to 0`);
          saveFailureCount.whitelist = 0;
        } else {
          console.log(`⏹️ Skipping whitelist save - exceeded maximum failure count (${saveFailureCount.whitelist}/${MAX_SAVE_FAILURES})`);
          return false;
        }
      }
      
      // Check if whitelist has meaningful changes using the proper function
      const hasChanges = hasMeaningfulChanges(unifiedStats, emailWhitelist);
      console.log('🔍 Checking for meaningful changes:', {
        hasChanges: hasChanges,
        whitelistSize: emailWhitelist.size
      });
      
      if (!hasChanges) {
        console.log('⏭️ Skipping whitelist save - no changes detected');
        return true; // Return true to indicate "success" (no save needed)
      }
      
      const accountId = getGmailAccountId();
      const whitelistKey = `savegrandma_whitelist_${accountId}`;
      
      // Save to chrome.storage.local
      if (isChromeContextValid()) {
        try {
          // Validate data size before saving
          const whitelistData = [...emailWhitelist];
          if (!storage.validateDataSize(whitelistData)) {
            return false;
          }
          
          ChromeAPI.log('saveWhitelist', { accountId, whitelistKey, whitelistSize: emailWhitelist.size });
          await storage.set({ [whitelistKey]: whitelistData });
          // Update timestamp when whitelist is saved
          unifiedStats.persistent.lastUpdated = Date.now();
          console.log(`💾 Saved whitelist with ${emailWhitelist.size} entries to chrome.storage for account ${accountId}`);
          // Reset failure count on successful save
          saveFailureCount.whitelist = 0;
          return true;
        } catch (storageError) {
          ChromeAPI.handleError(storageError, 'saveWhitelist', { accountId, whitelistKey });
          // Increment failure count for invalid context or storage errors
          saveFailureCount.whitelist++;
          console.log(`📋 Whitelist save failure count: ${saveFailureCount.whitelist}/${MAX_SAVE_FAILURES}`);
          return false;
        }
      } else {
        console.error('Chrome context not valid, cannot save whitelist');
        // Increment failure count for invalid context
        saveFailureCount.whitelist++;
        console.log(`📋 Whitelist save failure count: ${saveFailureCount.whitelist}/${MAX_SAVE_FAILURES}`);
        return false;
      }
    } catch (error) {
      console.error('Error saving whitelist', error);
      // Increment failure count for any other errors
      saveFailureCount.whitelist++;
      console.log(`📋 Whitelist save failure count: ${saveFailureCount.whitelist}/${MAX_SAVE_FAILURES}`);
      return false;
    }
  }, 'saveWhitelist');
}

module.exports = saveWhitelist;
