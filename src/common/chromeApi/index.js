/**
 * Centralized Chrome API Module
 * Provides unified access to all Chrome extension APIs with consistent error handling
 */

const ChromeStorageAPI = require('./storage');
const ChromeMessagingAPI = require('./messaging');

class ChromeAPI {
  /**
   * Get the current Chrome extension context
   * @returns {string} Context type: 'popup', 'content-script', 'background', 'none', or 'unknown'
   */
  static getContext() {
    if (typeof chrome === 'undefined') {
      return 'none';
    }
    
    if (chrome.tabs && chrome.storage) {
      return 'popup';
    }
    
    if (chrome.storage && !chrome.tabs) {
      return 'content-script';
    }
    
    if (chrome.runtime && !chrome.storage) {
      return 'background';
    }
    
    return 'unknown';
  }

  /**
   * Check if Chrome extension APIs are available
   * @returns {boolean}
   */
  static isAvailable() {
    return !!(typeof chrome !== 'undefined' && 
              chrome.runtime && 
              chrome.storage && 
              chrome.storage.local);
  }

  /**
   * Get extension information
   * @returns {object} Extension info or null if not available
   */
  static getExtensionInfo() {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return {
        id: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        name: chrome.runtime.getManifest().name,
        context: this.getContext()
      };
    } catch (error) {
      console.error('Failed to get extension info:', error);
      return null;
    }
  }

  /**
   * Log Chrome API operations for debugging
   * @param {string} operation - Operation being performed
   * @param {any} data - Data being processed
   * @param {string} level - Log level: 'info', 'warn', 'error'
   */
  static log(operation, data = null, level = 'info') {
    const timestamp = new Date().toISOString();
    const context = this.getContext();
    const message = `[${timestamp}] ChromeAPI.${context}: ${operation}`;
    
    switch (level) {
      case 'warn':
        console.warn(message, data || '');
        break;
      case 'error':
        console.error(message, data || '');
        break;
      default:
        console.log(message, data || '');
    }
  }

  /**
   * Handle Chrome API errors consistently
   * @param {Error} error - Error to handle
   * @param {string} operation - Operation that failed
   * @param {any} context - Additional context
   */
  static handleError(error, operation, context = null) {
    this.log(`${operation} failed: ${error.message}`, context, 'error');
    
    // You could add additional error handling here, such as:
    // - Sending error reports to analytics
    // - Showing user notifications
    // - Fallback behavior
  }

  /**
   * Validate Chrome API availability before operations
   * @param {string} api - API name to check
   * @throws {Error} If API is not available
   */
  static validateAPI(api) {
    if (!this.isAvailable()) {
      throw new Error(`Chrome ${api} API not available`);
    }
  }
}

// Export the main API classes and utilities
module.exports = {
  // Main API classes
  storage: ChromeStorageAPI,
  messaging: ChromeMessagingAPI,
  
  // Utility class
  ChromeAPI,
  
  // Convenience methods
  getContext: () => ChromeAPI.getContext(),
  isAvailable: () => ChromeAPI.isAvailable(),
  getExtensionInfo: () => ChromeAPI.getExtensionInfo(),
  log: (operation, data, level) => ChromeAPI.log(operation, data, level),
  handleError: (error, operation, context) => ChromeAPI.handleError(error, operation, context),
  validateAPI: (api) => ChromeAPI.validateAPI(api)
};
