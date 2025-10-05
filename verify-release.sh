#!/bin/bash

# SaveGrandma Release Verification Script
# This script helps verify that the published extension matches the GitHub source

set -e

echo "🔍 SaveGrandma Release Verification"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "info") echo -e "ℹ️  $message" ;;
    esac
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "manifest.json" ]; then
    print_status "error" "Please run this script from the SaveGrandma project root directory"
    exit 1
fi

print_status "info" "Checking project structure..."

# Verify key files exist
required_files=("manifest.json" "package.json" "webpack.config.js" "src/savegrandma.js")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_status "success" "Found $file"
    else
        print_status "error" "Missing required file: $file"
        exit 1
    fi
done

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "warning" "node_modules not found. Installing dependencies..."
    npm install
fi

print_status "info" "Building extension from source..."
npm run build

# Verify build output
if [ -f "savegrandma.bundle.js" ]; then
    print_status "success" "Build completed successfully"
    
    # Get file size
    bundle_size=$(wc -c < "savegrandma.bundle.js")
    print_status "info" "Bundle size: $bundle_size bytes"
else
    print_status "error" "Build failed - savegrandma.bundle.js not found"
    exit 1
fi

# Generate verification hashes
print_status "info" "Generating verification hashes..."
npm run verify

print_status "success" "Verification complete!"
print_status "info" "You can now compare these hashes with the published extension"
print_status "info" "For users: Load the built extension to verify functionality matches the store version"

echo ""
echo "📋 Next steps for verification:"
echo "1. Load the built extension in Chrome (chrome://extensions)"
echo "2. Compare functionality with the published version"
echo "3. Share the generated hashes for others to verify"
echo "4. Consider publishing the hashes in your GitHub releases"
