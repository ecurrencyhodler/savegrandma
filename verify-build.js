#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Function to generate SHA-256 hash of a file
function getFileHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Function to get file info
function getFileInfo(filePath) {
  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    size: stats.size,
    hash: getFileHash(filePath),
    modified: stats.mtime
  };
}

// Key files to verify
const keyFiles = [
  'manifest.json',
  'savegrandma.bundle.js',
  'popup.html',
  'popup.js',
  'popup.css'
];

console.log('=== SaveGrandma Extension Verification ===\n');

// Check if files exist and generate hashes
const fileInfo = [];
for (const file of keyFiles) {
  if (fs.existsSync(file)) {
    fileInfo.push(getFileInfo(file));
  } else {
    console.log(`❌ Missing file: ${file}`);
  }
}

// Display results
fileInfo.forEach(info => {
  console.log(`📄 ${info.path}`);
  console.log(`   Size: ${info.size} bytes`);
  console.log(`   Hash: ${info.hash}`);
  console.log(`   Modified: ${info.modified.toISOString()}`);
  console.log('');
});

// Generate a master hash for the entire build
const allHashes = fileInfo.map(info => info.hash).join('');
const masterHash = crypto.createHash('sha256').update(allHashes).digest('hex');
console.log(`🔐 Master Build Hash: ${masterHash}`);
console.log('\n💡 Share this hash with users to verify they have the same build!');
