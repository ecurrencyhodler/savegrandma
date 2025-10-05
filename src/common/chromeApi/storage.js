/**
 * Chrome Storage API Abstraction
 * Provides consistent, promise-based access to chrome.storage.local with proper error handling
 */

class ChromeStorageAPI {
  /**
   * Get data from chrome.storage.local
   * @param {string|string[]|object} keys - Key(s) to retrieve
   * @returns {Promise<object>} Retrieved data
   */
  static async get(keys) {
    if (!this.isAvailable()) {
      throw new Error('Chrome storage API not available');
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Storage get failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeStorageAPI.get error:', error);
          reject(error);
        } else {
          console.log('ChromeStorageAPI.get success:', { keys, result });
          resolve(result);
        }
      });
    });
  }

  /**
   * Set data in chrome.storage.local
   * @param {object} data - Data to store
   * @returns {Promise<void>}
   */
  static async set(data) {
    if (!this.isAvailable()) {
      throw new Error('Chrome storage API not available');
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Storage set failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeStorageAPI.set error:', error);
          reject(error);
        } else {
          console.log('ChromeStorageAPI.set success:', data);
          resolve();
        }
      });
    });
  }

  /**
   * Remove data from chrome.storage.local
   * @param {string|string[]} keys - Key(s) to remove
   * @returns {Promise<void>}
   */
  static async remove(keys) {
    if (!this.isAvailable()) {
      throw new Error('Chrome storage API not available');
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Storage remove failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeStorageAPI.remove error:', error);
          reject(error);
        } else {
          console.log('ChromeStorageAPI.remove success:', keys);
          resolve();
        }
      });
    });
  }

  /**
   * Clear all data from chrome.storage.local
   * @returns {Promise<void>}
   */
  static async clear() {
    if (!this.isAvailable()) {
      throw new Error('Chrome storage API not available');
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Storage clear failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeStorageAPI.clear error:', error);
          reject(error);
        } else {
          console.log('ChromeStorageAPI.clear success');
          resolve();
        }
      });
    });
  }

  /**
   * Get storage usage information
   * @returns {Promise<object>} Usage information
   */
  static async getUsage() {
    if (!this.isAvailable()) {
      throw new Error('Chrome storage API not available');
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Storage usage check failed: ${chrome.runtime.lastError.message}`);
          console.error('ChromeStorageAPI.getUsage error:', error);
          reject(error);
        } else {
          const usage = {
            bytesInUse,
            quota: chrome.storage.local.QUOTA_BYTES || 5242880, // 5MB default
            percentage: (bytesInUse / (chrome.storage.local.QUOTA_BYTES || 5242880)) * 100
          };
          console.log('ChromeStorageAPI.getUsage success:', usage);
          resolve(usage);
        }
      });
    });
  }

  /**
   * Check if Chrome storage API is available
   * @returns {boolean}
   */
  static isAvailable() {
    return !!(chrome && chrome.storage && chrome.storage.local);
  }

  /**
   * Validate data size before saving (Chrome storage limit is ~5MB)
   * @param {any} data - Data to validate
   * @param {number} maxSize - Maximum size in bytes (default: 4MB)
   * @returns {boolean} True if data size is acceptable
   */
  static validateDataSize(data, maxSize = 4 * 1024 * 1024) {
    const dataSize = JSON.stringify(data).length;
    if (dataSize > maxSize) {
      console.error(`Data too large: ${dataSize} bytes (max: ${maxSize})`);
      return false;
    }
    return true;
  }
}

module.exports = ChromeStorageAPI;
