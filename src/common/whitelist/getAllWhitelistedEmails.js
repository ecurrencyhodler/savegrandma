const emailWhitelist = require('./emailWhitelist');

/**
 * Get all whitelisted emails
 */
function getAllWhitelistedEmails() {
  return Array.from(emailWhitelist);
}

module.exports = getAllWhitelistedEmails;
