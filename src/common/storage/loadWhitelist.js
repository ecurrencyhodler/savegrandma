const getGmailAccountId = require('./getGmailAccountId');
const isChromeContextValid = require('./isChromeContextValid');
const { storage, ChromeAPI } = require('../chromeApi/index.js');

/**
 * Load whitelist from Chrome storage
 */
async function loadWhitelist(emailWhitelist, persistentStats, updateLegacyStats) {
  try {
    const accountId = getGmailAccountId();
    const whitelistKey = `savegrandma_whitelist_${accountId}`;
    
    // Try chrome.storage.local first, fallback to localStorage
    if (isChromeContextValid()) {
      try {
        ChromeAPI.log('loadWhitelist', { accountId, whitelistKey });
        const result = await storage.get([whitelistKey]);
        
        if (result[whitelistKey]) {
          emailWhitelist.clear();
          result[whitelistKey].forEach(email => emailWhitelist.add(email));
          persistentStats.emailsWhitelisted = emailWhitelist.size;
          updateLegacyStats();
          console.log(`📋 Loaded whitelist with ${emailWhitelist.size} entries from chrome.storage for account ${accountId}`);
        }
      } catch (storageError) {
        ChromeAPI.handleError(storageError, 'loadWhitelist', { accountId, whitelistKey });
        // Initialize empty whitelist on error
        emailWhitelist.clear();
      }
    } else {
      console.error('Chrome context not valid, cannot load whitelist');
      // Initialize empty whitelist
      emailWhitelist.clear();
    }
  } catch (error) {
    console.error('Error loading whitelist', error);
    emailWhitelist.clear();
  }
}

module.exports = loadWhitelist;
