// SaveGrandma Popup Frontend
// Handles popup functionality, statistics display, and whitelist management

const { getGmailAccountId } = require('../../common/storage/index.js');
const { storage, messaging, ChromeAPI } = require('../../common/chromeApi/index.js');

class SaveGrandmaPopup {
    constructor() {
        this.stats = {
            totalEmailsScanned: 0,
            threatsIdentified: 0,
            emailsWhitelisted: 0,
            totalThreatsEverFound: 0
        };
        
        this.whitelist = new Set();
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.updateUI();
            await this.updateCurrentUrl();
        } catch (error) {
            console.error('Failed to initialize popup:', error);
        }
    }

    async loadData() {
        // First check if we're on a Gmail URL
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const isOnGmail = tabs[0] && (tabs[0].url.includes('mail.google.com') || tabs[0].url.includes('inbox.google.com'));
        
        if (!isOnGmail) {
            // Not on Gmail, reset stats to default values
            this.stats = {
                totalEmailsScanned: 0,
                threatsIdentified: 0,
                emailsWhitelisted: 0,
                totalThreatsEverFound: 0
            };
            this.whitelist = new Set();
            return;
        }

        // Get account-specific storage keys
        const accountId = getGmailAccountId(tabs[0].url);
        const statsKey = `savegrandma_stats_${accountId}`;
        const whitelistKey = `savegrandma_whitelist_${accountId}`;
        
        console.log('Loading data for account:', accountId, 'URL:', tabs[0].url);
        console.log('Storage keys:', { statsKey, whitelistKey });

        // Load statistics from storage only when on Gmail (account-specific)
        const statsData = await this.getStorageData(statsKey);
        console.log('Loaded stats data from storage:', statsData);
        if (statsData) {
            // Handle new session/persistent structure
            if (statsData.sessionStats) {
                // New format: separate session and persistent stats
                this.stats.totalEmailsScanned = statsData.sessionStats.emailsScannedThisSession || 0;
                this.stats.threatsIdentified = statsData.sessionStats.threatsIdentifiedThisSession || 0;
                this.stats.totalThreatsEverFound = statsData.totalThreatsEverFound || 0;
                this.stats.emailsWhitelisted = statsData.emailsWhitelisted || 0;
            } else {
                // Legacy format: migrate to new structure
                this.stats = { ...this.stats, ...statsData };
                this.stats.totalThreatsEverFound = statsData.threatsIdentified || 0;
                console.log('Migrated legacy stats format in popup');
            }
            console.log('Updated stats from storage:', this.stats);
        }

        // Load whitelist from storage only when on Gmail (account-specific)
        const whitelistData = await this.getStorageData(whitelistKey);
        if (whitelistData) {
            this.whitelist = new Set(whitelistData);
            // Always sync the counter with the actual whitelist size to prevent mismatches
            this.stats.emailsWhitelisted = this.whitelist.size;
            console.log(`Synced whitelist counter: ${this.stats.emailsWhitelisted} (actual whitelist size: ${this.whitelist.size})`);
        }

        // Try to get current stats from the content script if available
        try {
            if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
                console.log('Attempting to get stats from content script for tab:', tabs[0].id);
                // Request current stats from the content script with timeout
                const response = await this.sendMessageWithTimeout(tabs[0].id, { 
                    action: 'getStats' 
                }, 2000); // 2 second timeout
                
                console.log('Content script response:', response);
                
                if (response && response.success && response.stats) {
                    console.log('Updating stats from content script:', response.stats);
                    // Content script provides legacy format, so we use it directly
                    this.stats = { ...this.stats, ...response.stats };
                } else if (response && response.stats) {
                    // Handle legacy response format
                    console.log('Updating stats from content script (legacy format):', response.stats);
                    this.stats = { ...this.stats, ...response.stats };
                } else {
                    console.log('No valid stats in content script response');
                }
            }
        } catch (error) {
            // Content script might not be available, use stored data
            console.log('Content script not available, using stored data:', error.message);
        }
    }

    async getStorageData(key) {
        try {
            ChromeAPI.log('getStorageData', { key });
            const result = await storage.get([key]);
            return result[key] || null;
        } catch (error) {
            ChromeAPI.handleError(error, 'getStorageData', { key });
            return null;
        }
    }

    async setStorageData(key, value) {
        try {
            ChromeAPI.log('setStorageData', { key, valueSize: JSON.stringify(value).length });
            await storage.set({ [key]: value });
        } catch (error) {
            ChromeAPI.handleError(error, 'setStorageData', { key });
            throw error;
        }
    }

    async sendMessageWithTimeout(tabId, message, timeout = 2000) {
        try {
            ChromeAPI.log('sendMessageWithTimeout', { tabId, message, timeout });
            return await messaging.sendMessage(tabId, message, timeout);
        } catch (error) {
            ChromeAPI.handleError(error, 'sendMessageWithTimeout', { tabId, message });
            throw error;
        }
    }

    setupEventListeners() {
        // Whitelist stat card click handler
        const whitelistStatCard = document.getElementById('whitelistStatCard');
        if (whitelistStatCard) {
            whitelistStatCard.addEventListener('click', () => this.openWhitelistPopup());
        }

        // Close whitelist popup button
        const closeWhitelistPopup = document.getElementById('closeWhitelistPopup');
        if (closeWhitelistPopup) {
            closeWhitelistPopup.addEventListener('click', () => this.closeWhitelistPopup());
        }

        // Clear all whitelist button in popup
        const popupClearAllBtn = document.getElementById('popupClearAllBtn');
        if (popupClearAllBtn) {
            popupClearAllBtn.addEventListener('click', () => this.clearAllWhitelist());
        }

        // Close popup when clicking outside
        const whitelistPopup = document.getElementById('whitelistPopup');
        if (whitelistPopup) {
            whitelistPopup.addEventListener('click', (e) => {
                if (e.target === whitelistPopup) {
                    this.closeWhitelistPopup();
                }
            });
        }

        // Listen for messages from content script and service worker
        messaging.setupMessageListener((message, sender, sendResponse) => {
            console.log('Popup received message:', message, 'from sender:', sender);
            if (message.action === 'updateStats') {
                console.log('Updating stats from content script:', message.stats);
                this.updateStatsFromContent(message.stats);
            } else if (message.action === 'whitelistUpdated') {
                console.log('Whitelist updated from service worker:', message.data);
                this.handleWhitelistUpdate(message.data);
            }
        });
    }

    updateStatsFromContent(newStats) {
        if (newStats) {
            console.log('Before update - stats:', this.stats);
            this.stats = { ...this.stats, ...newStats };
            console.log('After update - stats:', this.stats);
            this.updateUI();
            this.saveStats();
        }
    }

    async handleWhitelistUpdate(whitelistData) {
        try {
            console.log('Handling whitelist update:', whitelistData);
            console.log('Current whitelist size before update:', this.whitelist.size);
            console.log('Current stats.emailsWhitelisted before update:', this.stats.emailsWhitelisted);
            
            if (whitelistData.action === 'add') {
                // Add email to local whitelist
                this.whitelist.add(whitelistData.email);
                this.stats.emailsWhitelisted = this.whitelist.size;
                
                console.log('After adding email - whitelist size:', this.whitelist.size);
                console.log('After adding email - stats.emailsWhitelisted:', this.stats.emailsWhitelisted);
                
                // Update UI immediately
                this.updateUI();
                
                // Save to storage
                await this.saveStats();
                
                console.log(`✅ Added ${whitelistData.email} to whitelist, total: ${this.whitelist.size}`);
            }
        } catch (error) {
            console.error('Error handling whitelist update:', error);
        }
    }

    updateUI() {
        this.updateStatistics();
        this.updateWhitelistDisplay();
    }

    async updateCurrentUrl() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentUrlElement = document.getElementById('currentUrl');
            
            if (!currentUrlElement) {
                console.error('Current URL element not found');
                return;
            }

            if (tabs && tabs.length > 0 && tabs[0].url) {
                const currentUrl = tabs[0].url;
                
                // Check if it's a Gmail URL
                if (currentUrl.includes('mail.google.com') || currentUrl.includes('inbox.google.com')) {
                    currentUrlElement.textContent = currentUrl;
                    currentUrlElement.className = 'url-display gmail-url';
                } else {
                    currentUrlElement.textContent = 'Go to your email to activate scanning.';
                    currentUrlElement.className = 'url-display non-gmail';
                    
                    // Reset stats when not on Gmail
                    this.stats = {
                        totalEmailsScanned: 0,
                        threatsIdentified: 0,
                        emailsWhitelisted: 0,
                        totalThreatsEverFound: 0
                    };
                    this.whitelist = new Set();
                    this.updateUI();
                }
            } else {
                currentUrlElement.textContent = 'Go to your email to activate scanning.';
                currentUrlElement.className = 'url-display non-gmail';
                
                // Reset stats when no URL available
                this.stats = {
                    totalEmailsScanned: 0,
                    threatsIdentified: 0,
                    emailsWhitelisted: 0,
                    totalThreatsEverFound: 0
                };
                this.whitelist = new Set();
                this.updateUI();
            }
        } catch (error) {
            console.error('Failed to update current URL:', error);
            const currentUrlElement = document.getElementById('currentUrl');
            if (currentUrlElement) {
                currentUrlElement.textContent = 'Go to your email to activate scanning.';
                currentUrlElement.className = 'url-display non-gmail';
                
                // Reset stats on error
                this.stats = {
                    totalEmailsScanned: 0,
                    threatsIdentified: 0,
                    emailsWhitelisted: 0,
                    totalThreatsEverFound: 0
                };
                this.whitelist = new Set();
                this.updateUI();
            }
        }
    }

    updateStatistics() {
        // Update total emails scanned (session)
        const totalEmailsElement = document.getElementById('totalEmailsScanned');
        if (totalEmailsElement) {
            totalEmailsElement.textContent = this.stats.totalEmailsScanned.toLocaleString();
        }

        // Update threats identified (session)
        const threatsElement = document.getElementById('threatsIdentified');
        if (threatsElement) {
            threatsElement.textContent = this.stats.threatsIdentified.toLocaleString();
        }

        // Update emails whitelisted (persistent)
        const whitelistedElement = document.getElementById('emailsWhitelisted');
        if (whitelistedElement) {
            whitelistedElement.textContent = this.stats.emailsWhitelisted.toLocaleString();
        }

        // Update total threats ever found (persistent)
        const totalThreatsElement = document.getElementById('totalThreatsEverFound');
        if (totalThreatsElement) {
            totalThreatsElement.textContent = this.stats.totalThreatsEverFound.toLocaleString();
        }
    }

    updateWhitelistDisplay() {
        // Update whitelist popup if it's open
        const whitelistPopup = document.getElementById('whitelistPopup');
        if (whitelistPopup) {
            // Use computed style to check if popup is actually visible
            const computedStyle = window.getComputedStyle(whitelistPopup);
            if (computedStyle.display !== 'none') {
                this.updateWhitelistPopup();
            }
        }
    }

    updateWhitelistPopup() {
        const popupWhitelistItems = document.getElementById('popupWhitelistItems');
        const popupWhitelistEmpty = document.getElementById('popupWhitelistEmpty');
        const popupClearAllBtn = document.getElementById('popupClearAllBtn');
        const popupWhitelistCount = document.getElementById('popupWhitelistCount');
        const popupWhitelistMax = document.getElementById('popupWhitelistMax');
        const popupWhitelistStatusMessage = document.getElementById('popupWhitelistStatusMessage');

        console.log('updateWhitelistPopup called - whitelist size:', this.whitelist.size);

        if (!popupWhitelistItems || !popupWhitelistEmpty) {
            console.log('Popup elements not found - cannot update');
            return;
        }

        // Update whitelist status in popup
        const MAX_WHITELIST_SIZE = 10000;
        const currentCount = this.whitelist.size;
        const isAtCapacity = currentCount >= MAX_WHITELIST_SIZE;

        if (popupWhitelistCount) {
            popupWhitelistCount.textContent = currentCount.toLocaleString();
        }
        if (popupWhitelistMax) {
            popupWhitelistMax.textContent = MAX_WHITELIST_SIZE.toLocaleString();
        }
        if (popupWhitelistStatusMessage) {
            if (isAtCapacity) {
                popupWhitelistStatusMessage.textContent = '⚠️ Whitelist is full!';
                popupWhitelistStatusMessage.className = 'status-message warning';
            } else {
                popupWhitelistStatusMessage.textContent = '✓ Space available';
                popupWhitelistStatusMessage.className = 'status-message success';
            }
        }

        // Clear existing items
        popupWhitelistItems.innerHTML = '';

        if (this.whitelist.size === 0) {
            // Show empty state
            console.log('Setting empty state - showing empty message, hiding items');
            popupWhitelistEmpty.style.display = 'block';
            popupWhitelistItems.style.display = 'none';
            
            // Only disable clear button if it's not currently in a processing state
            if (popupClearAllBtn && popupClearAllBtn.textContent !== 'Clearing...' && popupClearAllBtn.textContent !== 'Cleared!') {
                popupClearAllBtn.disabled = true;
                popupClearAllBtn.style.opacity = '0.5';
            }
            
            // Force a reflow to ensure the display changes are applied
            popupWhitelistEmpty.offsetHeight;
        } else {
            // Show whitelist items
            popupWhitelistEmpty.style.display = 'none';
            popupWhitelistItems.style.display = 'block';
            
            // Only enable clear button if it's not currently in a processing state
            if (popupClearAllBtn && popupClearAllBtn.textContent !== 'Clearing...' && popupClearAllBtn.textContent !== 'Cleared!') {
                popupClearAllBtn.disabled = false;
                popupClearAllBtn.style.opacity = '1';
            }

            // Add each whitelisted email
            this.whitelist.forEach(email => {
                const item = this.createWhitelistItem(email);
                popupWhitelistItems.appendChild(item);
            });
            
            // Force a reflow to ensure the display changes are applied
            popupWhitelistItems.offsetHeight;
        }
    }

    createWhitelistItem(email) {
        const item = document.createElement('div');
        item.className = 'whitelist-item';
        
        const emailSpan = document.createElement('span');
        emailSpan.className = 'whitelist-email';
        emailSpan.textContent = email;
        emailSpan.title = email; // Show full email on hover
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove from whitelist';
        removeBtn.addEventListener('click', () => this.removeFromWhitelist(email));
        
        item.appendChild(emailSpan);
        item.appendChild(removeBtn);
        
        return item;
    }

    async removeFromWhitelist(email) {
        if (this.whitelist.has(email)) {
            // OPTIMISTIC UPDATE: Immediately update UI for instant feedback
            this.whitelist.delete(email);
            this.stats.emailsWhitelisted = this.whitelist.size;
            
            // Update UI immediately
            this.updateStatistics();
            this.updateWhitelistPopup();
            
            console.log(`Removed ${email} from whitelist, UI updated immediately`);
            
            // Save to storage in background
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tabs || !tabs[0] || !tabs[0].url) {
                    console.error('No active tab or URL found when saving whitelist');
                    return;
                }
                const accountId = getGmailAccountId(tabs[0].url);
                const whitelistKey = `savegrandma_whitelist_${accountId}`;
                await this.setStorageData(whitelistKey, [...this.whitelist]);
                await this.saveStats();
                
                // Notify content script
                this.notifyContentScript('whitelistUpdated', { 
                    action: 'remove', 
                    email: email 
                });
                
            } catch (error) {
                console.error('Failed to save whitelist to storage:', error);
                
                // ROLLBACK: Reload data from storage to restore correct state
                try {
                    await this.loadData();
                    this.updateUI();
                    console.log('Rolled back to previous state due to storage error');
                } catch (rollbackError) {
                    console.error('Failed to rollback after storage error:', rollbackError);
                }
            }
        }
    }

    openWhitelistPopup() {
        const whitelistPopup = document.getElementById('whitelistPopup');
        if (whitelistPopup) {
            whitelistPopup.style.display = 'flex';
            // Update the popup content
            this.updateWhitelistPopup();
        }
    }

    closeWhitelistPopup() {
        const whitelistPopup = document.getElementById('whitelistPopup');
        if (whitelistPopup) {
            whitelistPopup.style.display = 'none';
        }
    }

    async clearAllWhitelist() {
        if (this.whitelist.size === 0) return;
        
        // Confirm action
        const confirmed = confirm(
            `Are you sure you want to remove all ${this.whitelist.size} emails from the whitelist?`
        );
        
        if (!confirmed) return;
        
        const removedEmails = [...this.whitelist];
        const clearButton = document.getElementById('popupClearAllBtn');
        const originalButtonText = clearButton ? clearButton.textContent : 'Clear All';
        
        console.log('Starting clear all whitelist operation, removing:', removedEmails.length, 'emails');
        
        // Show loading state immediately
        if (clearButton) {
            clearButton.textContent = 'Clearing...';
            clearButton.disabled = true;
            clearButton.style.opacity = '0.7';
        }
        
        try {
            // Get account info before clearing
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs || !tabs[0] || !tabs[0].url) {
                throw new Error('No active tab or URL found when clearing whitelist');
            }
            
            console.log('Active tab URL:', tabs[0].url);
            const accountId = getGmailAccountId(tabs[0].url);
            const whitelistKey = `savegrandma_whitelist_${accountId}`;
            console.log('Account ID:', accountId, 'Whitelist key:', whitelistKey);
            
            // Clear data and save to storage
            this.whitelist.clear();
            this.stats.emailsWhitelisted = 0;
            console.log('Cleared whitelist in memory, size:', this.whitelist.size);
            
            // Save to storage with error handling
            try {
                await this.setStorageData(whitelistKey, []);
                console.log('Whitelist cleared in storage successfully');
            } catch (storageError) {
                console.error('Failed to clear whitelist in storage:', storageError);
                throw new Error(`Storage error: ${storageError.message}`);
            }
            
            // Save stats with error handling
            try {
                await this.saveStats();
                console.log('Stats saved successfully');
            } catch (statsError) {
                console.error('Failed to save stats:', statsError);
                // Don't throw here, stats save failure shouldn't prevent whitelist clearing
            }
            
            // Notify content script with error handling
            try {
                await this.notifyContentScript('whitelistUpdated', { 
                    action: 'clear', 
                    emails: removedEmails 
                });
                console.log('Content script notified successfully');
            } catch (notificationError) {
                console.error('Failed to notify content script:', notificationError);
                // Don't throw here, notification failure shouldn't prevent whitelist clearing
            }
            
            console.log('Storage updated successfully');
            
            // Wait a moment for the clearing process to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh whitelist from storage to ensure we have the latest state
            // But don't call loadData() as it might override our cleared stats with content script data
            if (tabs && tabs[0] && tabs[0].url) {
                const accountId = getGmailAccountId(tabs[0].url);
                const whitelistKey = `savegrandma_whitelist_${accountId}`;
                
                // Reload whitelist from storage to confirm it's empty
                const whitelistData = await this.getStorageData(whitelistKey);
                if (whitelistData) {
                    this.whitelist = new Set(whitelistData);
                    this.stats.emailsWhitelisted = this.whitelist.size;
                }
            }
            
            // Update UI only after successful save and data refresh
            this.updateStatistics();
            this.updateWhitelistPopup();
            this.updateUI();
            
            console.log('UI updated - whitelist size:', this.whitelist.size, 'stats.emailsWhitelisted:', this.stats.emailsWhitelisted);
            
            // Show success state
            if (clearButton) {
                clearButton.textContent = 'Cleared!';
                clearButton.style.backgroundColor = '#28a745';
                
                // Reset button after delay
                setTimeout(() => {
                    clearButton.textContent = originalButtonText;
                    clearButton.disabled = false;
                    clearButton.style.opacity = '1';
                    clearButton.style.backgroundColor = '';
                }, 2000);
            }
            
        } catch (error) {
            console.error('Failed to clear whitelist:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                whitelistSize: this.whitelist.size,
                removedEmailsCount: removedEmails.length
            });
            
            // Restore original data (no optimistic update to rollback)
            this.whitelist = new Set(removedEmails);
            this.stats.emailsWhitelisted = this.whitelist.size;
            
            // Restore button state
            if (clearButton) {
                clearButton.textContent = `Error: ${error.message}`;
                clearButton.disabled = false;
                clearButton.style.opacity = '1';
                clearButton.style.backgroundColor = '#dc3545';
                
                // Reset button after delay
                setTimeout(() => {
                    clearButton.textContent = originalButtonText;
                    clearButton.style.backgroundColor = '';
                }, 5000);
            }
            
            // Show error message to user
            alert('Failed to clear whitelist. Please try again.');
            console.log('Restored original state due to error');
        }
    }

    async saveStats() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs || !tabs[0] || !tabs[0].url) {
                console.error('No active tab or URL found when saving stats');
                return;
            }
            const accountId = getGmailAccountId(tabs[0].url);
            const statsKey = `savegrandma_stats_${accountId}`;
            await this.setStorageData(statsKey, this.stats);
        } catch (error) {
            console.error('Error saving stats:', error);
        }
    }

    async notifyContentScript(action, data, retries = 3) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
                for (let attempt = 1; attempt <= retries; attempt++) {
                    try {
                        const response = await messaging.sendMessage(tabs[0].id, {
                            action: action,
                            data: data
                        });
                        console.log(`Content script notification successful on attempt ${attempt}:`, response);
                        return response; // Success, exit retry loop
                    } catch (error) {
                        console.log(`Content script notification attempt ${attempt} failed:`, error);
                        if (attempt === retries) {
                            throw error; // Final attempt failed
                        }
                        // Wait before retry (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
                    }
                }
            }
        } catch (error) {
            console.log('Could not notify content script after all retries:', error);
            throw error; // Re-throw to allow caller to handle
        }
    }

    // Method to refresh data from content script
    async refreshData() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const isOnGmail = tabs[0] && (tabs[0].url.includes('mail.google.com') || tabs[0].url.includes('inbox.google.com'));
            
            if (!isOnGmail) {
                // Not on Gmail, reset stats to default values
                this.stats = {
                    totalEmailsScanned: 0,
                    threatsIdentified: 0,
                    emailsWhitelisted: 0,
                    totalThreatsEverFound: 0
                };
                this.whitelist = new Set();
                this.updateUI();
                return;
            }
            
            // Get account-specific storage keys
            const accountId = getGmailAccountId(tabs[0].url);
            const statsKey = `savegrandma_stats_${accountId}`;
            const whitelistKey = `savegrandma_whitelist_${accountId}`;
            
            if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
                try {
                    const response = await messaging.sendMessage(tabs[0].id, { 
                        action: 'getAllData' 
                    });
                    
                    if (response && response.success) {
                        if (response.stats) {
                            // Content script provides legacy format stats
                            this.stats = { ...this.stats, ...response.stats };
                        }
                        if (response.whitelist) {
                            this.whitelist = new Set(response.whitelist);
                            this.stats.emailsWhitelisted = this.whitelist.size;
                        }
                        
                        this.updateUI();
                        await this.saveStats();
                    } else if (response) {
                        // Handle legacy response format
                        if (response.stats) {
                            this.stats = { ...this.stats, ...response.stats };
                        }
                        if (response.whitelist) {
                            this.whitelist = new Set(response.whitelist);
                            this.stats.emailsWhitelisted = this.whitelist.size;
                        }
                        
                        this.updateUI();
                        await this.saveStats();
                    }
                } catch (error) {
                    console.log('Could not get data from content script:', error);
                    // Fallback to stored data
                    await this.loadData();
                }
            }
        } catch (error) {
            console.log('Could not refresh data from content script:', error);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.saveGrandmaPopup = new SaveGrandmaPopup();
});

// Add refresh functionality when popup is focused
window.addEventListener('focus', async () => {
    if (window.saveGrandmaPopup) {
        await window.saveGrandmaPopup.refreshData();
        await window.saveGrandmaPopup.updateCurrentUrl();
    }
});
