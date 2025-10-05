const { unifiedStats } = require('./unifiedStats');
const updateLegacyStats = require('./updateLegacyStats');

/**
 * Reset session statistics to start fresh
 */
function resetSessionStats() {
  unifiedStats.session = {
    emailsScanned: 0,
    threatsIdentified: 0,
    sessionStartTime: Date.now()
  };
  updateLegacyStats();
  
  console.log('🔄 Session stats reset - starting fresh count');
}

module.exports = resetSessionStats;
