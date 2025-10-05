const generateWhitelistHash = require('./generateWhitelistHash');

// Change tracking to avoid unnecessary saves
let initialStatsState = null;
let hasDataChanged = false;
let initialWhitelistHash = null;

/**
 * Capture initial state for change tracking
 */
function captureInitialState(unifiedStats, emailWhitelist) {
  initialStatsState = {
    emailsScanned: unifiedStats.session.emailsScanned,
    threatsIdentified: unifiedStats.session.threatsIdentified,
    totalThreatsEverFound: unifiedStats.persistent.totalThreatsEverFound,
    emailsWhitelisted: unifiedStats.persistent.emailsWhitelisted,
    totalEmailsScanned: unifiedStats.persistent.totalEmailsScanned,
    whitelistSize: emailWhitelist.size
  };
  initialWhitelistHash = generateWhitelistHash(emailWhitelist);
  hasDataChanged = false;
}

/**
 * Check if meaningful changes have occurred
 */
function hasMeaningfulChanges(unifiedStats, emailWhitelist) {
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

/**
 * Mark that data has changed
 */
function markDataChanged() {
  hasDataChanged = true;
}

/**
 * Reset all tracking state (useful for testing or cleanup)
 */
function resetTrackingState() {
  initialStatsState = null;
  hasDataChanged = false;
  initialWhitelistHash = null;
}

module.exports = {
  captureInitialState,
  hasMeaningfulChanges,
  markDataChanged,
  resetTrackingState
};
