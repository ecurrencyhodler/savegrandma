const { MAX_SAVE_FAILURES } = require('../constants');
const { executeWithLock } = require('../locking');
const getGmailAccountId = require('./getGmailAccountId');
const isChromeContextValid = require('./isChromeContextValid');
const { hasMeaningfulChanges } = require('./captureInitialState');
const { storage, ChromeAPI } = require('../chromeApi/index.js');
const { emailWhitelist } = require('../whitelist/index.js');

// Save failure tracking to prevent infinite retry loops
let saveFailureCount = {
  stats: 0,
  whitelist: 0
};

/**
 * Save stats to Chrome storage
 */
async function saveStatsUnified(unifiedStats) {
  return await executeWithLock(async () => {
    try {
      
      // Check if we've exceeded the maximum number of save failures
      if (saveFailureCount.stats >= MAX_SAVE_FAILURES) {
        // Check if context is now valid - if so, reset failure count and proceed
        if (isChromeContextValid()) {
          console.log(`🔄 Context recovered - resetting failure count from ${saveFailureCount.stats} to 0`);
          saveFailureCount.stats = 0;
        } else {
          console.log(`⏹️ Skipping stats save - exceeded maximum failure count (${saveFailureCount.stats}/${MAX_SAVE_FAILURES})`);
          return false;
        }
      }
      
      // Check if there are meaningful changes to save
      if (!hasMeaningfulChanges(unifiedStats, emailWhitelist)) {
        console.log('⏭️ Skipping stats save - no meaningful changes detected');
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
          // Validate data size before saving
          if (!storage.validateDataSize(statsToSave)) {
            return false;
          }
          
          ChromeAPI.log('saveStatsUnified', { accountId, statsKey, dataSize: JSON.stringify(statsToSave).length });
          await storage.set({ [statsKey]: statsToSave });
          
          console.log(`💾 Saved unified stats to chrome.storage for account ${accountId}: ${unifiedStats.session.emailsScanned} emails this session, ${unifiedStats.persistent.totalThreatsEverFound} total threats`);
          // Reset failure count on successful save
          saveFailureCount.stats = 0;
          return true;
        } catch (storageError) {
          ChromeAPI.handleError(storageError, 'saveStatsUnified', { accountId, statsKey });
          // Increment failure count for invalid context or storage errors
          saveFailureCount.stats++;
          console.log(`📊 Stats save failure count: ${saveFailureCount.stats}/${MAX_SAVE_FAILURES}`);
          return false;
        }
      } else {
        console.error('Chrome context not valid, cannot save stats');
        // Increment failure count for invalid context
        saveFailureCount.stats++;
        console.log(`📊 Stats save failure count: ${saveFailureCount.stats}/${MAX_SAVE_FAILURES}`);
        return false;
      }
    } catch (error) {
      console.error('Error saving unified stats', error);
      // Increment failure count for any other errors
      saveFailureCount.stats++;
      console.log(`📊 Stats save failure count: ${saveFailureCount.stats}/${MAX_SAVE_FAILURES}`);
      
      // Try to report error to SaveGrandmaDebug if available
      if (typeof window !== 'undefined' && window.SaveGrandmaDebug && window.SaveGrandmaDebug.error) {
        window.SaveGrandmaDebug.error('Error saving unified stats', error);
      }
      
      return false;
    }
  }, 'saveStatsUnified');
}

module.exports = saveStatsUnified;
