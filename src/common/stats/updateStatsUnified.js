const { markDataChanged } = require('../storage');
const updateInMemoryStats = require('./updateInMemoryStats');
const { BATCH_SAVE_DELAY, MAX_BATCH_SIZE, pendingUpdates, flushPendingUpdates } = require('./batchingConfig');

// Track batch save timeout locally
let batchSaveTimeout = null;

/**
 * Update unified statistics with batching
 */
async function updateStatsUnified(type, increment = 1) {
  // Validate input
  if (!['emailsScanned', 'threatsIdentified', 'emailsWhitelisted'].includes(type)) {
    console.error(`Invalid stats type: ${type}`);
    return;
  }
  
  if (increment < 0) {
    console.error(`Negative increment not allowed: ${increment}`);
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
  batchSaveTimeout = setTimeout(async () => {
    const { saveStatsUnified } = require('../storage');
    await flushPendingUpdates(saveStatsUnified);
  }, BATCH_SAVE_DELAY);
  
  // Force flush if batch gets too large
  if (pendingUpdates.emailsScanned + pendingUpdates.threatsIdentified + pendingUpdates.emailsWhitelisted > MAX_BATCH_SIZE) {
    if (batchSaveTimeout) {
      clearTimeout(batchSaveTimeout);
    }
    const { saveStatsUnified } = require('../storage');
    await flushPendingUpdates(saveStatsUnified);
  }
}

module.exports = updateStatsUnified;
