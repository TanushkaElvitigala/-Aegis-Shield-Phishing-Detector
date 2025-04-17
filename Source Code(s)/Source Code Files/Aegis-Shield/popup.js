// Get the toggle button and icon
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('i');

// Check for saved theme preference or default to 'light'
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-bs-theme', savedTheme);
updateThemeIcon(savedTheme);

// Toggle theme when button is clicked
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Update theme
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    updateThemeIcon(newTheme);
});

// Function to update the icon based on theme
function updateThemeIcon(theme) {
    if (theme === 'dark') {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }
}

/**
 * Manages the extension's popup interface and user interactions
 * Handles UI events, data visualization, and communication with the background script
 */

// Initialize storage data structures on popup load
chrome.storage.local.get(['whitelist', 'blacklist', 'emailReports', 'urlScans', 'currentUrlScans'], function(result) {
  const whitelist = result.whitelist || [];
  const blacklist = result.blacklist || [];
  const emailReports = result.emailReports || [];
  const urlScans = result.urlScans || {};
  const currentUrlScans = result.currentUrlScans || {};
  displayLists(whitelist, blacklist);
});

// Sanitize HTML content to prevent XSS attacks
function escapeHTML(url) {
  return url.replace(/&/g, "&amp;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
}

// Display whitelist and blacklist URLs in the popup interface
function displayLists(whitelist, blacklist) {
  const whitelistElement = document.getElementById('whitelist');
  const blacklistElement = document.getElementById('blacklist');

  whitelistElement.innerHTML = '';
  blacklistElement.innerHTML = '';

  // Populate whitelist UI
  whitelist.forEach(url => {
    const li = document.createElement('li');
    li.textContent = url;

    const button = document.createElement('button');
    button.textContent = 'Remove';
    button.addEventListener('click', () => removeFromList('whitelist', url));

    li.appendChild(button);
    whitelistElement.appendChild(li);
  });

  // Populate blacklist UI
  blacklist.forEach(url => {
    const li = document.createElement('li');
    li.textContent = url;

    const button = document.createElement('button');
    button.textContent = 'Remove';
    button.addEventListener('click', () => removeFromList('blacklist', url));

    li.appendChild(button);
    blacklistElement.appendChild(li);
  });
}

// Add URL to whitelist or blacklist
async function addToList(listName, url) {
  // Validate URL input
  if (!url || url.trim() === "") {
    alert("Invalid URL. Please enter a valid URL.");
    return;
  }

  // Send message to background script to add URL
  const response = await chrome.runtime.sendMessage({
    action: listName === 'whitelist' ? 'addToWhitelist' : 'addToBlacklist',
    url: url.trim()
  });

  if (!response.success) {
    alert(response.message);
    return;
  }

  // Update UI after successful addition
  chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
    displayLists(result.whitelist || [], result.blacklist || []);
  });

  // Clear input field
  document.getElementById('url-input').value = '';
}

// Remove URL from whitelist or blacklis
async function removeFromList(listName, url) {
  const response = await chrome.runtime.sendMessage({
    action: listName === 'whitelist' ? 'removeFromWhitelist' : 'removeFromBlacklist',
    url: url
  });

  if (response.success) {
    // Update UI after successful removal
    chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
      displayLists(result.whitelist || [], result.blacklist || []);
    });
  }
}

// URL validation function for whitelist/blacklist
function validateListUrl(url) {
  if (!url || url.trim() === '') {
      return { isValid: false, error: 'URL cannot be empty' };
  }

  // Allow URLs starting with http://, https://, or www.
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
  }

  // Convert www. to https:// if needed
  return { 
      isValid: true, 
      url: url.startsWith('www.') ? 'https://' + url : url 
  };
}

