/**
 * Find elements using multiple selectors
 */
function findElements(selectors) {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return elements;
      }
    } catch (e) {
      // Invalid selector, try next
      continue;
    }
  }
  return [];
}

module.exports = findElements;
