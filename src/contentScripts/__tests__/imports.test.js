// Unit tests for content script imports

describe('Content Script Imports', () => {
  test('should be able to import domUtils module', () => {
    expect(() => {
      const domUtils = require('../../common/domUtils/index.js');
      expect(domUtils).toBeDefined();
      expect(domUtils.addVisualStyles).toBeDefined();
      expect(typeof domUtils.addVisualStyles).toBe('function');
    }).not.toThrow();
  });

  test('should be able to import cache module', () => {
    expect(() => {
      const cache = require('../../common/cache.js');
      expect(cache).toBeDefined();
      expect(cache.emailAnalysisCache).toBeDefined();
      expect(cache.cleanupCache).toBeDefined();
      expect(typeof cache.cleanupCache).toBe('function');
    }).not.toThrow();
  });

  test('should be able to import locking module', () => {
    expect(() => {
      const locking = require('../../common/locking.js');
      expect(locking).toBeDefined();
      expect(locking.executeWithLock).toBeDefined();
      expect(typeof locking.executeWithLock).toBe('function');
    }).not.toThrow();
  });

  test('should be able to import stats module', () => {
    expect(() => {
      const stats = require('../../common/stats/index.js');
      expect(stats).toBeDefined();
      expect(stats.unifiedStats).toBeDefined();
      expect(stats.resetSessionStats).toBeDefined();
      expect(typeof stats.resetSessionStats).toBe('function');
    }).not.toThrow();
  });

  test('should be able to import whitelist module', () => {
    expect(() => {
      const whitelist = require('../../common/whitelist/index.js');
      expect(whitelist).toBeDefined();
      expect(whitelist.emailWhitelist).toBeDefined();
      expect(whitelist.isWhitelisted).toBeDefined();
      expect(typeof whitelist.isWhitelisted).toBe('function');
    }).not.toThrow();
  });

  test('should be able to import storage module', () => {
    expect(() => {
      const storage = require('../../common/storage/index.js');
      expect(storage).toBeDefined();
      expect(storage.loadStats).toBeDefined();
      expect(storage.saveStatsUnified).toBeDefined();
      expect(typeof storage.loadStats).toBe('function');
      expect(typeof storage.saveStatsUnified).toBe('function');
    }).not.toThrow();
  });

  test('should be able to import all required modules for content script', () => {
    expect(() => {
      // Test the exact imports used in the content script
      const { emailAnalysisCache, cleanupCache, needsAnalysis, cacheAnalysis } = require('../../common/cache.js');
      const { executeWithLock } = require('../../common/locking.js');
      const { 
        unifiedStats, 
        sessionStats, 
        persistentStats, 
        extensionStats,
        resetSessionStats, 
        updateStatsUnified, 
        batchPopupNotification,
        updateLegacyStats
      } = require('../../common/stats/index.js');
      const { 
        emailWhitelist,
        isWhitelisted,
        isWhitelistAtCapacity,
        addToWhitelist,
        getWhitelistSize,
        getAllWhitelistedEmails
      } = require('../../common/whitelist/index.js');
      const {
        loadStats,
        saveStatsUnified,
        loadWhitelist,
        captureInitialState,
        getGmailAccountId,
        isChromeContextValid
      } = require('../../common/storage/index.js');
      const {
        EMAIL_ROW_SELECTORS,
        EMAIL_SELECTORS,
        findElements,
        extractEmailData,
        isElementVisible,
        waitForElement,
        addVisualStyles
      } = require('../../common/domUtils/index.js');

      // Verify all imports are defined
      expect(emailAnalysisCache).toBeDefined();
      expect(cleanupCache).toBeDefined();
      expect(executeWithLock).toBeDefined();
      expect(unifiedStats).toBeDefined();
      expect(emailWhitelist).toBeDefined();
      expect(loadStats).toBeDefined();
      expect(EMAIL_ROW_SELECTORS).toBeDefined();
      expect(addVisualStyles).toBeDefined();
    }).not.toThrow();
  });

  test('should have correct function types for all imported functions', () => {
    const { addVisualStyles } = require('../../common/domUtils/index.js');
    const { executeWithLock } = require('../../common/locking.js');
    const { resetSessionStats } = require('../../common/stats/index.js');
    const { isWhitelisted } = require('../../common/whitelist/index.js');
    const { loadStats } = require('../../common/storage/index.js');

    expect(typeof addVisualStyles).toBe('function');
    expect(typeof executeWithLock).toBe('function');
    expect(typeof resetSessionStats).toBe('function');
    expect(typeof isWhitelisted).toBe('function');
    expect(typeof loadStats).toBe('function');
  });
});
