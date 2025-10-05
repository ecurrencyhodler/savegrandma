/**
 * Get Gmail account ID from URL or return default
 */
function getGmailAccountId(url = null) {
  try {
    const currentUrl = url || window.location.href;
    const urlObj = new URL(currentUrl);
    
    // Extract account from URL path (e.g., /mail/u/0/ -> 0)
    const pathMatch = urlObj.pathname.match(/\/mail\/u\/(\d+)\//);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    // Extract account from search params
    const searchParams = new URLSearchParams(urlObj.search);
    const accountParam = searchParams.get('account');
    if (accountParam) {
      return accountParam;
    }
    
    // Default to 0 for main account
    return '0';
  } catch (error) {
    console.error('Error getting Gmail account ID:', error);
    return '0';
  }
}

module.exports = getGmailAccountId;
