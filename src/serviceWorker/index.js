/**
 * Service Worker for SaveGrandma Extension
 * Handles communication between content scripts and popup
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message);
  
  if (message.action === 'whitelistUpdated') {
    // Forward the message to all popup instances
    chrome.runtime.sendMessage(message).catch(error => {
      console.log('No popup listening for whitelist update:', error);
    });
    
    sendResponse({ success: true });
    return true; // Keep message channel open for async response
  }
  
  // Handle other message types as needed
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

console.log('SaveGrandma service worker initialized');








