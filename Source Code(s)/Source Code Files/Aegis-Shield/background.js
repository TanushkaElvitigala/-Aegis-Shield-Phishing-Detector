/**
 * Background Script - Phishing Detection Extension
 * 
 * This script serves as the core engine for the phishing detection extension, providing:
 * - Real-time URL monitoring and security scanning
 * - Integration with VirusTotal API for threat detection
 * - Whitelist/blacklist management for URLs
 * - File scanning capabilities for malware detection
 * - Caching system to optimize performance
 * - Chrome notification system for security alerts
 */

// Register installation handler to initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("Phishing Detection Extension Installed");
});

/**
 * URL Monitoring System
 * Listens for tab updates and performs security checks when pages load.
 * Features:
 * - Checks URLs against local whitelist/blacklist
 * - Implements caching to prevent redundant scans
 * - Integrates with VirusTotal for threat analysis
 * - Provides visual feedback through notifications
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only proceed if the page has finished loading and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Check if URL is already in whitelist or blacklist 
      // Retrieve whitelist and blacklist from storage
      const { whitelist = [], blacklist = [] } = await chrome.storage.local.get(['whitelist', 'blacklist']);
      
      // Check whitelist first for approved URLs
      if (whitelist.includes(tab.url)) {
        createNotification('Safe URL', 'This URL is in your whitelist');
        return;
      }
      
      // Check blacklist for known malicious URLs
      if (blacklist.includes(tab.url)) {
        createNotification('Warning', 'This URL is in your blacklist', 'high');
        return;
      }

      // Check if URL was recently scanned to avoid duplicate scans
      // Implement scan caching to prevent frequent rescans
      const { recentScans = {} } = await chrome.storage.local.get('recentScans');
      const now = Date.now();
      
      // Skip scan if URL was checked within the last hour
      if (recentScans[tab.url] && (now - recentScans[tab.url]) < 3600000) { // 1 hour cache
        return;
      }

      // Scan URL with VirusTotal
      const scanResult = await scanUrl(tab.url);
      
      // Update recent scans cache
      recentScans[tab.url] = now;
      await chrome.storage.local.set({ recentScans });

      // Handle URLs not found in VirusTotal database
      if (scanResult.response_code === 0) {
        createNotification('URL Status', 'URL not found in VirusTotal database');
        return;
      }

      // Process scan results
      const positives = scanResult.positives;
      const total = scanResult.total;

      if (positives === 0) {
        createNotification(
          'Safe URL',
          `No security vendors flagged this URL (0/${total})`
        );
      } else {
        // Alert user about potentially dangerous URL
        createNotification(
          'Warning - Potentially Dangerous URL',
          `${positives} out of ${total} security vendors flagged this URL as malicious`,
          'high'
        );

        // Change the icon to indicate danger
        await chrome.action.setIcon({
          path: {
            "16": "icons/danger16.png",
            "48": "icons/danger48.png",
            "128": "icons/danger128.png"
          },
          tabId: tabId
        });
      }

    } catch (error) {
      console.error('Error scanning URL:', error);
      createNotification('Error', 'Failed to scan URL');
    }
  }
});


// Creates customized notifications based on security status
function createNotification(title, message, priority = 'normal') {
  const options = {
    type: 'basic',
    iconUrl: priority === 'high' ? 'icons/danger48.png' : 'icons/icon48.png',
    title: title,
    message: message,
    priority: 2,
    requireInteraction: priority === 'high'
  };

  chrome.notifications.create(`phishing-alert-${Date.now()}`, options);
}

/**
 * URL Scan Cache Management
 * Implements caching system to store and retrieve scan results for URLs
 * using Chrome's local storage API
 */
async function getOrCreateScanCache() {
  // Destructure urlScanCache from storage with empty object fallback
  const { urlScanCache = {} } = await chrome.storage.local.get('urlScanCache');
  return urlScanCache;
}

