// Batching configuration
const BATCH_SAVE_DELAY = 2000; // 2 seconds
const MAX_BATCH_SIZE = 50; // Force flush if batch exceeds this size

// Pending updates for batching
let pendingUpdates = {
  emailsScanned: 0,
  threatsIdentified: 0,
  emailsWhitelisted: 0,
  timestamp: Date.now()
};

// Batch save state
let batchSaveTimeout = null;
let isBatchSaving = false;

/**
 * Flush pending updates to storage
 */
async function flushPendingUpdates(saveStatsUnified) {
  if (isBatchSaving || !saveStatsUnified) {
    return;
  }
  
  isBatchSaving = true;
  
  try {
    // Check if there are pending updates
    const hasUpdates = pendingUpdates.emailsScanned > 0 || 
                      pendingUpdates.threatsIdentified > 0 || 
                      pendingUpdates.emailsWhitelisted > 0;
    
    if (hasUpdates) {
      console.log('🔄 Flushing pending updates...', pendingUpdates);
      
      // Apply pending updates to unified stats
      const { unifiedStats } = require('./index.js');
      unifiedStats.session.emailsScanned += pendingUpdates.emailsScanned;
      unifiedStats.session.threatsIdentified += pendingUpdates.threatsIdentified;
      unifiedStats.persistent.emailsWhitelisted += pendingUpdates.emailsWhitelisted;
      
      // Save to storage
      await saveStatsUnified(unifiedStats);
      
      // Reset pending updates
      pendingUpdates.emailsScanned = 0;
      pendingUpdates.threatsIdentified = 0;
      pendingUpdates.emailsWhitelisted = 0;
      pendingUpdates.timestamp = Date.now();
    }
  } catch (error) {
    console.error('Error flushing pending updates:', error);
  } finally {
    isBatchSaving = false;
  }
}

module.exports = {
  BATCH_SAVE_DELAY,
  MAX_BATCH_SIZE,
  pendingUpdates,
  batchSaveTimeout,
  isBatchSaving,
  flushPendingUpdates
};
