// Storage module exports
const isChromeContextValid = require('./isChromeContextValid');
const getGmailAccountId = require('./getGmailAccountId');
const generateWhitelistHash = require('./generateWhitelistHash');
const { captureInitialState, hasMeaningfulChanges, markDataChanged, resetTrackingState } = require('./captureInitialState');
const loadStats = require('./loadStats');
const saveStatsUnified = require('./saveStatsUnified');
const loadWhitelist = require('./loadWhitelist');
const saveWhitelist = require('./saveWhitelist');

module.exports = {
  isChromeContextValid,
  getGmailAccountId,
  generateWhitelistHash,
  captureInitialState,
  hasMeaningfulChanges,
  markDataChanged,
  resetTrackingState,
  loadStats,
  saveStatsUnified,
  loadWhitelist,
  saveWhitelist
};
