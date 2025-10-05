// Yahoo Mail DOM Explorer Script
// Run this in the browser console while on Yahoo Mail to explore the DOM structure

console.log('🔍 Yahoo Mail DOM Explorer Starting...');

// Configuration
const EXPLORER_CONFIG = {
  maxElements: 50,
  maxTextLength: 100,
  includeEmptyElements: false,
  logLevel: 'detailed' // 'basic', 'detailed', 'verbose'
};

// Storage for found elements
const yahooExplorer = {
  emailRows: [],
  senderElements: [],
  subjectElements: [],
  bodyElements: [],
  clickableElements: [],
  emailAddresses: [],
  allElements: [],
  errors: [],
  
  log: function(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Yahoo Explorer: ${message}`, data || '');
  },
  
  error: function(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Yahoo Explorer ERROR: ${message}`, error || '');
    this.errors.push({ timestamp, message, error });
  }
};

// Function to safely get element info
function getElementInfo(element) {
  try {
    return {
      tag: element.tagName,
      classes: element.className,
      id: element.id,
      text: element.textContent?.substring(0, EXPLORER_CONFIG.maxTextLength) || '',
      attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`),
      role: element.getAttribute('role'),
      'data-testid': element.getAttribute('data-testid'),
      'aria-label': element.getAttribute('aria-label'),
      href: element.getAttribute('href'),
      title: element.getAttribute('title')
    };
  } catch (error) {
    yahooExplorer.error('Error getting element info', error);
    return null;
  }
}

// Function to find elements by various selectors
function findElementsBySelectors(selectors, description) {
  const results = [];
  
  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        results.push({
          selector: selector,
          count: elements.length,
          elements: Array.from(elements).slice(0, 10).map(el => getElementInfo(el))
        });
      }
    } catch (error) {
      yahooExplorer.error(`Error with selector: ${selector}`, error);
    }
  });
  
  if (results.length > 0) {
    yahooExplorer.log(`Found ${description}:`, results);
  }
  
  return results;
}

// Function to find email-related elements
function findEmailElements() {
  yahooExplorer.log('🔍 Searching for email-related elements...');
  
  // Common email row selectors
  const emailRowSelectors = [
    'tr[role="button"]',
    'div[role="button"]',
    'li[role="button"]',
    'div[role="listitem"]',
    'li[role="listitem"]',
    '[data-testid*="email"]',
    '[data-testid*="message"]',
    '[data-testid*="thread"]',
    '[data-testid*="row"]',
    '[data-testid*="item"]',
    'div[class*="email"]',
    'div[class*="message"]',
    'div[class*="thread"]',
    'div[class*="mail"]',
    'div[class*="item"]',
    'div[class*="row"]',
    'li[class*="email"]',
    'li[class*="message"]',
    'li[class*="thread"]',
    'li[class*="mail"]',
    'li[class*="item"]'
  ];
  
  yahooExplorer.emailRows = findElementsBySelectors(emailRowSelectors, 'email rows');
  
  // Sender element selectors
  const senderSelectors = [
    '[data-testid*="sender"]',
    '[data-testid*="from"]',
    'span[title*="@"]',
    'a[href*="mailto:"]',
    'span[class*="sender"]',
    'span[class*="from"]',
    'div[class*="sender"]',
    'div[class*="from"]',
    '[aria-label*="sender"]',
    '[aria-label*="from"]'
  ];
  
  yahooExplorer.senderElements = findElementsBySelectors(senderSelectors, 'sender elements');
  
  // Subject element selectors
  const subjectSelectors = [
    '[data-testid*="subject"]',
    'span[class*="subject"]',
    'div[class*="subject"]',
    '[title*="Subject"]',
    'span[class*="title"]',
    'div[class*="title"]',
    '[aria-label*="subject"]'
  ];
  
  yahooExplorer.subjectElements = findElementsBySelectors(subjectSelectors, 'subject elements');
  
  // Body element selectors
  const bodySelectors = [
    '[data-testid*="body"]',
    '[data-testid*="content"]',
    'div[class*="body"]',
    'div[class*="content"]',
    'div[class*="message"]',
    'div[class*="text"]',
    '[aria-label*="body"]',
    '[aria-label*="content"]'
  ];
  
  yahooExplorer.bodyElements = findElementsBySelectors(bodySelectors, 'body elements');
}

// Function to find clickable elements
function findClickableElements() {
  yahooExplorer.log('🔍 Searching for clickable elements...');
  
  const clickableSelectors = [
    '[role="button"]',
    '[role="listitem"]',
    '[tabindex]',
    'a[href]',
    'button',
    '[onclick]',
    '[data-testid*="click"]',
    '[data-testid*="button"]'
  ];
  
  yahooExplorer.clickableElements = findElementsBySelectors(clickableSelectors, 'clickable elements');
}

// Function to find elements with email addresses
function findEmailAddresses() {
  yahooExplorer.log('🔍 Searching for elements with email addresses...');
  
  const allElements = document.querySelectorAll('*');
  const emailElements = [];
  
  allElements.forEach((element, index) => {
    if (index > 1000) return; // Limit search to prevent performance issues
    
    try {
      const text = element.textContent;
      if (text && text.includes('@') && text.includes('.')) {
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          emailElements.push({
            element: getElementInfo(element),
            email: emailMatch[0],
            fullText: text.substring(0, 200)
          });
        }
      }
    } catch (error) {
      // Skip elements that cause errors
    }
  });
  
  yahooExplorer.emailAddresses = emailElements.slice(0, 20); // Limit to first 20
  yahooExplorer.log(`Found ${emailElements.length} elements with email addresses:`, yahooExplorer.emailAddresses);
}

// Function to analyze Yahoo-specific patterns
function analyzeYahooPatterns() {
  yahooExplorer.log('🔍 Analyzing Yahoo-specific patterns...');
  
  // Look for Yahoo's common class patterns
  const yahooClassPatterns = [
    '_yb_',
    'D_F',
    'W_6D6F',
    'P_1e3Qb0',
    'H_7zts',
    'k_w',
    'ab_CI',
    'e_0',
    'm_Z2utlOw',
    'I_ZiTj5d',
    'p_R',
    'j4_ZRKTmC',
    'Z4_N'
  ];
  
  yahooClassPatterns.forEach(pattern => {
    const elements = document.querySelectorAll(`[class*="${pattern}"]`);
    if (elements.length > 0) {
      yahooExplorer.log(`Found ${elements.length} elements with class pattern "${pattern}":`, 
        Array.from(elements).slice(0, 5).map(el => getElementInfo(el))
      );
    }
  });
}

// Function to find main content areas
function findMainContentAreas() {
  yahooExplorer.log('🔍 Searching for main content areas...');
  
  const mainContentSelectors = [
    'main',
    'div[role="main"]',
    'div[class*="main"]',
    'div[class*="content"]',
    'div[class*="body"]',
    'div[class*="inbox"]',
    'div[class*="mailbox"]',
    'div[class*="message"]',
    'div[class*="email"]',
    'div[class*="thread"]',
    'div[class*="list"]',
    'div[class*="container"]',
    'div[class*="wrapper"]',
    'div[class*="panel"]',
    'div[class*="section"]'
  ];
  
  findElementsBySelectors(mainContentSelectors, 'main content areas');
}

// Function to find scrollable areas
function findScrollableAreas() {
  yahooExplorer.log('🔍 Searching for scrollable areas...');
  
  const scrollableSelectors = [
    'div[style*="overflow"]',
    'div[class*="scroll"]',
    'div[class*="list"]',
    'div[class*="container"]',
    'div[class*="wrapper"]',
    'div[class*="panel"]',
    'div[class*="section"]'
  ];
  
  findElementsBySelectors(scrollableSelectors, 'scrollable areas');
}

// Function to generate comprehensive report
function generateReport() {
  yahooExplorer.log('📊 Generating comprehensive Yahoo Mail DOM report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    title: document.title,
    emailRows: yahooExplorer.emailRows,
    senderElements: yahooExplorer.senderElements,
    subjectElements: yahooExplorer.subjectElements,
    bodyElements: yahooExplorer.bodyElements,
    clickableElements: yahooExplorer.clickableElements,
    emailAddresses: yahooExplorer.emailAddresses,
    errors: yahooExplorer.errors
  };
  
  console.log('\n📊 === YAHOO MAIL DOM EXPLORER REPORT ===');
  console.log(`🌐 URL: ${report.url}`);
  console.log(`📄 Title: ${report.title}`);
  console.log(`📧 Email Rows Found: ${report.emailRows.length} types`);
  console.log(`👤 Sender Elements Found: ${report.senderElements.length} types`);
  console.log(`📝 Subject Elements Found: ${report.subjectElements.length} types`);
  console.log(`📄 Body Elements Found: ${report.bodyElements.length} types`);
  console.log(`🖱️ Clickable Elements Found: ${report.clickableElements.length} types`);
  console.log(`📧 Elements with Email Addresses: ${report.emailAddresses.length}`);
  console.log(`❌ Errors: ${report.errors.length}`);
  
  if (report.emailRows.length > 0) {
    console.log('\n📧 EMAIL ROW SELECTORS:');
    report.emailRows.forEach(row => {
      console.log(`  ${row.selector}: ${row.count} elements`);
    });
  }
  
  if (report.senderElements.length > 0) {
    console.log('\n👤 SENDER SELECTORS:');
    report.senderElements.forEach(sender => {
      console.log(`  ${sender.selector}: ${sender.count} elements`);
    });
  }
  
  if (report.subjectElements.length > 0) {
    console.log('\n📝 SUBJECT SELECTORS:');
    report.subjectElements.forEach(subject => {
      console.log(`  ${subject.selector}: ${subject.count} elements`);
    });
  }
  
  if (report.emailAddresses.length > 0) {
    console.log('\n📧 EMAIL ADDRESSES FOUND:');
    report.emailAddresses.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.email} in ${item.element.tag}.${item.element.classes}`);
    });
  }
  
  console.log('\n=== END REPORT ===\n');
  
  return report;
}

