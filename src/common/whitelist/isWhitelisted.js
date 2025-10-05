const emailWhitelist = require('./emailWhitelist');

/**
 * Check if an email is whitelisted
 */
function isWhitelisted(senderEmail) {
  if (!senderEmail) return false;
  return emailWhitelist.has(senderEmail.toLowerCase());
}

module.exports = isWhitelisted;
