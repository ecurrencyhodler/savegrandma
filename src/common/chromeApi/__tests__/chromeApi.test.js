/**
 * Tests for Chrome API abstractions
 */

const { storage, messaging, ChromeAPI } = require('../index.js');

// Mock Chrome APIs for testing
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getBytesInUse: jest.fn(),
      QUOTA_BYTES: 5242880
    }
  },
  runtime: {
    lastError: null,
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    sendMessage: jest.fn(),
    query: jest.fn()
  }
};

describe('ChromeAPI', () => {
  beforeEach(() => {
    global.chrome = mockChrome;
    jest.clearAllMocks();
    global.chrome.runtime.lastError = null;
  });

  describe('getContext', () => {
    it('should return popup context when tabs and storage are available', () => {
      expect(ChromeAPI.getContext()).toBe('popup');
    });

    it('should return none when chrome is undefined', () => {
      delete global.chrome;
      expect(ChromeAPI.getContext()).toBe('none');
      global.chrome = mockChrome;
    });
  });

  describe('isAvailable', () => {
    it('should return true when Chrome APIs are available', () => {
      expect(ChromeAPI.isAvailable()).toBe(true);
    });
  });

  describe('log', () => {
    it('should log messages with timestamp and context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      ChromeAPI.log('test operation', { data: 'test' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] ChromeAPI\.popup: test operation/),
        { data: 'test' }
      );
      consoleSpy.mockRestore();
    });
  });
});

describe('ChromeStorageAPI', () => {
  beforeEach(() => {
    global.chrome = mockChrome;
    jest.clearAllMocks();
    global.chrome.runtime.lastError = null;
  });

  describe('get', () => {
    it('should resolve with data when successful', async () => {
      const mockData = { key1: 'value1' };
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await storage.get(['key1']);
      expect(result).toEqual(mockData);
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['key1'], expect.any(Function));
    });

    it('should reject with error when chrome.runtime.lastError is set', async () => {
      global.chrome.runtime.lastError = { message: 'Storage error' };
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await expect(storage.get(['key1'])).rejects.toThrow('Storage get failed: Storage error');
    });

    it('should throw error when Chrome storage is not available', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      await expect(storage.get(['key1'])).rejects.toThrow('Chrome storage API not available');
      
      global.chrome = originalChrome;
    });
  });

  describe('set', () => {
    it('should resolve when successful', async () => {
      global.chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await expect(storage.set({ key1: 'value1' })).resolves.toBeUndefined();
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ key1: 'value1' }, expect.any(Function));
    });

    it('should reject with error when chrome.runtime.lastError is set', async () => {
      global.chrome.runtime.lastError = { message: 'Storage error' };
      global.chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await expect(storage.set({ key1: 'value1' })).rejects.toThrow('Storage set failed: Storage error');
    });
  });

  describe('validateDataSize', () => {
    it('should return true for data under size limit', () => {
      const smallData = { key: 'value' };
      expect(storage.validateDataSize(smallData)).toBe(true);
    });

    it('should return false for data over size limit', () => {
      const largeData = { key: 'x'.repeat(5 * 1024 * 1024) }; // 5MB string
      expect(storage.validateDataSize(largeData)).toBe(false);
    });
  });
});

describe('ChromeMessagingAPI', () => {
  beforeEach(() => {
    global.chrome = mockChrome;
    jest.clearAllMocks();
    global.chrome.runtime.lastError = null;
  });

  describe('sendMessage', () => {
    it('should resolve with response when successful', async () => {
      const mockResponse = { success: true };
      global.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(mockResponse);
      });

      const result = await messaging.sendMessage(123, { action: 'test' });
      expect(result).toEqual(mockResponse);
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(123, { action: 'test' }, expect.any(Function));
    });

    it('should reject with error when chrome.runtime.lastError is set', async () => {
      global.chrome.runtime.lastError = { message: 'Message error' };
      global.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({});
      });

      await expect(messaging.sendMessage(123, { action: 'test' })).rejects.toThrow('Message failed: Message error');
    });

    it('should timeout after specified duration', async () => {
      jest.useFakeTimers();
      global.chrome.tabs.sendMessage.mockImplementation(() => {
        // Don't call callback to simulate timeout
      });

      const promise = messaging.sendMessage(123, { action: 'test' }, 1000);
      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Message timeout after 1000ms');
      jest.useRealTimers();
    });
  });

  describe('setupMessageListener', () => {
    it('should setup message listener and return unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = messaging.setupMessageListener(handler);

      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
      expect(typeof unsubscribe).toBe('function');

      // Test unsubscribe
      unsubscribe();
      expect(global.chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    });
  });

  describe('canSendMessages', () => {
    it('should return true when messaging APIs are available', () => {
      expect(messaging.canSendMessages()).toBe(true);
    });

    it('should return false when chrome.tabs is not available', () => {
      const originalTabs = global.chrome.tabs;
      delete global.chrome.tabs;
      expect(messaging.canSendMessages()).toBe(false);
      global.chrome.tabs = originalTabs;
    });
  });
});