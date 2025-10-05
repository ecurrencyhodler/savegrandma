// Test script to verify email analysis is working correctly
// Run this in the browser console on Gmail to test the analysis

console.log('🧪 Testing SaveGrandma Email Analysis...');

// Test data for suspicious emails
const testEmails = [
  {
    name: 'Microsoft Support',
    email: 'support@gmail.com',
    subject: 'Urgent: Verify your account immediately',
    body: 'Your account is overdue. Click here to verify immediately.',
    snippet: 'Your account is overdue. Click here to verify immediately.',
    expectedScore: 4, // Display name mismatch (3) + urgency (1) = 4
    expectedPhishing: true
  },
  {
    name: 'John Doe',
    email: 'john@suspicious.tk',
    subject: 'Important message',
    body: 'This is an important message',
    snippet: 'This is an important message',
    expectedScore: 2, // Suspicious domain (2)
    expectedPhishing: false
  },
  {
    name: 'PayPal Security',
    email: 'security@gmail.com',
    subject: 'Urgent: Your account is overdue',
    body: 'Act now to verify your account. Click here to confirm your identity.',
    snippet: 'Act now to verify your account. Click here to confirm your identity.',
    expectedScore: 4, // Display name mismatch (3) + urgency (1) = 4
    expectedPhishing: true
  },
  {
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Regular email',
    body: 'This is a regular email with no suspicious content.',
    snippet: 'This is a regular email with no suspicious content.',
    expectedScore: 0,
    expectedPhishing: false
  }
];

// Function to test analysis
function testEmailAnalysis() {
  if (typeof window.SaveGrandmaDebug === 'undefined' || !window.SaveGrandmaDebug.analyzeEmailForPhishing) {
    console.error('❌ SaveGrandma not loaded or analyzeEmailForPhishing function not available');
    return;
  }

  console.log('✅ SaveGrandma analysis function found, running tests...\n');

  let passedTests = 0;
  let totalTests = testEmails.length;

  testEmails.forEach((testEmail, index) => {
    console.log(`--- Test ${index + 1}: ${testEmail.name} ---`);
    
    const emailData = {
      senderName: testEmail.name,
      senderEmail: testEmail.email,
      subject: testEmail.subject,
      body: testEmail.body,
      snippet: testEmail.snippet,
      threadId: `test-${index}`
    };

    const result = window.SaveGrandmaDebug.analyzeEmailForPhishing(emailData);
    
    console.log(`Score: ${result.score} (expected: ${testEmail.expectedScore})`);
    console.log(`Phishing: ${result.isPhishing} (expected: ${testEmail.expectedPhishing})`);
    console.log(`Indicators: ${result.indicators.length}`);
    
    if (result.indicators.length > 0) {
      result.indicators.forEach(indicator => {
        console.log(`  - ${indicator.type}: ${indicator.description}`);
      });
    }
    
    const scoreMatch = result.score === testEmail.expectedScore;
    const phishingMatch = result.isPhishing === testEmail.expectedPhishing;
    
    if (scoreMatch && phishingMatch) {
      console.log('✅ PASS');
      passedTests++;
    } else {
      console.log('❌ FAIL');
      if (!scoreMatch) console.log(`   Score mismatch: got ${result.score}, expected ${testEmail.expectedScore}`);
      if (!phishingMatch) console.log(`   Phishing mismatch: got ${result.isPhishing}, expected ${testEmail.expectedPhishing}`);
    }
    
    console.log('');
  });

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Email analysis is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the analysis logic.');
  }
}

// Run the test
testEmailAnalysis();
