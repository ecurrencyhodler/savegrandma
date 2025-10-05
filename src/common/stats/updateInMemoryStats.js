const { unifiedStats } = require('./unifiedStats');
const updateLegacyStats = require('./updateLegacyStats');

/**
 * Update in-memory stats immediately (for UI responsiveness)
 */
function updateInMemoryStats(type, increment) {
  switch (type) {
    case 'emailsScanned':
      unifiedStats.session.emailsScanned += increment;
      unifiedStats.persistent.totalEmailsScanned += increment;
      break;
    case 'threatsIdentified':
      unifiedStats.session.threatsIdentified += increment;
      unifiedStats.persistent.totalThreatsEverFound += increment;
      break;
    case 'emailsWhitelisted':
      unifiedStats.persistent.emailsWhitelisted += increment;
      break;
  }
  
  // Update legacy compatibility objects
  updateLegacyStats();
}

module.exports = updateInMemoryStats;
