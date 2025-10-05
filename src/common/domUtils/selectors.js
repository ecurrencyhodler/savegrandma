// Email row selectors (multiple fallbacks for robustness)
const EMAIL_ROW_SELECTORS = [
  '.zA',                    // Primary Gmail email row class (50 elements found)
  'tr[role="button"]',      // Alternative selector
  'div[role="main"] tr',    // Main content area rows (52 elements found)
  '[data-legacy-thread-id]' // Data attribute based (100 elements found)
];

// Email content selectors (based on exploration results)
const EMAIL_SELECTORS = {
  sender: ['.yP', '[email]'],           // .yP found 124 elements, [email] found 112 elements
  subject: ['.y6', '.bog'],             // Both found 50 elements each
  snippet: ['.y2'],                     // Found 50 elements
  body: ['.ii', '.adP'],
  threadId: ['[data-legacy-thread-id]'], // Found 100 elements
  messageId: ['[data-message-id]']
};

module.exports = {
  EMAIL_ROW_SELECTORS,
  EMAIL_SELECTORS
};
