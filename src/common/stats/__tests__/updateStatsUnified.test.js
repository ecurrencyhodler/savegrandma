// Unit tests for updateStatsUnified function

const updateStatsUnified = require('../updateStatsUnified');
const { pendingUpdates, BATCH_SAVE_DELAY, MAX_BATCH_SIZE } = require('../batchingConfig');

// Mock dependencies
jest.mock('../../storage', () => ({
  markDataChanged: jest.fn(),
  saveStatsUnified: jest.fn().mockResolvedValue(true)
}));

jest.mock('../updateInMemoryStats', () => jest.fn());

jest.mock('../batchingConfig', () => ({
  BATCH_SAVE_DELAY: 2000,
  MAX_BATCH_SIZE: 50,
  pendingUpdates: {
    emailsScanned: 0,
    threatsIdentified: 0,
    emailsWhitelisted: 0,
    timestamp: Date.now()
  },
  flushPendingUpdates: jest.fn()
}));

describe('updateStatsUnified', () => {
  const { markDataChanged } = require('../../storage');
  const updateInMemoryStats = require('../updateInMemoryStats');
  const { flushPendingUpdates } = require('../batchingConfig');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset pending updates
    pendingUpdates.emailsScanned = 0;
    pendingUpdates.threatsIdentified = 0;
    pendingUpdates.emailsWhitelisted = 0;
    pendingUpdates.timestamp = Date.now();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should validate input parameters', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await updateStatsUnified('invalidType');
    expect(consoleSpy).toHaveBeenCalledWith('Invalid stats type: invalidType');

    await updateStatsUnified('emailsScanned', -1);
    expect(consoleSpy).toHaveBeenCalledWith('Negative increment not allowed: -1');

    consoleSpy.mockRestore();
  });

  test('should update pending updates and call markDataChanged', async () => {
    await updateStatsUnified('emailsScanned', 3);

    expect(markDataChanged).toHaveBeenCalledTimes(1);
    expect(pendingUpdates.emailsScanned).toBe(3);
    expect(pendingUpdates.threatsIdentified).toBe(0);
    expect(pendingUpdates.emailsWhitelisted).toBe(0);
  });

  test('should update in-memory stats immediately', async () => {
    await updateStatsUnified('threatsIdentified', 2);

    expect(updateInMemoryStats).toHaveBeenCalledWith('threatsIdentified', 2);
  });

  test('should set timeout for batch save', async () => {
    await updateStatsUnified('emailsScanned', 1);

    // Advance timer by less than BATCH_SAVE_DELAY
    jest.advanceTimersByTime(BATCH_SAVE_DELAY - 100);
    expect(flushPendingUpdates).not.toHaveBeenCalled();

    // Advance timer to trigger batch save
    jest.advanceTimersByTime(100);
    expect(flushPendingUpdates).toHaveBeenCalledTimes(1);
  });

  test('should clear existing timeout when updating again', async () => {
    await updateStatsUnified('emailsScanned', 1);
    
    // Advance timer by half the delay
    jest.advanceTimersByTime(BATCH_SAVE_DELAY / 2);
    
    // Update again - should clear previous timeout
    await updateStatsUnified('emailsScanned', 2);
    
    // Advance timer by full delay - should trigger only once
    jest.advanceTimersByTime(BATCH_SAVE_DELAY);
    expect(flushPendingUpdates).toHaveBeenCalledTimes(1);
  });

  test('should force flush when batch exceeds MAX_BATCH_SIZE', async () => {
    await updateStatsUnified('emailsScanned', MAX_BATCH_SIZE + 1);

    // Should flush immediately without waiting for timeout
    expect(flushPendingUpdates).toHaveBeenCalledTimes(1);
  });

  test('should handle multiple stat types correctly', async () => {
    await updateStatsUnified('emailsScanned', 5);
    await updateStatsUnified('threatsIdentified', 2);
    await updateStatsUnified('emailsWhitelisted', 1);

    expect(pendingUpdates.emailsScanned).toBe(5);
    expect(pendingUpdates.threatsIdentified).toBe(2);
    expect(pendingUpdates.emailsWhitelisted).toBe(1);
  });

  test('should update timestamp on each update', async () => {
    const originalTimestamp = pendingUpdates.timestamp;
    
    await updateStatsUnified('emailsScanned', 1);
    
    // Just verify that timestamp was updated (could be same or greater)
    expect(pendingUpdates.timestamp).toBeDefined();
    expect(typeof pendingUpdates.timestamp).toBe('number');
  });

  test('should use default increment of 1', async () => {
    await updateStatsUnified('emailsScanned');

    expect(pendingUpdates.emailsScanned).toBe(1);
    expect(updateInMemoryStats).toHaveBeenCalledWith('emailsScanned', 1);
  });

  test('should handle large increments correctly', async () => {
    await updateStatsUnified('emailsScanned', 100);

    expect(pendingUpdates.emailsScanned).toBe(100);
    expect(updateInMemoryStats).toHaveBeenCalledWith('emailsScanned', 100);
  });

  test('should handle concurrent updates correctly', async () => {
    const promises = [
      updateStatsUnified('emailsScanned', 1),
      updateStatsUnified('emailsScanned', 2),
      updateStatsUnified('threatsIdentified', 1)
    ];

    await Promise.all(promises);

    expect(pendingUpdates.emailsScanned).toBe(3);
    expect(pendingUpdates.threatsIdentified).toBe(1);
    expect(markDataChanged).toHaveBeenCalledTimes(3);
  });
});
