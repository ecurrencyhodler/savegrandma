const { EMAIL_SELECTORS } = require('./selectors');

/**
 * Extract email data from DOM element
 */
function extractEmailData(element) {
  const emailData = {
    threadId: null,
    messageId: null,
    senderName: null,
    senderEmail: null,
    subject: null,
    snippet: null,
    body: null,
    replyToAddress: null,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Find thread ID - check if the element itself has the attribute first
    let threadId = element.getAttribute('data-legacy-thread-id');
    if (!threadId) {
      // If not, look for a child element with the attribute
      const threadIdEl = element.querySelector('[data-legacy-thread-id]');
      if (threadIdEl) {
        threadId = threadIdEl.getAttribute('data-legacy-thread-id');
      }
    }
    if (threadId) {
      emailData.threadId = threadId;
    }
    
    // Find message ID
    const messageIdEl = element.querySelector('[data-message-id]');
    if (messageIdEl) {
      emailData.messageId = messageIdEl.getAttribute('data-message-id');
    }
    
    // Find sender name and email
    for (const selector of EMAIL_SELECTORS.sender) {
      const senderEl = element.querySelector(selector);
      if (senderEl) {
        // Try to get email address from attribute first
        const emailAttr = senderEl.getAttribute('email');
        if (emailAttr) {
          emailData.senderEmail = emailAttr;
        }
        
        // Get sender name from text content
        const senderText = senderEl.textContent?.trim();
        if (senderText) {
          // If no email attribute, try to extract email from text
          if (!emailData.senderEmail && senderText.includes('@')) {
            const emailMatch = senderText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) {
              emailData.senderEmail = emailMatch[0];
              emailData.senderName = senderText.replace(emailMatch[0], '').trim();
            } else {
              emailData.senderName = senderText;
            }
          } else {
            emailData.senderName = senderText;
          }
          
          // Try to get full name from title attribute if text is truncated
          const titleAttr = senderEl.getAttribute('title');
          if (titleAttr && titleAttr.length > senderText.length) {
            emailData.senderName = titleAttr;
          }
        }
        
        if (emailData.senderEmail) break;
      }
    }
    
    // Find subject
    for (const selector of EMAIL_SELECTORS.subject) {
      const subjectEl = element.querySelector(selector);
      if (subjectEl) {
        emailData.subject = subjectEl.textContent?.trim();
        break;
      }
    }
    
    // Enhanced snippet extraction - try to get as much content as possible from inbox view
    for (const selector of EMAIL_SELECTORS.snippet) {
      const snippetEl = element.querySelector(selector);
      if (snippetEl) {
        emailData.snippet = snippetEl.textContent?.trim();
        break;
      }
    }
    
    // Try to get additional content from the email row itself
    if (!emailData.snippet || emailData.snippet.length < 50) {
      const rowText = element.innerText || element.textContent || '';
      if (rowText.length > (emailData.snippet?.length || 0)) {
        // Remove sender and subject from row text to get more snippet content
        let enhancedSnippet = rowText;
        if (emailData.senderName) {
          enhancedSnippet = enhancedSnippet.replace(emailData.senderName, '');
        }
        if (emailData.subject) {
          enhancedSnippet = enhancedSnippet.replace(emailData.subject, '');
        }
        emailData.snippet = enhancedSnippet.trim();
      }
    }
    
    // Find body (for opened emails only)
    for (const selector of EMAIL_SELECTORS.body) {
      const bodyEl = element.querySelector(selector);
      if (bodyEl) {
        emailData.body = bodyEl.textContent?.trim();
        break;
      }
    }
    
    // Find reply-to address (look in email headers for opened emails)
    const replyToEl = element.querySelector('[name="Reply-To"]') || 
                     element.querySelector('meta[name="Reply-To"]') ||
                     element.querySelector('[data-reply-to]');
    if (replyToEl) {
      emailData.replyToAddress = replyToEl.getAttribute('content') || 
                                replyToEl.getAttribute('data-reply-to') ||
                                replyToEl.textContent?.trim();
    }
    
    // Additional email extraction from headers (for opened emails)
    if (element.closest('.ii') || element.closest('.adP')) {
      // This is an opened email, try to find more detailed header info
      const headerEl = element.closest('.hP') || element.querySelector('.hP');
      if (headerEl) {
        // Look for additional email addresses in headers
        const allLinks = headerEl.querySelectorAll('a[href^="mailto:"]');
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('mailto:')) {
            const email = href.replace('mailto:', '');
            if (!emailData.senderEmail) {
              emailData.senderEmail = email;
            } else if (email !== emailData.senderEmail && !emailData.replyToAddress) {
              emailData.replyToAddress = email;
            }
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Error extracting email data:', error);
  }
  
  return emailData;
}

module.exports = extractEmailData;
