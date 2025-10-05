/**
 * Check if Chrome context is valid for storage operations
 */
function isChromeContextValid() {
  return !!(chrome && chrome.storage && chrome.storage.local);
}

module.exports = isChromeContextValid;
