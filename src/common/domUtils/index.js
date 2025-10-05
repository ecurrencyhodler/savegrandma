// DOM utilities module exports
const { EMAIL_ROW_SELECTORS, EMAIL_SELECTORS } = require('./selectors');
const findElements = require('./findElements');
const extractEmailData = require('./extractEmailData');
const isElementVisible = require('./isElementVisible');
const waitForElement = require('./waitForElement');
const addVisualStyles = require('./addVisualStyles');

module.exports = {
  EMAIL_ROW_SELECTORS,
  EMAIL_SELECTORS,
  findElements,
  extractEmailData,
  isElementVisible,
  waitForElement,
  addVisualStyles
};
