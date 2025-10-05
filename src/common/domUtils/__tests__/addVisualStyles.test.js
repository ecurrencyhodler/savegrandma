// Unit tests for addVisualStyles function

const addVisualStyles = require('../addVisualStyles');

describe('addVisualStyles', () => {
  beforeEach(() => {
    // Clean up any existing styles
    const existingStyle = global.document.getElementById('savegrandma-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
  });

  afterEach(() => {
    // Clean up any added styles
    const existingStyle = global.document.getElementById('savegrandma-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
  });

  test('should add styles to document head', () => {
    const initialStyleCount = global.document.head.children.length;
    
    addVisualStyles();
    
    const finalStyleCount = global.document.head.children.length;
    expect(finalStyleCount).toBe(initialStyleCount + 1);
    
    const addedStyle = global.document.getElementById('savegrandma-styles');
    expect(addedStyle).toBeTruthy();
    expect(addedStyle.tagName).toBe('STYLE');
  });

  test('should replace existing styles when called multiple times', () => {
    addVisualStyles();
    const firstStyle = global.document.getElementById('savegrandma-styles');
    
    addVisualStyles();
    const secondStyle = global.document.getElementById('savegrandma-styles');
    
    expect(secondStyle).toBeTruthy();
    expect(secondStyle).not.toBe(firstStyle); // Should be a new element
  });

  test('should include warning icon styles', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('.savegrandma-warning-icon');
    expect(cssContent).toContain('background-color: #dc3545');
    expect(cssContent).toContain('content: "⚠"');
  });

  test('should include safe icon styles', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('.savegrandma-safe-icon');
    expect(cssContent).toContain('background-color: #44ff44');
    expect(cssContent).toContain('content: "✓"');
  });

  test('should include popup styles', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('.savegrandma-popup');
    expect(cssContent).toContain('position: fixed');
    expect(cssContent).toContain('z-index: 10000');
  });

  test('should include warning icon red background', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('background-color: #dc3545');
    expect(cssContent).toContain('border-radius: 2px');
  });

  test('should include button hover effects', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('.savegrandma-popup button:hover');
    expect(cssContent).toContain('background: #218838');
  });

  test('should include popup close button styles', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('.savegrandma-popup-close');
    expect(cssContent).toContain('background: none');
    expect(cssContent).toContain('color: white');
  });

  test('should set correct CSS properties for warning icon', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('display: inline-block');
    expect(cssContent).toContain('width: 16px');
    expect(cssContent).toContain('height: 16px');
    expect(cssContent).toContain('border-radius: 2px');
    expect(cssContent).toContain('background-color: #dc3545');
  });

  test('should set correct CSS properties for safe icon', () => {
    addVisualStyles();
    const style = global.document.getElementById('savegrandma-styles');
    const cssContent = style.textContent;
    
    expect(cssContent).toContain('.savegrandma-safe-icon');
    expect(cssContent).toContain('display: inline-block');
    expect(cssContent).toContain('width: 16px');
    expect(cssContent).toContain('height: 16px');
    expect(cssContent).toContain('border-radius: 50%');
  });
});