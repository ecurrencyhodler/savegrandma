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

// Legacy compatibility objects (populated from unified stats)
let sessionStats = unifiedStats.session;
let persistentStats = unifiedStats.persistent;
let extensionStats = {
  totalEmailsScanned: 0,
  threatsIdentified: 0,
  emailsWhitelisted: 0,
  lastUpdated: Date.now()
};

module.exports = {
  unifiedStats,
  sessionStats,
  persistentStats,
  extensionStats
};