async function updateScanCache(url, result) {
  // Get current cache state
  const cache = await getOrCreateScanCache();
  
  // Add new entry with result and current timestamp
  cache[url] = {
    result: result,
    timestamp: Date.now() // Store when this result was cached
  };
  
  // Save updated cache back to Chrome storage
  await chrome.storage.local.set({ urlScanCache: cache });
}

/**
 * URL Filtering Rule Management
 * Handles dynamic rule creation and updates for URL filtering using Chrome's 
 * declarativeNetRequest API for efficient network request filtering
 */

// Maximum number of dynamic rules allowed by Chrome's API
const MAX_RULES = 1000;

// Counter to generate unique rule IDs
let currentRuleId = 1;

/**
 * Set up initial filtering rules when extension is installed or updated
 */
chrome.runtime.onInstalled.addListener(async () => {
  await initializeRules();
});

/**
 * Initializes URL filtering rules from stored whitelist and blacklist
 * Clears existing rules and creates new ones based on stored preferences
*/
async function initializeRules() {
  // Get stored lists with empty array fallbacks
  const { whitelist = [], blacklist = [] } = await chrome.storage.local.get(['whitelist', 'blacklist']);
  
  // Remove all existing dynamic rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: await getCurrentRuleIds()
  });

  // Create block rules for blacklisted URLs (lower priority)
  for (const url of blacklist) {
    await addBlockRule(url);
  }
  // Create allow rules for whitelisted URLs (higher priority)
  for (const url of whitelist) {
    await addAllowRule(url);
  }
}

/**
 * Retrieves IDs of all current dynamic rules
*/
async function getCurrentRuleIds() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.map(rule => rule.id);
}

/**
 * Creates a new rule to block requests to specified URL
*/
async function addBlockRule(url) {
  const rule = {
    id: currentRuleId++,
    priority: 1,  // Lower priority than allow rules
    action: { type: 'block' },
    condition: {
      urlFilter: url,
      resourceTypes: ['main_frame']  // Only block main page loads, not resources
    }
  };

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [rule],
    removeRuleIds: []
  });
}

/**
 * Creates a new rule to explicitly allow requests to specified URL
*/
async function addAllowRule(url) {
  const rule = {
    id: currentRuleId++,
    priority: 2,  // Higher priority to override block rules
    action: { type: 'allow' },
    condition: {
      urlFilter: url,
      resourceTypes: ['main_frame']  // Only affect main page loads
    }
  };

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [rule],
    removeRuleIds: []
  });
}

/**
 * Removes filtering rule for specified URL if it exists
*/
async function removeRule(url) {
  // Find rule matching the URL pattern
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleToRemove = rules.find(rule => rule.condition.urlFilter === url);
  
  // Remove the rule if found
  if (ruleToRemove) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleToRemove.id]
    });
  }
}

/**
 * Message Handler
 * Processes extension messages for various operations including:
 * - URL whitelist/blacklist management
 * - URL scanning
 * - File scanning
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Use switch statement to route different message types to appropriate handlers
  switch (request.action) {
    case "addToBlacklist":
      // Add URL to blacklist and set up blocking rule
      handleAddToBlacklist(request.url).then(sendResponse);
      break;

    case "addToWhitelist":
      // Add URL to whitelist and set up allowing rule
      handleAddToWhitelist(request.url).then(sendResponse);
      break;

    case "removeFromBlacklist":
      // Remove URL from blacklist and its blocking rule
      handleRemoveFromBlacklist(request.url).then(sendResponse);
      break;

    case "removeFromWhitelist":
      // Remove URL from whitelist and its allowing rule
      handleRemoveFromWhitelist(request.url).then(sendResponse);
      break;

    case "scanUrl":
      // Perform security scan on specified URL
      scanUrl(request.url)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      break;

    case "scanFile":
      // Convert base64 file data to blob for scanning
      const binaryString = atob(request.fileData);  // Decode base64
      const bytes = new Uint8Array(binaryString.length);
      
      // Convert binary string to byte array
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob from byte array for file scanning
      const blob = new Blob([bytes]);
      
      // Perform security scan on file blob
      scanFile(blob)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      break;
  }
  
  // Return true to indicate async response will be sent
  // This keeps the message channel open for async operations
  return true;
});

/**
* Whitelist/Blacklist Management Functions
* Handle adding and removing URLs from security lists and maintaining
* corresponding filtering rules in Chrome's declarativeNetRequest
*/

