// Stats module exports
const { unifiedStats, sessionStats, persistentStats, extensionStats } = require('./unifiedStats');
const resetSessionStats = require('./resetSessionStats');
const updateInMemoryStats = require('./updateInMemoryStats');
const updateStatsUnified = require('./updateStatsUnified');
const batchPopupNotification = require('./batchPopupNotification');
const updateLegacyStats = require('./updateLegacyStats');

module.exports = {
  unifiedStats,
  sessionStats,
  persistentStats,
  extensionStats,
  resetSessionStats,
  updateInMemoryStats,
  updateStatsUnified,
  batchPopupNotification,
  updateLegacyStats
};
