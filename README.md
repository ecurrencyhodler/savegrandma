# SaveGrandma Chrome Extension

A Chrome extension that detects phishing attempts in Gmail emails using DOM-based analysis with Manifest V3 support.

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
