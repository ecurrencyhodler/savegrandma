const emailWhitelist = require('./emailWhitelist');

/**
 * Get whitelist size
 */
function getWhitelistSize() {
  return emailWhitelist.size;
}

module.exports = getWhitelistSize;
