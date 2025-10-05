const { MAX_WHITELIST_SIZE } = require('../constants');
const { markDataChanged } = require('../storage/captureInitialState');
const emailWhitelist = require('./emailWhitelist');

/**
 * Add email to whitelist
 */
async function addToWhitelist(senderEmail, updateStatsUnified, saveWhitelist, updateLegacyStats, persistentStats) {
  console.log('🔍 addToWhitelist called with:', { senderEmail, whitelistSize: emailWhitelist.size });
  
  if (!senderEmail) {
    console.log('❌ No sender email provided');
    return false;
  }
  
  // Check if whitelist is at capacity
  if (emailWhitelist.size >= MAX_WHITELIST_SIZE) {
    console.log(`❌ Cannot add ${senderEmail} to whitelist - limit of ${MAX_WHITELIST_SIZE} reached`);
    return false;
  }
  
  // Check if email is already in whitelist
  if (emailWhitelist.has(senderEmail.toLowerCase())) {
    console.log(`⚠️ Email ${senderEmail} is already in whitelist`);
    return true; // Return true since it's already whitelisted
  }
  
  emailWhitelist.add(senderEmail.toLowerCase());
  persistentStats.emailsWhitelisted = emailWhitelist.size;
  updateLegacyStats();
  
  // Mark that data has changed
  try {
    markDataChanged();
  } catch (error) {
    console.error('Error marking data as changed:', error);
    // Continue with the operation even if this fails
  }
  
  // Update the batching system with the whitelist count change
  updateStatsUnified('emailsWhitelisted').catch(error => {
    console.error('Error updating whitelist stats', error);
  });
  
  // Helper function to rollback changes
  const rollbackChanges = () => {
    emailWhitelist.delete(senderEmail.toLowerCase());
    persistentStats.emailsWhitelisted = emailWhitelist.size;
    updateLegacyStats();
    console.log('🔄 Rolled back whitelist change');
  };

  // Save whitelist and let batching system handle stats
  try {
    console.log('💾 Attempting to save whitelist...', { 
      whitelistSize: emailWhitelist.size, 
      senderEmail: senderEmail.toLowerCase() 
    });
    
    // Create a unified stats object for saveWhitelist with both session and persistent stats
    const unifiedStatsForSave = { 
      session: { emailsScanned: 0, threatsIdentified: 0 }, // Default session stats
      persistent: persistentStats 
    };
    const whitelistSaveSuccess = await saveWhitelist(emailWhitelist, unifiedStatsForSave);
    
    console.log('💾 Save result:', whitelistSaveSuccess);
    
    if (!whitelistSaveSuccess) {
      console.error('Failed to save whitelist changes');
      rollbackChanges();
      return false;
    }
    
    console.log(`✅ Added ${senderEmail} to whitelist`);
    
    return true;
  } catch (error) {
    console.error('❌ Error saving whitelist changes:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      senderEmail: senderEmail,
      whitelistSize: emailWhitelist.size
    });
    
    rollbackChanges();
    return false;
  }
}

module.exports = addToWhitelist;
