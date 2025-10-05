// Email analysis cache management
const { MAX_CACHE_SIZE, CACHE_EXPIRY_TIME, CACHE_FORCE_CLEANUP_THRESHOLD } = require('./constants.js');

// Store analysis data for emails so we can re-add icons after DOM changes
const emailAnalysisCache = new Map();

/**
 * Clean up expired cache entries and maintain size limits
 */
function cleanupCache() {
  const now = Date.now();
  const entries = Array.from(emailAnalysisCache.entries());
  
  // Remove expired entries
  for (const [key, value] of entries) {
    if (now - value.timestamp > CACHE_EXPIRY_TIME) {
      emailAnalysisCache.delete(key);
    }
  }
  
  // If still over limit, remove oldest entries
  if (emailAnalysisCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(emailAnalysisCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = sortedEntries.slice(0, emailAnalysisCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      emailAnalysisCache.delete(key);
    }
  }
  
  // Force cleanup if cache is getting too large
  if (emailAnalysisCache.size > CACHE_FORCE_CLEANUP_THRESHOLD) {
    emailAnalysisCache.clear();
  }
}

/**
 * Check if an email thread needs analysis based on cache
 */
function needsAnalysis(threadId) {
  const cached = emailAnalysisCache.get(threadId);
  if (!cached) return true;
  
  const now = Date.now();
  return (now - cached.timestamp) > CACHE_EXPIRY_TIME;
}

/**
 * Store analysis result in cache
 */
function cacheAnalysis(threadId, analysis, emailData) {
  emailAnalysisCache.set(threadId, {
    analysis,
    emailData,
    timestamp: Date.now()
  });
  
  // Periodic cleanup
  if (emailAnalysisCache.size > MAX_CACHE_SIZE * 0.8) {
    cleanupCache();
  }
}

module.exports = {
  emailAnalysisCache,
  cleanupCache,
  needsAnalysis,
  cacheAnalysis
};