// Function to set up interactive inspection
function setupInteractiveInspection() {
  yahooExplorer.log('🖱️ Setting up interactive inspection...');
  
  // Add click handler for element inspection
  document.addEventListener('click', (event) => {
    const element = event.target;
    console.log('\n🖱️ CLICKED ELEMENT:');
    console.log('Element:', element);
    console.log('Tag:', element.tagName);
    console.log('Classes:', element.className);
    console.log('ID:', element.id);
    console.log('Text:', element.textContent?.substring(0, 100));
    console.log('Parent:', element.parentElement);
    console.log('Grandparent:', element.parentElement?.parentElement);
    console.log('Siblings:', Array.from(element.parentElement?.children || []).map(child => ({
      tag: child.tagName,
      classes: child.className,
      text: child.textContent?.substring(0, 50)
    })));
  });
  
  // Add helper functions to window
  window.yahooExplorer = {
    inspect: function(element) {
      if (!element) element = $0; // Use last clicked element
      console.log('🔍 Inspecting element:', element);
      console.log('Info:', getElementInfo(element));
      return getElementInfo(element);
    },
    
    findEmails: function() {
      findEmailElements();
      return yahooExplorer.emailRows;
    },
    
    findSenders: function() {
      findEmailElements();
      return yahooExplorer.senderElements;
    },
    
    findSubjects: function() {
      findEmailElements();
      return yahooExplorer.subjectElements;
    },
    
    findBodies: function() {
      findEmailElements();
      return yahooExplorer.bodyElements;
    },
    
    findClickables: function() {
      findClickableElements();
      return yahooExplorer.clickableElements;
    },
    
    findEmailAddresses: function() {
      findEmailAddresses();
      return yahooExplorer.emailAddresses;
    },
    
    analyzeYahoo: function() {
      analyzeYahooPatterns();
    },
    
    generateReport: function() {
      return generateReport();
    },
    
    runFullExploration: function() {
      findEmailElements();
      findClickableElements();
      findEmailAddresses();
      analyzeYahooPatterns();
      findMainContentAreas();
      findScrollableAreas();
      return generateReport();
    }
  };
  
  yahooExplorer.log('✅ Interactive inspection ready!');
  yahooExplorer.log('Available commands:');
  yahooExplorer.log('  yahooExplorer.inspect() - Inspect last clicked element');
  yahooExplorer.log('  yahooExplorer.findEmails() - Find email rows');
  yahooExplorer.log('  yahooExplorer.findSenders() - Find sender elements');
  yahooExplorer.log('  yahooExplorer.findSubjects() - Find subject elements');
  yahooExplorer.log('  yahooExplorer.findBodies() - Find body elements');
  yahooExplorer.log('  yahooExplorer.findClickables() - Find clickable elements');
  yahooExplorer.log('  yahooExplorer.findEmailAddresses() - Find elements with email addresses');
  yahooExplorer.log('  yahooExplorer.analyzeYahoo() - Analyze Yahoo-specific patterns');
  yahooExplorer.log('  yahooExplorer.generateReport() - Generate comprehensive report');
  yahooExplorer.log('  yahooExplorer.runFullExploration() - Run complete exploration');
}

// Main execution function
function runYahooExplorer() {
  yahooExplorer.log('🚀 Starting Yahoo Mail DOM exploration...');
  
  try {
    // Run all exploration functions
    findEmailElements();
    findClickableElements();
    findEmailAddresses();
    analyzeYahooPatterns();
    findMainContentAreas();
    findScrollableAreas();
    
    // Set up interactive inspection
    setupInteractiveInspection();
    
    // Generate final report
    const report = generateReport();
    
    yahooExplorer.log('✅ Yahoo Mail DOM exploration complete!');
    yahooExplorer.log('Use yahooExplorer.runFullExploration() to run again');
    
    return report;
    
  } catch (error) {
    yahooExplorer.error('Fatal error during exploration', error);
    return null;
  }
}

// Auto-run the explorer
const yahooReport = runYahooExplorer();

// Export for manual use
window.yahooExplorer = yahooExplorer;
window.yahooReport = yahooReport;

console.log('🎉 Yahoo Mail DOM Explorer loaded!');
console.log('Click on elements to inspect them, or use yahooExplorer commands.');
