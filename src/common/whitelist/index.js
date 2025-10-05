// Whitelist module exports
const emailWhitelist = require('./emailWhitelist');
const isWhitelisted = require('./isWhitelisted');
const isWhitelistAtCapacity = require('./isWhitelistAtCapacity');
const addToWhitelist = require('./addToWhitelist');
const getWhitelistSize = require('./getWhitelistSize');
const getAllWhitelistedEmails = require('./getAllWhitelistedEmails');

module.exports = {
  emailWhitelist,
  isWhitelisted,
  isWhitelistAtCapacity,
  addToWhitelist,
  getWhitelistSize,
  getAllWhitelistedEmails
};
