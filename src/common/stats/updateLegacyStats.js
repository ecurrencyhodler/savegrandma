const { unifiedStats, sessionStats, persistentStats, extensionStats } = require('./unifiedStats');

/**
 * Update legacy extensionStats for compatibility
 */
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
  persistentStats.totalEmailsScanned = unifiedStats.persistent.totalEmailsScanned;
  persistentStats.lastUpdated = unifiedStats.persistent.lastUpdated;
}

module.exports = updateLegacyStats;
