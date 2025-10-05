// Comprehensive diagnostic test for SaveGrandma extension
// Run this in the browser console on Gmail to test all major functions

console.log('🔍 SaveGrandma Comprehensive Diagnostic Test');
console.log('==========================================');

// Test 1: Check if SaveGrandma is loaded
function testSaveGrandmaLoaded() {
  console.log('\n1. Testing SaveGrandma Loading...');
  
  if (typeof window.SaveGrandmaDebug === 'undefined') {
    console.error('❌ SaveGrandma not loaded - window.SaveGrandmaDebug not found');
    return false;
  }
  
  console.log('✅ SaveGrandma loaded successfully');
  console.log('   Status:', window.SaveGrandmaDebug.status);
  console.log('   Email rows found:', window.SaveGrandmaDebug.emailRows?.length || 0);
  console.log('   Errors:', window.SaveGrandmaDebug.errors?.length || 0);
  
  return true;
}

// Test 2: Check email analysis function
function testEmailAnalysis() {
  console.log('\n2. Testing Email Analysis Function...');
  
  if (!window.SaveGrandmaDebug.analyzeEmailForPhishing) {
    console.error('❌ analyzeEmailForPhishing function not available');
    return false;
  }
  
  // Test with a known suspicious email
  const testEmail = {
    senderName: 'Microsoft Support',
    senderEmail: 'support@gmail.com',
    subject: 'Urgent: Verify your account immediately',
    body: 'Your account is overdue. Click here to verify immediately.',
    snippet: 'Your account is overdue. Click here to verify immediately.',
    threadId: 'test-123'
  };
  
  const result = window.SaveGrandmaDebug.analyzeEmailForPhishing(testEmail);
  
  console.log('✅ Analysis function working');
  console.log('   Score:', result.score);
  console.log('   Is Phishing:', result.isPhishing);
  console.log('   Indicators:', result.indicators.length);
  
  if (result.score >= 3 && result.isPhishing) {
    console.log('✅ Analysis correctly identifies suspicious email');
    return true;
  } else {
    console.error('❌ Analysis failed to identify suspicious email');
    return false;
  }
}

// Test 3: Check whitelist functions
function testWhitelistFunctions() {
  console.log('\n3. Testing Whitelist Functions...');
  
  const requiredFunctions = [
    'addToWhitelist',
    'removeFromWhitelist', 
    'isWhitelisted',
    'isWhitelistAtCapacity',
    'getWhitelist'
  ];
  
  let allFunctionsPresent = true;
  
  requiredFunctions.forEach(funcName => {
    if (typeof window.SaveGrandmaDebug[funcName] !== 'function') {
      console.error(`❌ ${funcName} function not available`);
      allFunctionsPresent = false;
    } else {
      console.log(`✅ ${funcName} function available`);
    }
  });
  
  if (!allFunctionsPresent) {
    return false;
  }
  
  // Test whitelist operations
  try {
    const testEmail = 'test@example.com';
    
    // Test adding to whitelist
    const addResult = window.SaveGrandmaDebug.addToWhitelist(testEmail);
    console.log('✅ addToWhitelist function callable');
    
    // Test checking whitelist
    const isWhitelisted = window.SaveGrandmaDebug.isWhitelisted(testEmail);
    console.log('✅ isWhitelisted function working');
    
    // Test removing from whitelist
    const removeResult = window.SaveGrandmaDebug.removeFromWhitelist(testEmail);
    console.log('✅ removeFromWhitelist function callable');
    
    return true;
  } catch (error) {
    console.error('❌ Error testing whitelist functions:', error);
    return false;
  }
}

// Test 4: Check DOM monitoring
function testDOMMonitoring() {
  console.log('\n4. Testing DOM Monitoring...');
  
  // Check if email rows are being detected
  const emailRows = document.querySelectorAll('.zA, tr[role="button"]');
  console.log(`   Found ${emailRows.length} email rows in DOM`);
  
  if (emailRows.length === 0) {
    console.warn('⚠️  No email rows found - make sure you are on Gmail inbox page');
    return false;
  }
  
  // Check if SaveGrandma has processed any emails
  const processedEmails = window.SaveGrandmaDebug.emailRows?.length || 0;
  console.log(`   SaveGrandma has processed ${processedEmails} emails`);
  
  if (processedEmails > 0) {
    console.log('✅ DOM monitoring is working - emails are being processed');
    return true;
  } else {
    console.warn('⚠️  No emails processed yet - DOM monitoring may not be working');
    return false;
  }
}