/**
* Adds a URL to the blacklist if not already present in either list
* URL to blacklist
* Operation result with success status and message
*/
async function handleAddToBlacklist(url) {
  // Get current lists with empty array fallbacks
  const { whitelist = [], blacklist = [] } = await chrome.storage.local.get(['whitelist', 'blacklist']);
 
  // Check if URL is already in blacklist
  if (blacklist.includes(url)) {
    return { success: false, message: "URL already blacklisted." };
  }
 
  // Prevent conflicts with whitelist
  if (whitelist.includes(url)) {
    return { success: false, message: "URL is in whitelist." };
  }
 
  // Add blocking rule and update storage
  await addBlockRule(url);
  await chrome.storage.local.set({ blacklist: [...blacklist, url] });
  return { success: true };
 }
 
 /**
 * Adds a URL to the whitelist if not already present in either list
 * URL to whitelist 
 * Operation result with success status and message
 */
 async function handleAddToWhitelist(url) {
  // Get current lists with empty array fallbacks
  const { whitelist = [], blacklist = [] } = await chrome.storage.local.get(['whitelist', 'blacklist']);
 
  // Check if URL is already in whitelist
  if (whitelist.includes(url)) {
    return { success: false, message: "URL already whitelisted." };
  }
 
  // Prevent conflicts with blacklist
  if (blacklist.includes(url)) {
    return { success: false, message: "URL is in blacklist." };
  }
 
  // Add allow rule and update storage
  await addAllowRule(url);
  await chrome.storage.local.set({ whitelist: [...whitelist, url] });
  return { success: true };
 }
 
 /**
 * Removes a URL from the blacklist and its corresponding blocking rule
 * URL to remove from blacklist
 * Operation result with success status
 */
 async function handleRemoveFromBlacklist(url) {
  // Get current blacklist with empty array fallback
  const { blacklist = [] } = await chrome.storage.local.get('blacklist');
  
  // Remove URL from list
  const updatedBlacklist = blacklist.filter(item => item !== url);
  
  // Remove filtering rule and update storage
  await removeRule(url);
  await chrome.storage.local.set({ blacklist: updatedBlacklist });
  
  // Show notification to user
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'URL Unblocked',
    message: 'URL removed from blacklist'
  });
 
  return { success: true };
 }
 
 /**
 * Removes a URL from the whitelist and its corresponding allow rule
 * URL to remove from whitelist
 * Operation result with success status
 */
 async function handleRemoveFromWhitelist(url) {
  // Get current whitelist with empty array fallback
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  
  // Remove URL from list
  const updatedWhitelist = whitelist.filter(item => item !== url);
  
  // Remove filtering rule and update storage
  await removeRule(url);
  await chrome.storage.local.set({ whitelist: updatedWhitelist });
  
  // Show notification to user
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'URL Removed',
    message: 'URL removed from whitelist'
  });
 
  return { success: true };
 }

/**
* VirusTotal API Integration
* Handles URL and file scanning using VirusTotal's API v2
* Includes secure API key management and scan result retrieval
*/

// API key storage - initialized as empty and populated securely at runtime
let VIRUSTOTAL_API_KEY = ""; 

