// SaveGrandma Popup JavaScript
// Handles popup functionality, statistics display, and whitelist management

class SaveGrandmaPopup {
    constructor() {
        this.stats = {
            totalEmailsScanned: 0,
            threatsIdentified: 0,
            emailsWhitelisted: 0
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
        // Load statistics from storage
        const statsData = await this.getStorageData('savegrandma_stats');
        if (statsData) {
            this.stats = { ...this.stats, ...statsData };
        }

        // Load whitelist from storage
        const whitelistData = await this.getStorageData('savegrandma_whitelist');
        if (whitelistData) {
            this.whitelist = new Set(whitelistData);
            this.stats.emailsWhitelisted = this.whitelist.size;
        }

        // Try to get current stats from the content script if available
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
                // Request current stats from the content script
                const response = await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'getStats' 
                });
                
                if (response && response.success && response.stats) {
                    this.stats = { ...this.stats, ...response.stats };
                } else if (response && response.stats) {
                    // Handle legacy response format
                    this.stats = { ...this.stats, ...response.stats };
                }
            }
        } catch (error) {
            // Content script might not be available, use stored data
            console.log('Content script not available, using stored data');
        }
    }

    async getStorageData(key) {
        return new Promise((resolve) => {
            // Try chrome.storage.local first, fallback to localStorage
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([key], (result) => {
                    resolve(result[key] || null);
                });
            } else {
                // Fallback to localStorage for compatibility
                try {
                    const stored = localStorage.getItem(key);
                    resolve(stored ? JSON.parse(stored) : null);
                } catch (error) {
                    console.error('Error reading from localStorage:', error);
                    resolve(null);
                }
            }
        });
    }

    async setStorageData(key, value) {
        return new Promise((resolve) => {
            // Try chrome.storage.local first, fallback to localStorage
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [key]: value }, resolve);
            } else {
                // Fallback to localStorage for compatibility
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    resolve();
                } catch (error) {
                    console.error('Error writing to localStorage:', error);
                    resolve();
                }
            }
        });
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

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'updateStats') {
                this.updateStatsFromContent(message.stats);
            }
        });
    }

    updateStatsFromContent(newStats) {
        if (newStats) {
            this.stats = { ...this.stats, ...newStats };
            this.updateUI();
            this.saveStats();
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
                    currentUrlElement.textContent = 'Go to the Chrome tab with your email.';
                    currentUrlElement.className = 'url-display non-gmail';
                }
            } else {
                currentUrlElement.textContent = 'Go to the Chrome tab with your email.';
                currentUrlElement.className = 'url-display non-gmail';
            }
        } catch (error) {
            console.error('Failed to update current URL:', error);
            const currentUrlElement = document.getElementById('currentUrl');
            if (currentUrlElement) {
                currentUrlElement.textContent = 'Go to the Chrome tab with your email.';
                currentUrlElement.className = 'url-display non-gmail';
            }
        }
    }

    updateStatistics() {
        // Update total emails scanned
        const totalEmailsElement = document.getElementById('totalEmailsScanned');
        if (totalEmailsElement) {
            totalEmailsElement.textContent = this.stats.totalEmailsScanned.toLocaleString();
        }

        // Update threats identified
        const threatsElement = document.getElementById('threatsIdentified');
        if (threatsElement) {
            threatsElement.textContent = this.stats.threatsIdentified.toLocaleString();
        }

        // Update emails whitelisted
        const whitelistedElement = document.getElementById('emailsWhitelisted');
        if (whitelistedElement) {
            whitelistedElement.textContent = this.stats.emailsWhitelisted.toLocaleString();
        }
    }

    updateWhitelistDisplay() {
        // Update whitelist popup if it's open
        // Only update if the popup is actually visible
        const whitelistPopup = document.getElementById('whitelistPopup');
        if (whitelistPopup && whitelistPopup.style.display && whitelistPopup.style.display !== 'none') {
            this.updateWhitelistPopup();
        }
    }


    updateWhitelistPopup() {
        const popupWhitelistItems = document.getElementById('popupWhitelistItems');
        const popupWhitelistEmpty = document.getElementById('popupWhitelistEmpty');
        const popupClearAllBtn = document.getElementById('popupClearAllBtn');
        const popupWhitelistCount = document.getElementById('popupWhitelistCount');
        const popupWhitelistMax = document.getElementById('popupWhitelistMax');
        const popupWhitelistStatusMessage = document.getElementById('popupWhitelistStatusMessage');

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
            popupWhitelistEmpty.style.display = 'block';
            popupWhitelistItems.style.display = 'none';
            if (popupClearAllBtn) {
                popupClearAllBtn.disabled = true;
                popupClearAllBtn.style.opacity = '0.5';
            }
        } else {
            // Show whitelist items
            popupWhitelistEmpty.style.display = 'none';
            popupWhitelistItems.style.display = 'block';
            if (popupClearAllBtn) {
                popupClearAllBtn.disabled = false;
                popupClearAllBtn.style.opacity = '1';
            }

            // Add each whitelisted email
            this.whitelist.forEach(email => {
                const item = this.createWhitelistItem(email);
                popupWhitelistItems.appendChild(item);
            });
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
                await this.setStorageData('savegrandma_whitelist', [...this.whitelist]);
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
        console.log('Starting clear all whitelist operation, removing:', removedEmails.length, 'emails');
        
        // OPTIMISTIC UPDATE: Immediately update UI for instant feedback
        this.whitelist.clear();
        this.stats.emailsWhitelisted = 0;
        
        // Update UI immediately
        this.updateStatistics();
        this.updateWhitelistPopup();
        
        console.log('UI updated immediately, whitelist size is now:', this.whitelist.size);
        
        // Save to storage in background
        try {
            await this.setStorageData('savegrandma_whitelist', []);
            await this.saveStats();
            console.log('Storage updated successfully');
            
            // Notify content script
            this.notifyContentScript('whitelistUpdated', { 
                action: 'clear', 
                emails: removedEmails 
            });
            
        } catch (error) {
            console.error('Failed to save whitelist to storage:', error);
            
            // ROLLBACK: Reload data from storage to restore correct state
            try {
                await this.loadData();
                this.updateUI();
                console.log('Rolled back to previous state due to storage error');
                
                // Show error message to user
                alert('Failed to save changes. Please try again.');
            } catch (rollbackError) {
                console.error('Failed to rollback after storage error:', rollbackError);
                alert('An error occurred. Please refresh the extension.');
            }
        }
    }

    async saveStats() {
        await this.setStorageData('savegrandma_stats', this.stats);
    }

    async notifyContentScript(action, data) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: action,
                    data: data
                });
            }
        } catch (error) {
            console.log('Could not notify content script:', error);
        }
    }

    // Method to refresh data from content script
    async refreshData() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('mail.google.com')) {
                const response = await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'getAllData' 
                });
                
                if (response && response.success) {
                    if (response.stats) {
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

