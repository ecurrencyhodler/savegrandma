# SaveGrandma Build Verification

## How to Verify the Extension

### 1. Prepare the Source
1. Clone the repository fresh or fetch the latest tags.
2. Checkout the tag or commit that corresponds to the published release.
   - Example: `git checkout tags/v1.1.0`
3. Record the commit SHA for your notes: `git rev-parse HEAD`

### 2. Build From Source
```bash
npm install
npm run build
```
This produces `savegrandma.bundle.js` in the project root. If you prefer a single command that includes verification, run `npm run build-and-verify` instead.

### 3. Generate Verification Hashes
```bash
npm run verify
```
`verify-build.js` prints the SHA-256 hash for each key file plus a master build hash. Save these values—they should match what is published with the release (for example in the GitHub release notes).

### 4. Obtain the Published Package
1. Download the extension from the Chrome Web Store using a CRX downloader (or through the Developer Dashboard if you own the listing).
2. Rename the downloaded `.crx` file to `.zip` and unzip it, or use a CRX extractor tool.
3. You should now have the published `manifest.json`, `savegrandma.bundle.js`, popup assets, and icons.

### 5. Compare Files
1. Run SHA-256 hashes on the published files (macOS example: `shasum -a 256 savegrandma.bundle.js`).
2. Ensure the hashes for `manifest.json`, `savegrandma.bundle.js`, `popup.html`, `popup.js`, `popup.css`, and each icon match the values produced by `npm run verify`.
3. Confirm the `manifest.json` version, permissions, host permissions, and icons are identical between the source build and the unpacked store package.
4. Optionally, diff the files directly (e.g. `diff -u source/savegrandma.bundle.js store/savegrandma.bundle.js`).

## Current Build Information
- **Version**: 2.0.0 (manifest.json)
- **Build Date**: Generated on build
- **Source Hash**: Generated from GitHub commit
- **Master Hash**: Generated from all key files

## Key Files to Verify
- `manifest.json` - Extension configuration
- `savegrandma.bundle.js` - Main content script
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality
- `popup.css` - Popup styling
- `icons/` - Extension icons

## Trust Indicators
- ✅ Open source code available on GitHub
- ✅ No external dependencies in production
- ✅ No network requests (privacy-first design)
- ✅ Reproducible builds from source
- ✅ File hashes for verification

## Security Notes
- The extension only accesses Gmail domains
- All analysis happens locally in your browser
- No data is sent to external servers
- Source code is publicly auditable
