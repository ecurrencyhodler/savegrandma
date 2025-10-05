// Unit tests for domUtils module exports

const domUtils = require('../index');

describe('domUtils module exports', () => {
  test('should export EMAIL_ROW_SELECTORS', () => {
    expect(domUtils.EMAIL_ROW_SELECTORS).toBeDefined();
    expect(Array.isArray(domUtils.EMAIL_ROW_SELECTORS)).toBe(true);
    expect(domUtils.EMAIL_ROW_SELECTORS.length).toBeGreaterThan(0);
  });

  test('should export EMAIL_SELECTORS', () => {
    expect(domUtils.EMAIL_SELECTORS).toBeDefined();
    expect(typeof domUtils.EMAIL_SELECTORS).toBe('object');
    expect(domUtils.EMAIL_SELECTORS.sender).toBeDefined();
    expect(domUtils.EMAIL_SELECTORS.subject).toBeDefined();
    expect(domUtils.EMAIL_SELECTORS.snippet).toBeDefined();
  });

  test('should export findElements function', () => {
    expect(domUtils.findElements).toBeDefined();
    expect(typeof domUtils.findElements).toBe('function');
  });

  test('should export extractEmailData function', () => {
    expect(domUtils.extractEmailData).toBeDefined();
    expect(typeof domUtils.extractEmailData).toBe('function');
  });

  test('should export isElementVisible function', () => {
    expect(domUtils.isElementVisible).toBeDefined();
    expect(typeof domUtils.isElementVisible).toBe('function');
  });

  test('should export waitForElement function', () => {
    expect(domUtils.waitForElement).toBeDefined();
    expect(typeof domUtils.waitForElement).toBe('function');
  });

  test('should export addVisualStyles function', () => {
    expect(domUtils.addVisualStyles).toBeDefined();
    expect(typeof domUtils.addVisualStyles).toBe('function');
  });

  test('should have all expected exports', () => {
    const expectedExports = [
      'EMAIL_ROW_SELECTORS',
      'EMAIL_SELECTORS', 
      'findElements',
      'extractEmailData',
      'isElementVisible',
      'waitForElement',
      'addVisualStyles'
    ];

    expectedExports.forEach(exportName => {
      expect(domUtils).toHaveProperty(exportName);
    });
  });

  test('should not have unexpected exports', () => {
    const actualExports = Object.keys(domUtils);
    const expectedExports = [
      'EMAIL_ROW_SELECTORS',
      'EMAIL_SELECTORS', 
      'findElements',
      'extractEmailData',
      'isElementVisible',
      'waitForElement',
      'addVisualStyles'
    ];

    expect(actualExports).toEqual(expect.arrayContaining(expectedExports));
    expect(actualExports.length).toBe(expectedExports.length);
  });
});
