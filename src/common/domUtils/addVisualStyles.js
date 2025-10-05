/**
 * Add visual styles for the extension
 */
function addVisualStyles() {
  const styleId = 'savegrandma-styles';
  
  // Remove existing styles if they exist
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .savegrandma-warning-icon {
      display: inline-block;
      width: 16px;
      height: 16px;
      margin-left: 0;
      vertical-align: middle;
      cursor: pointer;
      border-radius: 2px;
      background-color: #dc3545;
      position: relative;
      font-size: 10px;
      line-height: 16px;
      text-align: center;
    }
    
    .savegrandma-safe-icon {
      display: inline-block;
      width: 16px;
      height: 16px;
      margin-left: 8px;
      vertical-align: middle;
      cursor: pointer;
      border-radius: 50%;
      background-color: #44ff44;
      position: relative;
    }
    
    .savegrandma-safe-icon::before {
      content: "✓";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 10px;
      font-weight: bold;
    }
    
    
    .savegrandma-popup {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      overflow: hidden;
    }
    
    .savegrandma-popup-header {
      background: #dc3545;
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .savegrandma-popup-title {
      display: flex;
      align-items: center;
      font-weight: bold;
      font-size: 16px;
    }
    
    .savegrandma-popup-title::before {
      content: "⚠️";
      margin-right: 8px;
      font-size: 18px;
    }
    
    .savegrandma-popup-close {
      background: none !important;
      border: none !important;
      color: white !important;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 4px !important;
      width: 20px !important;
      height: 20px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px !important;
      margin: 0 !important;
      font-weight: normal !important;
    }
    
    .savegrandma-popup-close:hover {
      background: rgba(255,255,255,0.1) !important;
    }
    
    .savegrandma-popup-content {
      padding: 16px;
    }
    
    .savegrandma-popup-score {
      font-weight: bold;
      font-size: 16px;
      color: #a71d2a;
      margin-bottom: 12px;
    }
    
    .savegrandma-popup-indicators {
      margin-top: 16px;
    }
    
    .savegrandma-popup-indicator {
      background: #fff3cd;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 8px;
    }
    
    .savegrandma-popup-indicator-title {
      font-weight: bold;
      color: #856404;
      margin-bottom: 4px;
    }
    
    .savegrandma-popup-indicator-description {
      color: #856404;
      margin-bottom: 4px;
    }
    
    .savegrandma-popup-indicator-value {
      color: #856404;
      font-style: italic;
      font-size: 12px;
    }
    
    .savegrandma-popup-warning {
      background: #f8d7da;
      border-radius: 4px;
      padding: 12px;
      margin-top: 16px;
      color: #721c24;
    }
    
    .savegrandma-popup-warning::before {
      content: "⚠";
      margin-right: 8px;
    }
    
    .savegrandma-popup-warning strong {
      font-weight: bold;
    }
    
    .savegrandma-popup button {
      background: #28a745;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      width: 100%;
      margin-top: 16px;
    }
    
    .savegrandma-popup button:hover {
      background: #218838;
    }
    
    .savegrandma-popup button:disabled {
      background: #6c757d;
      cursor: not-allowed;
      opacity: 0.6;
    }
  `;
  
  document.head.appendChild(style);
}

module.exports = addVisualStyles;
