# SaveGrandma Chrome Extension

Save Grandma is a Chrome extension that detects phishing attempts in Gmail using DOM-based analysis. This runs locally in your browser for perfect privacy. Click on warning icons (⚠️) to see why it was flagged as suspicious and mark it as safe to whitelist up to 10,000 addresses. Go to extension menu to see how many emails were scanned, how many threats identified, how many emails were whitelisted, and to manage your whitelist.

## Setup Instructions

### 1. Privacy-First DOM-Based Approach

The extension uses direct DOM manipulation to analyze Gmail emails for better privacy and no external dependencies.

**Key Features**:
- **Privacy-First**: No external requests or dependencies. All functionality is self-contained within the extension.
- **DOM-Based Analysis**: Directly analyzes Gmail's DOM structure to extract email content
- **Local Processing**: All email analysis happens locally in your browser
- **No Data Collection**: Your emails never leave your device

### 2. Build the Extension

**Dependencies**: 
- Compromise.js for English grammar/spelling analysis in email content

```bash
npm install
npm run build
```

### 3. Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked extension"
4. Select the SaveGrandma directory

### 4. Test the Extension

1. Open Gmail in a new tab
2. Click the SaveGrandma extension icon in the Chrome toolbar to open the popup menu
3. The popup will show:
   - App name and logo
   - Statistics (emails scanned, threats identified, emails whitelisted)
   - Whitelist management (view, remove individual emails, or clear all)
   - Help link to support form
4. Open Chrome Developer Tools (F12) and check the Console tab for SaveGrandma logs
5. You should see:
   - `SaveGrandma: Extension loading (DOM-based approach)...`
   - `SaveGrandma: Status changed to: initializing`
   - `SaveGrandma: DOM monitoring initialized successfully`
   - `SaveGrandma: Status changed to: initialized`
   - `SaveGrandma: Email analysis complete` (when emails are processed)

### 5. Debug Information

The extension includes comprehensive debug tracking:

- **Status Tracking**: Monitor DOM monitoring and initialization status
- **Event Logging**: Track all email detection and analysis events
- **Error Handling**: Capture and log any errors that occur
- **Periodic Updates**: Status checks every 30 seconds
- **Global Debug Object**: Access `window.SaveGrandmaDebug` in console for detailed info

**Debug Commands** (run in console):
```javascript
// Check current status
SaveGrandmaDebug.status

// View all detected messages
SaveGrandmaDebug.messageViews

// View all detected threads
SaveGrandmaDebug.threadViews

// View any errors
SaveGrandmaDebug.errors

// Get full debug info
SaveGrandmaDebug
```

## Current Status

The extension is fully functional with DOM-based email analysis:
- ✅ **Manifest V3 Compatible**: Updated to use Chrome's latest extension standard
- ✅ **DOM-Based Integration**: Uses Gmail DOM manipulation for complete privacy
- ✅ **Webpack Bundling**: Properly bundles extension code (no external dependencies)
- ✅ **Privacy-First**: No external requests or third-party dependencies
- ✅ **Email Data Extraction**: Locally captures sender, subject, body, attachments, and metadata
- ✅ **Smart Scan Completion**: Detects when email processing is finished
- ✅ **Scan Reporting**: Generates comprehensive scan summaries
- ✅ **Extension Popup Menu**: Beautiful popup interface with statistics and whitelist management
- ✅ **Statistics Tracking**: Real-time tracking of emails scanned, threats identified, and whitelisted emails
- ✅ **Whitelist Management**: Add/remove emails from whitelist with individual or bulk operations
- ✅ **Phishing Detection Logic**: DOM-based threat analysis with visual indicators
- ✅ **Grammar Analysis**: Uses Compromise.js for English grammar/spelling analysis