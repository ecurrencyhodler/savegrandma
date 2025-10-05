// Lock management for SaveGrandma extension
// Prevents concurrent storage operations from corrupting data

// Global save lock to prevent concurrent storage operations
let globalSaveLock = false;
let operationQueue = [];

/**
 * Acquire save lock for storage operations
 */
async function acquireSaveLock() {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (!globalSaveLock) {
        globalSaveLock = true;
        resolve();
      } else {
        // Add to queue and wait
        operationQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

/**
 * Release save lock after storage operation
 */
function releaseSaveLock() {
  globalSaveLock = false;
  if (operationQueue.length > 0) {
    const nextOperation = operationQueue.shift();
    nextOperation();
  }
}

/**
 * Execute operation with save lock
 */
async function executeWithLock(operation, operationName) {
  await acquireSaveLock();
  try {
    console.log(`🔒 Acquired save lock for: ${operationName}`);
    const result = await operation();
    console.log(`🔓 Released save lock for: ${operationName}`);
    return result;
  } finally {
    releaseSaveLock();
  }
}

module.exports = {
  acquireSaveLock,
  releaseSaveLock,
  executeWithLock
};
