const { extensionStats } = require('./unifiedStats');
const { messaging, ChromeAPI } = require('../chromeApi/index.js');

/**
 * Send popup notification with current stats
 */
function batchPopupNotification() {
  // Send immediate popup notification (no batching needed since it's only called at end of scan)
  if (messaging.canSendMessages()) {
    try {
      ChromeAPI.log('batchPopupNotification', { stats: extensionStats });
      messaging.sendMessageToBackground({
        action: 'updateStats',
        stats: extensionStats
      }).then(() => {
        console.log('📤 End-of-scan popup notification sent');
      }).catch(error => {
        ChromeAPI.handleError(error, 'batchPopupNotification', { stats: extensionStats });
      });
    } catch (error) {
      ChromeAPI.handleError(error, 'batchPopupNotification', { stats: extensionStats });
    }
  } else {
    console.log('Chrome context not valid, skipping popup notification');
  }
}

module.exports = batchPopupNotification;