// Event Listeners for List Management - whitelist
document.getElementById('add-whitelist').addEventListener('click', async () => {
  try {
      const url = document.getElementById('url-input').value.trim();
      
      // Validate URL
      if (!url || url.trim() === '') {
          alert('Please enter a URL');
          return;
      }

      // Check for http://, https://, or www.
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')) {
          alert('URL must start with http:// or https://');
          return;
      }

      // Convert www. to https:// if needed
      const validatedUrl = url.startsWith('www.') ? 'https://' + url : url;

      // Add to whitelist
      const response = await chrome.runtime.sendMessage({
          action: 'addToWhitelist',
          url: validatedUrl
      });

      if (!response.success) {
          alert(response.message);
          return;
      }

      // Update UI after successful addition
      chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
          displayLists(result.whitelist || [], result.blacklist || []);
      });

      // Clear input field
      document.getElementById('url-input').value = '';

  } catch (error) {
      console.error('Error adding to whitelist:', error);
      alert(error.message);
  }
});

// Event Listeners for List Management - blacklist
document.getElementById('add-blacklist').addEventListener('click', async () => {
  try {
      const url = document.getElementById('url-input').value.trim();
      
      // Validate URL
      if (!url || url.trim() === '') {
          alert('Please enter a URL');
          return;
      }

      // Check for http://, https://, or www.
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')) {
          alert('URL must start with http:// or https://');
          return;
      }

      // Convert www. to https:// if needed
      const validatedUrl = url.startsWith('www.') ? 'https://' + url : url;

      // Add to blacklist
      const response = await chrome.runtime.sendMessage({
          action: 'addToBlacklist',
          url: validatedUrl
      });

      if (!response.success) {
          alert(response.message);
          return;
      }

      // Update UI after successful addition
      chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
          displayLists(result.whitelist || [], result.blacklist || []);
      });

      // Clear input field
      document.getElementById('url-input').value = '';

  } catch (error) {
      console.error('Error adding to blacklist:', error);
      alert(error.message);
  }
});
// URL validation function for add current tab
function validateTabUrl(url) {
    if (!url || url.trim() === '') {
        return { isValid: false, error: 'URL cannot be empty' };
    }

    // Allow URLs starting with http://, https://, or www.
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')) {
        return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    // Convert www. to https:// if needed
    return { 
        isValid: true, 
        url: url.startsWith('www.') ? 'https://' + url : url 
    };
}

// addCurrentTab event listener
document.getElementById('addCurrentTab').addEventListener('click', async () => {
  try {
      // Query for active tab information
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tabs[0]?.url) {
          throw new Error('Unable to get current tab URL');
      }
      
      // Validate the current tab's URL
      const validation = validateTabUrl(tabs[0].url);
      if (!validation.isValid) {
          throw new Error(validation.error);
      }
      
      // Set the validated URL in the URL Management input
      const urlManagementInput = document.getElementById('url-input');
      urlManagementInput.value = validation.url;
      
      // Add visual feedback
      const addCurrentTabBtn = document.getElementById('addCurrentTab');
      addCurrentTabBtn.classList.add('btn-success');
      setTimeout(() => {
          addCurrentTabBtn.classList.remove('btn-success');
      }, 1000);
      
  } catch (error) {
      console.error('Error getting current tab:', error);
      // Show error to user
      const urlManagementInput = document.getElementById('url-input');
      urlManagementInput.value = '';
      urlManagementInput.placeholder = error.message;
      
      // Optional: Add visual feedback for error
      const addCurrentTabBtn = document.getElementById('addCurrentTab');
      addCurrentTabBtn.classList.add('btn-danger');
      setTimeout(() => {
          addCurrentTabBtn.classList.remove('btn-danger');
      }, 1000);
  }
});

/**
 * Generate and download comprehensive security report
 * Includes data from all scanning and detection systems
 */
