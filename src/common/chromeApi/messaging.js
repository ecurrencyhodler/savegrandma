/**
 * Chrome Messaging API Abstraction
 * Provides consistent, promise-based access to chrome.runtime messaging with proper error handling
 */

class ChromeMessagingAPI {
  /**
   * Send message to a specific tab
   * @param {number} tabId - Target tab ID
   * @param {any} message - Message to send
   * @param {number} timeout - Timeout in milliseconds (default: 2000)
   * @returns {Promise<any>} Response from the tab
   */
  static async sendMessage(tabId, message, timeout = 2000) {
    if (!this.isAvailable()) {
      throw new Error('Chrome messaging API not available');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Message timeout after ${timeout}ms`);
        console.error('ChromeMessagingAPI.sendMessage timeout:', error);
        reject(error);
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          const error = new Error(`Message failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeMessagingAPI.sendMessage error:', error);
          reject(error);
        } else {
          console.log('ChromeMessagingAPI.sendMessage success:', { tabId, message, response });
          resolve(response);
        }
      });
    });
  }

  /**
   * Send message to all tabs matching a query
   * @param {object} query - Tab query object
   * @param {any} message - Message to send
   * @param {number} timeout - Timeout in milliseconds (default: 2000)
   * @returns {Promise<any[]>} Array of responses from tabs
   */
  static async sendMessageToAllTabs(query, message, timeout = 2000) {
    if (!this.isAvailable()) {
      throw new Error('Chrome messaging API not available');
    }

    try {
      const tabs = await this.getTabs(query);
      const promises = tabs.map(tab => 
        this.sendMessage(tab.id, message, timeout).catch(error => {
          console.warn(`Failed to send message to tab ${tab.id}:`, error);
          return { error: error.message, tabId: tab.id };
        })
      );
      
      const responses = await Promise.allSettled(promises);
      return responses.map(result => result.status === 'fulfilled' ? result.value : result.reason);
    } catch (error) {
      console.error('ChromeMessagingAPI.sendMessageToAllTabs error:', error);
      throw error;
    }
  }

  /**
   * Send message to the extension's background script
   * @param {any} message - Message to send
   * @param {number} timeout - Timeout in milliseconds (default: 2000)
   * @returns {Promise<any>} Response from background script
   */
  static async sendMessageToBackground(message, timeout = 2000) {
    if (!this.isAvailable()) {
      throw new Error('Chrome messaging API not available');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Background message timeout after ${timeout}ms`);
        console.error('ChromeMessagingAPI.sendMessageToBackground timeout:', error);
        reject(error);
      }, timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          const error = new Error(`Background message failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeMessagingAPI.sendMessageToBackground error:', error);
          reject(error);
        } else {
          console.log('ChromeMessagingAPI.sendMessageToBackground success:', { message, response });
          resolve(response);
        }
      });
    });
  }

  /**
   * Setup message listener for incoming messages
   * @param {function} handler - Message handler function
   * @returns {function} Unsubscribe function
   */
  static setupMessageListener(handler) {
    if (!this.isAvailable()) {
      throw new Error('Chrome messaging API not available');
    }

    const messageListener = (message, sender, sendResponse) => {
      try {
        const result = handler(message, sender, sendResponse);
        
        // Handle async responses
        if (result && typeof result.then === 'function') {
          result.then(response => {
            if (sendResponse) sendResponse(response);
          }).catch(error => {
            console.error('Message handler error:', error);
            if (sendResponse) sendResponse({ error: error.message });
          });
          return true; // Keep message channel open for async response
        }
        
        // Handle sync responses
        if (sendResponse && result !== undefined) {
          sendResponse(result);
        }
      } catch (error) {
        console.error('Message listener error:', error);
        if (sendResponse) {
          sendResponse({ error: error.message });
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    
    // Return unsubscribe function
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }

  /**
   * Get tabs matching a query
   * @param {object} query - Tab query object
   * @returns {Promise<chrome.tabs.Tab[]>} Array of matching tabs
   */
  static async getTabs(query = {}) {
    if (!this.isAvailable()) {
      throw new Error('Chrome tabs API not available');
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.query(query, (tabs) => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Tab query failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeMessagingAPI.getTabs error:', error);
          reject(error);
        } else {
          console.log('ChromeMessagingAPI.getTabs success:', { query, tabs: tabs.length });
          resolve(tabs);
        }
      });
    });
  }

  /**
   * Get the current active tab
   * @returns {Promise<chrome.tabs.Tab>} Current active tab
   */
  static async getCurrentTab() {
    const tabs = await this.getTabs({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  /**
   * Check if Chrome messaging API is available
   * @returns {boolean}
   */
  static isAvailable() {
    return !!(chrome && chrome.runtime && chrome.tabs);
  }

  /**
   * Check if we're in a context that can send messages
   * @returns {boolean}
   */
  static canSendMessages() {
    return this.isAvailable() && !!(chrome.tabs && chrome.tabs.sendMessage);
  }

  /**
   * Check if we're in a context that can receive messages
   * @returns {boolean}
   */
  static canReceiveMessages() {
    return this.isAvailable() && !!(chrome.runtime && chrome.runtime.onMessage);
  }
}

module.exports = ChromeMessagingAPI;
