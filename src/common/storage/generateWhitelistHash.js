/**
 * Generate whitelist content hash for change detection
 */
function generateWhitelistHash(emailWhitelist) {
  const sortedEmails = Array.from(emailWhitelist).sort();
  return sortedEmails.join('|');
}

module.exports = generateWhitelistHash;