document.getElementById('generate-report').addEventListener('click', async () => {
  const result = await chrome.storage.local.get([
    'whitelist', 
    'blacklist', 
    'emailReports', 
    'urlScans',
    'currentUrlScans'
  ]);

  const csvContent = generateEnhancedReportCSV(
    result.whitelist || [],
    result.blacklist || [],
    result.emailReports || [],
    result.urlScans || {},
    result.currentUrlScans || {}
  );

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Aegis_Sheild_report.csv";
  link.click();
});

// Generate CSV content for security report
function generateEnhancedReportCSV(whitelist, blacklist, emailReports, urlScans, currentUrlScans) {
  let csvContent = "Timestamp,URL/Content,Category,Analysis Type,Result,Details\n";
  
  const now = new Date().toISOString();
  
  // Add whitelist entries
  whitelist.forEach(url => {
    csvContent += `${now},${escapeCsvField(url)},Whitelist,Manual List,Allowed,User whitelisted\n`;
  });

  // Add blacklist entries
  blacklist.forEach(url => {
    csvContent += `${now},${escapeCsvField(url)},Blacklist,Manual List,Blocked,User blacklisted\n`;
  });

  // Add current URL scans
  Object.entries(currentUrlScans).forEach(([url, scan]) => {
    csvContent += `${scan.timestamp},${escapeCsvField(url)},URL Scan,Real-Time ML,${scan.prediction},Machine learning prediction\n`;
  });

  // Add email reports
  emailReports.forEach(report => {
    const truncatedContent = escapeCsvField(report.content.substring(0, 100) + (report.content.length > 100 ? '...' : ''));
    csvContent += `${report.timestamp},${truncatedContent},Email,ML Analysis,${report.prediction},Email content analyzed\n`;
  });

  return csvContent;
}

// Escape special characters in CSV fields
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  return `"${field.toString().replace(/"/g, '""')}"`;
}

// Store URL scan results in local storage
async function storeUrlScanResult(url, scanResult) {
  const timestamp = new Date().toISOString();
  const urlScans = (await chrome.storage.local.get('urlScans')).urlScans || {};
  
  urlScans[url] = {
    timestamp: timestamp,
    positives: scanResult.positives,
    total: scanResult.total,
    scanUrl: scanResult.scan_id
  };
  
  await chrome.storage.local.set({ urlScans });
}

// Store ML-based URL scan results
async function storeMLUrlScanResult(url, prediction, confidence) {
  const timestamp = new Date().toISOString();
  const currentUrlScans = (await chrome.storage.local.get('currentUrlScans')).currentUrlScans || {};
  
  currentUrlScans[url] = {
    timestamp: timestamp,
    prediction: prediction,
    confidence: confidence
  };
  
  await chrome.storage.local.set({ currentUrlScans });
}

// Store email analysis results
async function storeEmailAnalysisResult(content, prediction, confidence) {
  const timestamp = new Date().toISOString();
  const emailReports = (await chrome.storage.local.get('emailReports')).emailReports || [];
  
  emailReports.push({
    timestamp: timestamp,
    content: content,
    prediction: prediction,
    confidence: confidence
  });
  
  // Maintain a rolling window of 100 reports
  if (emailReports.length > 100) {
    emailReports.shift();
  }
  
  await chrome.storage.local.set({ emailReports });
}


// Event listeners for URL analysis
document.getElementById("check-url").addEventListener("click", async () => {
  const url = document.getElementById("mlUrlInput").value.trim();
  await analyzeUrl(url);
});

// ML-based URL Analysis Event Handlers
document.getElementById("check-url").addEventListener("clickx", async () => {
    const resultElement = document.getElementById("url-result");
    resultElement.textContent = "Analyzing...";

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const url = tabs[0].url;

        try {
            const response = await fetch("http://127.0.0.1:5000/predict/url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: url })
            });
            
            const data = await response.json();
            resultElement.textContent = `Prediction: ${data.prediction}`;
            
            await storeMLUrlScanResult(url, data.prediction, data.confidence);
        } catch (error) {
            resultElement.textContent = "Error detecting URL!";
            console.error("Error:", error);
        }
    });
});