/**
* Fetches the VirusTotal API key from secure backend server
* Uses local Flask server to avoid exposing key in extension code
*/
fetch('http://127.0.0.1:5000/get_api_key')
 .then(response => response.json())
 .then(data => {
   if (data.api_key) {
     VIRUSTOTAL_API_KEY = data.api_key;
   } else {
     console.error('Failed to fetch API key: No key in response');
   }
 })
 .catch(error => {
   console.error('Error fetching API key:', error);
 });

/**
* Scans a URL using VirusTotal's API
* Submits URL for scanning and retrieves analysis results
* The URL to scan
* Scan results from VirusTotal
* If API requests fail
*/
async function scanUrl(url) {
 try {
   // Set up form data for scan request
   const scanFormData = new URLSearchParams();
   scanFormData.append('apikey', VIRUSTOTAL_API_KEY);
   scanFormData.append('url', url);

   // Submit URL for scanning
   const scanResponse = await fetch('https://www.virustotal.com/vtapi/v2/url/scan', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded'
     },
     body: scanFormData
   });

   // Validate scan submission response
   if (!scanResponse.ok) {
     throw new Error('Scan request failed');
   }

   // Allow time for scan to complete
   // VirusTotal recommends waiting before requesting results
   await new Promise(resolve => setTimeout(resolve, 3000));

   // Request scan results using URL as resource identifier
   const reportResponse = await fetch(
     `https://www.virustotal.com/vtapi/v2/url/report?apikey=${VIRUSTOTAL_API_KEY}&resource=${encodeURIComponent(url)}`,
     { method: 'GET' }
   );

   // Validate report response
   if (!reportResponse.ok) {
     throw new Error('Report request failed');
   }

   // Parse and return scan results
   return await reportResponse.json();
 } catch (error) {
   // Wrap and rethrow API errors with context
   throw new Error(`API request failed: ${error.message}`);
 }
}

/**
* File Scanning System
* Handles malware scanning for uploaded files using VirusTotal's API
* Includes file upload, progress tracking, and results retrieval
*/

/**
* Scans a file for malware using VirusTotal's API
* Uploads file, initiates scan, and polls for results
* 
* The file data to scan
* Complete scan results from VirusTotal
* If file upload or scanning fails
*/
async function scanFile(fileData) {
  try {
    // Prepare multipart form data for file upload
    const formData = new FormData();
    formData.append('apikey', VIRUSTOTAL_API_KEY);
    formData.append('file', fileData);
 
    // Upload file to VirusTotal for scanning
    const uploadResponse = await fetch('https://www.virustotal.com/vtapi/v2/file/scan', {
      method: 'POST',
      body: formData
    });
 
    // Validate upload response
    if (!uploadResponse.ok) {
      throw new Error('File upload failed');
    }
 
    // Extract resource identifier from upload response
    const uploadResult = await uploadResponse.json();
    const resource = uploadResult.resource;
 
    // Get initial scan report
    let report = await getFileReport(resource);
 
    // Poll for completed results with timeout
    // response_code -2 indicates scan in progress
    let attempts = 20; // Maximum 5 minute wait (20 attempts * 15 seconds)
    while (report.response_code === -2 && attempts > 0) {
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay between polls
      report = await getFileReport(resource);
      attempts--;
    }
 
    return report;
  } catch (error) {
    throw new Error(`File scan failed: ${error.message}`);
  }
 }
 
 /**
 * Retrieves a file scan report from VirusTotal
 * 
 * Resource identifier from file upload
 * Scan report data
 * If report retrieval fails
 */
 async function getFileReport(resource) {
  try {
    // Request scan results using resource identifier
    const reportResponse = await fetch(
      `https://www.virustotal.com/vtapi/v2/file/report?apikey=${VIRUSTOTAL_API_KEY}&resource=${resource}`,
      { method: 'GET' }
    );
 
    // Validate report response
    if (!reportResponse.ok) {
      throw new Error('Failed to get file report');
    }
 
    // Parse and return report data
    return await reportResponse.json();
  } catch (error) {
    throw new Error(`Failed to get file report: ${error.message}`);
  }
 }

