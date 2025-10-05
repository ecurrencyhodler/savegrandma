// Gmail DOM Explorer - Helper script to identify Gmail DOM elements
// Run this in the browser console while on Gmail to explore the structure

console.log('🔍 Gmail DOM Explorer - Finding elements for phishing detection...');

// Function to find elements by partial class name
function findElementsByPartialClass(partialClass) {
  const elements = document.querySelectorAll(`[class*="${partialClass}"]`);
  console.log(`Found ${elements.length} elements with class containing "${partialClass}":`);
  elements.forEach((el, index) => {
    if (index < 5) { // Show first 5 examples
      console.log(`  ${index + 1}.`, el.className, el.tagName, el.textContent?.substring(0, 50));
    }
  });
  return elements;
}

// Function to find email-related elements
function exploreEmailElements() {
  console.log('\n📧 Exploring Email Elements:');
  
  // Common Gmail email container patterns
  const emailSelectors = [
    // Email threads in inbox
    'div[role="main"] tr', // Email rows
    '.zA', // Email thread rows
    '.yW', // Email content area
    '.yP', // Email sender
    '.y6', // Email subject
    '.y2', // Email snippet
    
    // Opened email view
    '.ii', // Email body container
    '.adP', // Email body content
    '.hP', // Email header
    '.gE', // Email sender info
    '.bog', // Email subject in opened view
    
    // Email metadata
    '[data-legacy-thread-id]', // Thread ID
    '[data-legacy-message-id]', // Message ID
    '[email]', // Email addresses
    '[name]', // Names
  ];
  
  emailSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`\n✅ ${selector}: Found ${elements.length} elements`);
        // Show first element's details
        const firstEl = elements[0];
        console.log(`   Classes: ${firstEl.className}`);
        console.log(`   Tag: ${firstEl.tagName}`);
        console.log(`   Text: ${firstEl.textContent?.substring(0, 100)}...`);
      }
    } catch (e) {
      console.log(`❌ ${selector}: Invalid selector`);
    }
  });
}

// Function to find clickable elements for tagging
function exploreClickableElements() {
  console.log('\n🏷️ Exploring Elements for Tagging:');
  
  const clickableSelectors = [
    'tr[role="button"]', // Email rows
    '.zA', // Email thread containers
    '.yW', // Email content containers
    'div[data-thread-id]', // Thread containers
    'div[data-message-id]', // Message containers
  ];
  
  clickableSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`\n✅ ${selector}: Found ${elements.length} elements`);
        const firstEl = elements[0];
        console.log(`   Can add classes: ${typeof firstEl.classList !== 'undefined'}`);
        console.log(`   Can add attributes: ${typeof firstEl.setAttribute !== 'undefined'}`);
      }
    } catch (e) {
      console.log(`❌ ${selector}: Invalid selector`);
    }
  });
}

// Function to monitor DOM changes
function startDOMMonitoring() {
  console.log('\n👀 Starting DOM monitoring for dynamic content...');
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList) { // Element node
            // Check if it's an email-related element
            const emailClasses = ['zA', 'yW', 'yP', 'y6', 'y2', 'ii', 'adP', 'hP', 'gE', 'bog'];
            const hasEmailClass = emailClasses.some(cls => node.classList.contains(cls));
            
            if (hasEmailClass) {
              console.log('📧 New email element detected:', node.className, node.tagName);
            }
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('DOM monitoring started. Check console for new email elements.');
  return observer;
}

// Main exploration function
function exploreGmailDOM() {
  console.log('🚀 Starting Gmail DOM exploration...');
  
  // Check if we're on Gmail
  if (!window.location.href.includes('mail.google.com')) {
    console.error('❌ Please run this script on Gmail (mail.google.com)');
    return;
  }
  
  exploreEmailElements();
  exploreClickableElements();
  
  // Start monitoring
  const observer = startDOMMonitoring();
  
  console.log('\n💡 Tips:');
  console.log('1. Open an email to see opened email elements');
  console.log('2. Scroll through inbox to see more email rows');
  console.log('3. Use Chrome DevTools Elements tab to inspect specific elements');
  console.log('4. Look for data attributes like data-thread-id, data-message-id');
  
  return observer;
}

// Auto-run if in Gmail
if (window.location.href.includes('mail.google.com')) {
  exploreGmailDOM();
} else {
  console.log('Please navigate to Gmail and run: exploreGmailDOM()');
}

// Export functions for manual use
window.exploreGmailDOM = exploreGmailDOM;
window.findElementsByPartialClass = findElementsByPartialClass;
window.startDOMMonitoring = startDOMMonitoring;