// Input Validations
function validateUrl(url) {
  if (!url || url.trim() === '') {
      return { isValid: false, error: 'Please enter a URL' };
  }
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www')) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
  }
  return { isValid: true, error: '' };
}

function validateEmailContent(emailText) {
  if (!emailText || emailText.trim() === '') {
      return { isValid: false, error: 'Please enter email content' };
  }
  if (emailText.trim().length < 150) {
      return { isValid: false, error: 'Email content must be at least 150 characters long.' };
  }
  return { isValid: true, error: '' };
}


// Analyze URL using ML-based detection
async function analyzeUrl(url) {
  const resultElement = document.getElementById("url-result");
  
  // Validate URL
  const urlValidation = validateUrl(url);
  if (!urlValidation.isValid) {
      resultElement.textContent = urlValidation.error;
      resultElement.className = "error";
      return;
  }

  try {
      resultElement.textContent = "Analyzing...";
      const response = await fetch("http://127.0.0.1:5000/predict/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url })
      });
      
      if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      resultElement.textContent = `Prediction: ${data.prediction}`;
      resultElement.className = data.prediction === "Safe" ? "safe" : "dangerous";
      
      await storeMLUrlScanResult(url, data.prediction, data.confidence);
  } catch (error) {
      resultElement.textContent = `Error: ${error.message}`;
      resultElement.className = "error";
      console.error("Error analyzing URL:", error);
  }
}

// Event listeners for URL analysis
document.getElementById("check-url").addEventListener("click", async () => {
  const url = document.getElementById("mlUrlInput").value.trim();
  await analyzeUrl(url);
});

// checkCurrentTab event listener
document.getElementById("checkCurrentTab").addEventListener("click", async () => {
  try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.url) {
          throw new Error("Unable to get current tab URL");
      }
      
      const url = tabs[0].url;
      document.getElementById("mlUrlInput").value = url;
      await analyzeUrl(url);
  } catch (error) {
      const resultElement = document.getElementById("url-result");
      resultElement.textContent = `Error: ${error.message}`;
      resultElement.className = "error";
      console.error("Error getting current tab:", error);
  }
});

// ML-based Email Analysis Event Handler
document.getElementById('checkButton').addEventListener('click', async () => {
  const text = document.getElementById('emailContent').value;
  const result = document.getElementById('emailresult');
  
  // Validate email content
  const emailValidation = validateEmailContent(text);
  if (!emailValidation.isValid) {
      result.textContent = emailValidation.error;
      result.className = 'error';
      return;
  }

  try {
      const formData = new FormData();
      formData.append('email_text', text);
      
      const response = await fetch('http://localhost:5000/predict/email', {
          method: 'POST',
          body: formData,
          headers: {
              'Accept': 'application/json',
          },
          mode: 'cors'
      });

      const data = await response.json();
      result.textContent = `Prediction: ${data.prediction}`;
      result.className = data.prediction === 'Safe Email' ? 'safe' : 'phishing';
      
      await storeEmailAnalysisResult(text, data.prediction, data.confidence);
  } catch (error) {
      result.textContent = `Error: ${error.message || 'Could not connect to the server'}`;
      result.className = 'error';
  }
});

// Popup DOM Event Initialization and Handler Implementation
// This section manages the user interface interactions for URL and file scanning
// Initialize all DOM elements and event handlers when popup loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize DOM element references for UI interactions
  const fileInput = document.getElementById('fileInput');
  const scanFileButton = document.getElementById('scanFileButton');
  const fileResult = document.getElementById('fileResult');
  const progressBar = document.getElementById('fileProgress');
  const urlInput = document.getElementById('urlInput');
  const scanButton = document.getElementById('scanButton');
  const scanCurrentTab = document.getElementById('scanCurrentTab');
  const addCurrentTab = document.getElementById('addCurrentTab');
  const resultDiv = document.getElementById('result');

  // Clear functions
