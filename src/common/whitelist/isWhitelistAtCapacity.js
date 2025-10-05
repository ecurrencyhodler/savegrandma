const { MAX_WHITELIST_SIZE } = require('../constants');
const emailWhitelist = require('./emailWhitelist');

/**
 * Check if whitelist is at capacity
 */
function isWhitelistAtCapacity() {
  return emailWhitelist.size >= MAX_WHITELIST_SIZE;
}

module.exports = isWhitelistAtCapacity;
