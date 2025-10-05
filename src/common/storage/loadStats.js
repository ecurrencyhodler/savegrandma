const getGmailAccountId = require('./getGmailAccountId');
const isChromeContextValid = require('./isChromeContextValid');
const { storage, ChromeAPI } = require('../chromeApi/index.js');

/**
 * Load stats from Chrome storage
 */
async function loadStats(unifiedStats, persistentStats, resetSessionStats) {
  try {
    const accountId = getGmailAccountId();
    const statsKey = `savegrandma_stats_${accountId}`;
    
    console.log(`Loading stats for account: ${accountId}, key: ${statsKey}`);
    
    // Try chrome.storage.local first, fallback to localStorage
    if (isChromeContextValid()) {
      try {
        ChromeAPI.log('loadStats', { accountId, statsKey });
        const result = await storage.get([statsKey]);
        
        console.log(`Storage query result for key ${statsKey}:`, result);
        
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
            console.log('🔄 Migrated legacy stats format to new session/persistent structure');
          }
          
          // Session stats always start fresh
          resetSessionStats();
          
          console.log(`📊 Loaded persistent stats for account ${accountId}: ${persistentStats.totalThreatsEverFound} total threats, ${persistentStats.emailsWhitelisted} whitelisted`);
        } else {
          console.log(`No stats found in storage for key: ${statsKey}`);
          // Initialize fresh session stats
          resetSessionStats();
        }
      } catch (storageError) {
        ChromeAPI.handleError(storageError, 'loadStats', { accountId, statsKey });
        // Initialize fresh stats on error
        resetSessionStats();
      }
    } else {
      console.error('Chrome context not valid, cannot load stats');
      // Initialize fresh stats
      resetSessionStats();
    }
  } catch (error) {
    console.error('Error loading stats', error);
  }
}

module.exports = loadStats;
