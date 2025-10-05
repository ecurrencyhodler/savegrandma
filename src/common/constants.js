// Constants used across the SaveGrandma extension

// Cache management constants
const MAX_CACHE_SIZE = 200;
const CACHE_EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_FORCE_CLEANUP_THRESHOLD = 250; // Force cleanup if cache exceeds this size

// Whitelist management constants
const MAX_WHITELIST_SIZE = 10000;

// Save failure tracking
const MAX_SAVE_FAILURES = 3;

module.exports = {
  MAX_CACHE_SIZE,
  CACHE_EXPIRY_TIME,
  CACHE_FORCE_CLEANUP_THRESHOLD,
  MAX_WHITELIST_SIZE,
  MAX_SAVE_FAILURES
};
