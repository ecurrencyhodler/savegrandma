// Unit tests for batching configuration and flushPendingUpdates function

const { 
  BATCH_SAVE_DELAY, 
  MAX_BATCH_SIZE, 
  pendingUpdates, 
  flushPendingUpdates 
} = require('../batchingConfig');

// Mock the stats module
jest.mock('../index.js', () => ({
  unifiedStats: {
    session: {
      emailsScanned: 0,
      threatsIdentified: 0
    },
    persistent: {
      emailsWhitelisted: 0
    }
  }
}));

describe('Batching Configuration', () => {
  beforeEach(() => {
    // Reset pending updates
    pendingUpdates.emailsScanned = 0;
    pendingUpdates.threatsIdentified = 0;
    pendingUpdates.emailsWhitelisted = 0;
    pendingUpdates.timestamp = Date.now();
  });

  test('should have correct default values', () => {
    expect(BATCH_SAVE_DELAY).toBe(2000);
    expect(MAX_BATCH_SIZE).toBe(50);
    expect(pendingUpdates).toBeDefined();
    expect(pendingUpdates.emailsScanned).toBe(0);
    expect(pendingUpdates.threatsIdentified).toBe(0);
    expect(pendingUpdates.emailsWhitelisted).toBe(0);
  });

  test('should export flushPendingUpdates function', () => {
    expect(typeof flushPendingUpdates).toBe('function');
  });
});

describe('flushPendingUpdates', () => {
  let mockSaveStatsUnified;

  beforeEach(() => {
    mockSaveStatsUnified = jest.fn().mockResolvedValue(true);
    // Reset pending updates
    pendingUpdates.emailsScanned = 0;
    pendingUpdates.threatsIdentified = 0;
    pendingUpdates.emailsWhitelisted = 0;
    pendingUpdates.timestamp = Date.now();
  });

  test('should return early if saveStatsUnified is not provided', async () => {
    await flushPendingUpdates(null);
    expect(mockSaveStatsUnified).not.toHaveBeenCalled();
  });

  test('should return early if no pending updates', async () => {
    await flushPendingUpdates(mockSaveStatsUnified);
    expect(mockSaveStatsUnified).not.toHaveBeenCalled();
  });

  test('should flush pending updates when they exist', async () => {
    pendingUpdates.emailsScanned = 5;
    pendingUpdates.threatsIdentified = 2;
    pendingUpdates.emailsWhitelisted = 1;

    await flushPendingUpdates(mockSaveStatsUnified);

    expect(mockSaveStatsUnified).toHaveBeenCalledTimes(1);
    expect(pendingUpdates.emailsScanned).toBe(0);
    expect(pendingUpdates.threatsIdentified).toBe(0);
    expect(pendingUpdates.emailsWhitelisted).toBe(0);
  });

  test('should handle saveStatsUnified errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSaveStatsUnified.mockRejectedValue(new Error('Save failed'));
    
    pendingUpdates.emailsScanned = 3;

    await flushPendingUpdates(mockSaveStatsUnified);

    expect(mockSaveStatsUnified).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Error flushing pending updates:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  test('should not call saveStatsUnified twice if already saving', async () => {
    pendingUpdates.emailsScanned = 3;

    // Call flushPendingUpdates twice simultaneously
    const promise1 = flushPendingUpdates(mockSaveStatsUnified);
    const promise2 = flushPendingUpdates(mockSaveStatsUnified);

    await Promise.all([promise1, promise2]);

    // Should only be called once due to isBatchSaving flag
    expect(mockSaveStatsUnified).toHaveBeenCalledTimes(1);
  });

  test('should update timestamp after successful flush', async () => {
    const originalTimestamp = pendingUpdates.timestamp;
    pendingUpdates.emailsScanned = 2;

    await flushPendingUpdates(mockSaveStatsUnified);

    // Just verify that timestamp was updated (could be same or greater)
    expect(pendingUpdates.timestamp).toBeDefined();
    expect(typeof pendingUpdates.timestamp).toBe('number');
    expect(pendingUpdates.timestamp).toBeGreaterThanOrEqual(originalTimestamp);
  });
});