// Test 5: Check visual indicators
function testVisualIndicators() {
  console.log('\n5. Testing Visual Indicators...');
  
  // Check if warning icons exist
  const warningIcons = document.querySelectorAll('.savegrandma-warning-icon');
  console.log(`   Found ${warningIcons.length} warning icons`);
  
  // Check if popup styles are loaded
  const popupStyles = document.querySelector('style[data-savegrandma]') || 
                     Array.from(document.querySelectorAll('style')).find(style => 
                       style.textContent.includes('savegrandma-warning-icon'));
  
  if (popupStyles) {
    console.log('✅ Visual indicator styles loaded');
  } else {
    console.warn('⚠️  Visual indicator styles not found');
  }
  
  if (warningIcons.length > 0) {
    console.log('✅ Visual indicators are being displayed');
    return true;
  } else {
    console.warn('⚠️  No visual indicators found - may indicate no suspicious emails or visual system not working');
    return false;
  }
}

// Test 6: Check statistics tracking
function testStatisticsTracking() {
  console.log('\n6. Testing Statistics Tracking...');
  
  const stats = window.SaveGrandmaDebug.scanSummary;
  console.log('   Scan Summary:', {
    totalEmailsScanned: stats.totalEmailsScanned || 0,
    threatsIdentified: stats.threatsIdentified || 0,
    isScanActive: stats.isScanActive || false,
    scanStartTime: stats.scanStartTime ? new Date(stats.scanStartTime).toISOString() : 'Not started'
  });
  
  if (stats.totalEmailsScanned > 0) {
    console.log('✅ Statistics tracking is working');
    return true;
  } else {
    console.warn('⚠️  No emails scanned yet - statistics tracking may not be working');
    return false;
  }
}

// Test 7: Check storage functions
function testStorageFunctions() {
  console.log('\n7. Testing Storage Functions...');
  
  // Check if Chrome storage is available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error('❌ Chrome storage API not available');
    return false;
  }
  
  console.log('✅ Chrome storage API available');
  
  // Test storage access
  chrome.storage.local.get(['test_key'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Chrome storage access failed:', chrome.runtime.lastError);
    } else {
      console.log('✅ Chrome storage access working');
    }
  });
  
  return true;
}

// Test 8: Check message passing
function testMessagePassing() {
  console.log('\n8. Testing Message Passing...');
  
  // Check if message listener is set up
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) {
    console.error('❌ Chrome runtime message API not available');
    return false;
  }
  
  console.log('✅ Chrome runtime message API available');
  
  // Test sending a message to the extension
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Message passing failed:', chrome.runtime.lastError);
    } else {
      console.log('✅ Message passing working, response:', response);
    }
  });
  
  return true;
}

// Run all tests
function runAllTests() {
  const tests = [
    testSaveGrandmaLoaded,
    testEmailAnalysis,
    testWhitelistFunctions,
    testDOMMonitoring,
    testVisualIndicators,
    testStatisticsTracking,
    testStorageFunctions,
    testMessagePassing
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  tests.forEach((test, index) => {
    try {
      const result = test();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      console.error(`❌ Test ${index + 1} failed with error:`, error);
    }
  });
  
  console.log('\n📊 DIAGNOSTIC RESULTS');
  console.log('====================');
  console.log(`Tests passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! SaveGrandma is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the issues above.');
  }
  
  // Additional recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (passedTests < totalTests) {
    console.log('- Reload the extension in chrome://extensions');
    console.log('- Refresh the Gmail page');
    console.log('- Check the browser console for any error messages');
    console.log('- Make sure you are on the Gmail inbox page (not compose or settings)');
  }
  
  return { passed: passedTests, total: totalTests };
}

// Run the diagnostic test
runAllTests();