// Clear URL input and result
document.getElementById("clearUrlScan").addEventListener("click", () => {
  const urlInput = document.getElementById("urlInput");
  const resultDiv = document.getElementById("result");

  urlInput.value = ""; // Clear input field
  resultDiv.textContent = ""; // Clear result text
  resultDiv.className = ""; // Reset result styling
});

// Clear File input and result
document.getElementById("clearFileScan").addEventListener("click", () => {
  const fileInput = document.getElementById("fileInput");
  const fileResult = document.getElementById("fileResult");

  fileInput.value = ""; // Clear file input
  fileResult.textContent = ""; // Clear file result
  fileResult.className = ""; // Reset result styling
});

// Clear ML URL input and result
document.getElementById("clearMLUrlScan").addEventListener("click", () => {
  const mlUrlInput = document.getElementById("mlUrlInput");
  const urlresult = document.getElementById("url-result");

  mlUrlInput.value = ""; // Clear ML URL input
  urlresult.textContent = ""; // Clear ML result text
  urlresult.className = ""; // Reset result styling
});

// Clear Email content and result
document.getElementById("clearEmailContent").addEventListener("click", () => {
  const emailContent = document.getElementById("emailContent");
  const emailresult = document.getElementById("emailresult");

  emailContent.value = ""; // Clear email content
  emailresult.textContent = ""; // Clear email result
  emailresult.className = ""; // Reset result styling
});

  /**
   * Performs URL scanning using VirusTotal's API via background script
   * Handles the complete scanning process including result display and error handling
   */

  function validateVirusTotalUrl(url) {
    if (!url || url.trim() === '') {
        return { isValid: false, error: 'Please enter a URL' };
    }

    // Allow URLs starting with http://, https://, or www.
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')) {
        return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    return { isValid: true, url: url.startsWith('www.') ? 'https://' + url : url };
}

  async function scanWithVirusTotal(url) {
    const progressBar = document.getElementById('scanProgress');
    const resultDiv = document.getElementById('result');

    try {
        // Validate URL first
        const validation = validateVirusTotalUrl(url);
        if (!validation.isValid) {
            resultDiv.textContent = validation.error;
            resultDiv.className = 'error';
            return;
        }

        // Use the validated and potentially modified URL
        url = validation.url;

        // Show progress bar and reset its value
        progressBar.style.display = 'block';
        progressBar.value = 0;

        // Simulate progress for scanning
        let progressInterval = setInterval(() => {
            progressBar.value = Math.min(progressBar.value + 10, 90);
        }, 200);

        // Update UI to show scanning status
        resultDiv.textContent = 'Scanning URL...';
        resultDiv.className = 'loading';

        // Send scan request to background script
        const response = await chrome.runtime.sendMessage({
            action: "scanUrl",
            url: url,
        });

        // Clear interval and set progress to 100% when done
        clearInterval(progressInterval);
        progressBar.value = 100;

        // Handle error responses
        if (response.error) {
            throw new Error(response.error);
        }

        // Handle case where URL is not in VirusTotal database
        if (response.response_code === 0) {
            resultDiv.textContent = 'URL not found in VirusTotal database';
            resultDiv.className = 'warning';
            return;
        }

        // Process and display scan results
        const positives = response.positives;
        const total = response.total;

        // Update UI based on scan results
        if (positives === 0) {
            resultDiv.textContent = `Safe: No security vendors flagged this URL (0/${total})`;
            resultDiv.className = 'safe';
        } else {
            resultDiv.textContent = `Warning: ${positives} out of ${total} security vendors flagged this URL as malicious`;
            resultDiv.className = 'dangerous';
        }
    } catch (error) {
        // Handle and display any errors that occur during scanning
        resultDiv.textContent = `Error: ${error.message}`;
        resultDiv.className = 'error';
        console.error('Error:', error);
    } finally {
        // Hide progress bar after scanning
        progressBar.style.display = 'none';
    }
}

  /**
   * Event handler for manual URL scan button
   * Validates input and initiates URL scanning process
   */
  scanButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    await scanWithVirusTotal(url);
});

  /**
   * Event handler for scanning current active tab
   * Retrieves current tab URL and initiates scanning process
   */
  scanCurrentTab.addEventListener('click', async () => {
    try {
        // Query for active tab information
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.url) {
            urlInput.value = tabs[0].url;
            await scanWithVirusTotal(tabs[0].url);
        } else {
            resultDiv.textContent = 'Unable to get current tab URL';
            resultDiv.className = 'error';
        }
    } catch (error) {
        resultDiv.textContent = `Error: ${error.message}`;
        resultDiv.className = 'error';
        console.error('Error:', error);
    }
});

  /**
   * Event handler for file scanning
   * Manages file upload, scanning process, and result display
   * Includes file size validation and progress tracking
   */
  scanFileButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    
    // Validate file selection
    if (!file) {
      fileResult.textContent = 'Please select a file to scan';
      fileResult.className = 'warning';
      return;
    }

    // Validate file size (32MB limit)
    if (file.size > 32 * 1024 * 1024) {
      fileResult.textContent = 'File size must be less than 32MB';
      fileResult.className = 'error';
      return;
    }

    try {
      // Show scanning progress indicators
      progressBar.style.display = 'block';
      fileResult.textContent = 'Uploading and scanning file...';
      fileResult.className = 'loading';
      scanFileButton.disabled = true;

      // Initialize file reader for processing
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      
      /**
       * Handle successful file read
       * Converts file to base64 and sends to VirusTotal for scanning
       */
      reader.onload = async () => {
        try {
          // Convert file data to base64 format
          const base64String = btoa(
            new Uint8Array(reader.result)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          // Send file data to background script for scanning
          const response = await chrome.runtime.sendMessage({
            action: "scanFile",
            fileData: base64String
          });

          // Hide progress indicator
          progressBar.style.display = 'none';

          // Handle scan errors
          if (response.error) {
            throw new Error(response.error);
          }

          // Handle new files not previously scanned
          if (response.response_code === 0) {
            fileResult.textContent = 'File has not been scanned before';
            fileResult.className = 'warning';
            return;
          }

          // Process scan results
          const positives = response.positives;
          const total = response.total;

          // Generate detailed result HTML
          let resultHTML = `<div class="scan-summary">`;
          if (positives === 0) {
            resultHTML += `<div class="result-header safe">Safe: No security vendors flagged this file (0/${total})</div>`;
          } else {
            resultHTML += `<div class="result-header dangerous">Warning: ${positives} out of ${total} security vendors flagged this file</div>`;
          }

          // Add detailed scan information
          resultHTML += `
            <div class="scan-details">
              <p>File: ${file.name}</p>
              <p>Size: ${(file.size / 1024).toFixed(2)} KB</p>
              <p>Scan date: ${new Date(response.scan_date).toLocaleString()}</p>
              <p>SHA-256: ${response.sha256}</p>
            </div>
          </div>`;

          fileResult.innerHTML = resultHTML;
        } catch (error) {
          // Handle and display scanning errors
          fileResult.textContent = `Error: ${error.message}`;
          fileResult.className = 'error';
          progressBar.style.display = 'none';
        } finally {
          // Re-enable scan button
          scanFileButton.disabled = false;
        }
      };

    
       // Handle file read errors       
      reader.onerror = () => {
        fileResult.textContent = 'Error reading file';
        fileResult.className = 'error';
        progressBar.style.display = 'none';
        scanFileButton.disabled = false;
      };

    } catch (error) {
      // Handle any other errors in the scanning process
      fileResult.textContent = `Error: ${error.message}`;
      fileResult.className = 'error';
      progressBar.style.display = 'none';
      scanFileButton.disabled = false;
    }
  });
});

