// Debug script to identify resource loading errors
// Run this in the browser console to investigate 400 errors

console.log('🔍 SaveGrandma Resource Error Debugger');
console.log('=====================================');

// Override console.error to capture resource loading errors
const originalConsoleError = console.error;
const resourceErrors = [];

console.error = function(...args) {
  const message = args.join(' ');
  if (message.includes('Failed to load resource') && message.includes('400')) {
    resourceErrors.push({
      timestamp: new Date().toISOString(),
      message: message,
      stack: new Error().stack
    });
    console.log('🚨 Captured resource error:', message);
  }
  originalConsoleError.apply(console, args);
};

// Monitor network requests
if (typeof window !== 'undefined' && window.performance && window.performance.getEntriesByType) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.responseStatus && entry.responseStatus >= 400) {
        console.log('🚨 Network error detected:', {
          url: entry.name,
          status: entry.responseStatus,
          duration: entry.duration,
          startTime: entry.startTime
        });
      }
    }
  });
  
  try {
    observer.observe({ entryTypes: ['resource'] });
    console.log('✅ Network monitoring enabled');
  } catch (error) {
    console.log('⚠️ Network monitoring not available:', error.message);
  }
}

// Check for SaveGrandma-specific issues
function checkSaveGrandmaResources() {
  console.log('\n📊 SaveGrandma Resource Analysis:');
  
  // Check if extension is loaded
  if (typeof window.SaveGrandmaDebug !== 'undefined') {
    console.log('✅ SaveGrandma extension loaded');
    console.log('   Status:', window.SaveGrandmaDebug.status);
    console.log('   Email rows processed:', window.SaveGrandmaDebug.emailRows?.length || 0);
  } else {
    console.log('❌ SaveGrandma extension not loaded');
  }
  
  // Check for visual indicator styles
  const styles = document.querySelectorAll('style');
  let saveGrandmaStyles = false;
  styles.forEach(style => {
    if (style.textContent.includes('savegrandma')) {
      saveGrandmaStyles = true;
    }
  });
  
  if (saveGrandmaStyles) {
    console.log('✅ SaveGrandma styles loaded');
  } else {
    console.log('❌ SaveGrandma styles not found');
  }
  
  // Check for warning icons
  const warningIcons = document.querySelectorAll('.savegrandma-warning-icon, .savegrandma-safe-icon');
  console.log(`📊 Found ${warningIcons.length} visual indicators`);
  
  // Check for any script errors
  const scriptErrors = resourceErrors.filter(error => 
    error.message.includes('script') || error.message.includes('.js')
  );
  
  if (scriptErrors.length > 0) {
    console.log(`🚨 Found ${scriptErrors.length} script loading errors:`);
    scriptErrors.forEach(error => {
      console.log('   -', error.message);
    });
  }
  
  // Check for CSS errors
  const cssErrors = resourceErrors.filter(error => 
    error.message.includes('css') || error.message.includes('.css')
  );
  
  if (cssErrors.length > 0) {
    console.log(`🚨 Found ${cssErrors.length} CSS loading errors:`);
    cssErrors.forEach(error => {
      console.log('   -', error.message);
    });
  }
  
  // Check for image errors
  const imageErrors = resourceErrors.filter(error => 
    error.message.includes('png') || error.message.includes('jpg') || error.message.includes('gif')
  );
  
  if (imageErrors.length > 0) {
    console.log(`🚨 Found ${imageErrors.length} image loading errors:`);
    imageErrors.forEach(error => {
      console.log('   -', error.message);
    });
  }
  
  return {
    totalErrors: resourceErrors.length,
    scriptErrors: scriptErrors.length,
    cssErrors: cssErrors.length,
    imageErrors: imageErrors.length
  };
}

// Run the analysis
setTimeout(() => {
  const results = checkSaveGrandmaResources();
  
  console.log('\n📈 Summary:');
  console.log(`Total resource errors: ${results.totalErrors}`);
  console.log(`Script errors: ${results.scriptErrors}`);
  console.log(`CSS errors: ${results.cssErrors}`);
  console.log(`Image errors: ${results.imageErrors}`);
  
  if (results.totalErrors === 0) {
    console.log('✅ No resource loading errors detected');
  } else {
    console.log('⚠️ Resource loading errors detected - this may affect extension functionality');
  }
  
  // Restore original console.error
  console.error = originalConsoleError;
}, 2000);

console.log('🔍 Monitoring resource errors for 2 seconds...');
