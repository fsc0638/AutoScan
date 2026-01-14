/**
 * AutoScan - Main Application
 * 
 * This file handles UI interactions, file parsing, and coordinates 
 * the AI analysis flow using the selected model and configuration.
 */

// ==========================================
// 1. State Management
// ==========================================
let transcript = '';
let currentKeyPoints = [];
let statusTimeout = null; // Fix for status message race conditions

// ==========================================
// 2. DOM Elements
// ==========================================
const elements = {
  // Tab Navigation
  tabBtns: document.querySelectorAll('.tab-btn'),
  uploadTab: document.getElementById('uploadTab'),
  pasteTab: document.getElementById('pasteTab'),

  // File Upload
  uploadZone: document.getElementById('uploadZone'),
  fileInput: document.getElementById('fileInput'),
  fileInfo: document.getElementById('fileInfo'),
  fileName: document.getElementById('fileName'),
  fileSize: document.getElementById('fileSize'),

  // Manual Input
  manualTranscript: document.getElementById('manualTranscript'),

  // Controls
  analyzeBtn: document.getElementById('analyzeBtn'),
  languageSelect: document.getElementById('languageSelect'),
  statusMessage: document.getElementById('statusMessage'),

  // Models (handled in model-selector.js but we might need refs)
  modelProvider: document.getElementById('modelProvider'),
  modelVersion: document.getElementById('modelVersion'),

  // Results
  keyPointsContainer: document.getElementById('keyPointsContainer'),
  copyKeyPoints: document.getElementById('copyKeyPoints'),
  uploadToNotion: document.getElementById('uploadToNotion')
};

// ==========================================
// 3. Initialization
// ==========================================
function init() {
  setupEventListeners();
  checkThirdPartyLibs();
  console.log('🚀 AutoScan initialized');
}

/**
 * Check if required 3rd party libraries are loaded
 */
function checkThirdPartyLibs() {
  if (!window.JSZip) {
    console.warn('⚠️ JSZip not loaded. Word document support may be limited.');
  }
  if (!window.pdfjsLib) {
    console.warn('⚠️ PDF.js not loaded. PDF support may be limited.');
  } else {
    // Set worker path for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
}

// ==========================================
// 4. Event Listeners
// ==========================================
function setupEventListeners() {
  // Tab switching
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const tabId = this.getAttribute('data-tab');

      // Update buttons
      elements.tabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Update panels
      if (tabId === 'upload') {
        elements.uploadTab.classList.add('active');
        elements.pasteTab.classList.remove('active');
      } else {
        elements.uploadTab.classList.remove('active');
        elements.pasteTab.classList.add('active');
      }
    });
  });

  // Upload zone events
  if (elements.uploadZone) {
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.uploadZone.classList.add('drag-over');
    });
    elements.uploadZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      elements.uploadZone.classList.remove('drag-over');
    });
    elements.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.uploadZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) handleFile(files[0]);
    });
  }

  // File input
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length > 0) handleFile(files[0]);
    });
  }

  // Unified analyze button
  if (elements.analyzeBtn) {
    elements.analyzeBtn.addEventListener('click', startAnalysis);
  }

  // Copy button
  if (elements.copyKeyPoints) {
    elements.copyKeyPoints.addEventListener('click', () => {
      if (typeof window.copyKeyPointsToClipboard === 'function') {
        window.copyKeyPointsToClipboard();
      } else {
        copyToClipboard();
      }
    });
  }

  // Notion button
  if (elements.uploadToNotion) {
    elements.uploadToNotion.addEventListener('click', handleUploadToNotion);
  }
}

// ==========================================
// 5. Analysis Logic
// ==========================================

/**
 * Main entry point for starting the analysis
 */
async function startAnalysis() {
  // Determine source
  const isUploadMode = elements.uploadTab.classList.contains('active');
  let textToAnalyze = '';

  if (isUploadMode) {
    if (!transcript) {
      showStatus('請先上傳並解析文件檔案', 'error');
      return;
    }
    textToAnalyze = transcript;
  } else {
    textToAnalyze = elements.manualTranscript.value.trim();
    if (!textToAnalyze) {
      showStatus('請輸入文字內容', 'error');
      return;
    }
    if (textToAnalyze.length < 50) {
      showStatus('輸入內容過短 (需至少 50 字)', 'error');
      return;
    }
    transcript = textToAnalyze; // Sync with state
  }

  // Check configuration
  if (!window.configManager || !window.configManager.loaded) {
    showStatus('請稍候，正在載入金鑰配置...', 'info');
    try {
      await window.configManager.loadConfig();
    } catch (e) {
      showStatus('金鑰配置載入失敗，請確認 config.json 是否存在', 'error');
      return;
    }
  }

  // Start AI analysis
  try {
    showStatus('🚀 正在啟動 AI 進行分析...', 'info');

    if (typeof window.callAIModel !== 'function') {
      throw new Error('找不到 AI 模組 (ai-api.js)');
    }

    // Get selected language
    const langCode = elements.languageSelect.value;
    const targetLanguage = typeof window.getLanguageName === 'function'
      ? window.getLanguageName(langCode)
      : 'Traditional Chinese (Taiwan)';

    console.log(`[App] Analyzing in language: ${targetLanguage} (${langCode})`);

    const keyPoints = await window.callAIModel(textToAnalyze, targetLanguage);

    if (keyPoints && keyPoints.length > 0) {
      currentKeyPoints = keyPoints;
      // Use display function from ai-api.js or implement here
      if (typeof window.displayKeyPoints === 'function') {
        window.displayKeyPoints(keyPoints);
      } else {
        renderKeyPoints(keyPoints);
      }
      showStatus('✅ 分析完成！', 'success');

      // Show Notion button if configured
      if (configManager.isConfigured('notion')) {
        elements.uploadToNotion.style.display = 'inline-flex';
      }
    } else {
      showStatus('未能提取重點，請嘗試更換模型或增加文字量', 'error');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    showStatus(`❌ 出錯了: ${error.message}`, 'error');
  }
}

// ==========================================
// 6. File Handling
// ==========================================

function handleFile(file) {
  // Update file info UI
  elements.fileInfo.style.display = 'flex';
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);

  // Clear previous transcript
  transcript = '';
  elements.keyPointsContainer.innerHTML = '<div class="empty-state">檔案已載入，請點擊「分析文字」進行分析</div>';
  elements.copyKeyPoints.style.display = 'none';
  elements.uploadToNotion.style.display = 'none';

  // Process based on type
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    handleTextFile(file);
  } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
    handleWordFile(file);
  } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    handlePdfFile(file);
  } else {
    showStatus('不支援的檔案格式，請提供 TXT, Word 或 PDF', 'error');
  }
}

function handleTextFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    transcript = e.target.result.trim();
    showStatus('TXT 檔案讀取成功', 'success');
  };
  reader.onerror = () => showStatus('讀取 TXT 檔案失敗', 'error');
  reader.readAsText(file);
}

async function handleWordFile(file) {
  showStatus('正在讀取 Word 檔案...', 'info');
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (file.name.endsWith('.docx')) {
      transcript = await extractTextFromDocx(arrayBuffer);
      showStatus('Word (.docx) 檔案讀取成功', 'success');
    } else {
      showStatus('暫不支援舊版 .doc 格式，請轉換為 .docx', 'error');
    }
  } catch (error) {
    console.error('Word error:', error);
    showStatus('Word 檔案解析失敗', 'error');
  }
}

async function extractTextFromDocx(arrayBuffer) {
  if (!window.JSZip) throw new Error('JSZip library missing');
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml, 'text/xml');
  const textNodes = xmlDoc.getElementsByTagName('w:t');
  let text = '';
  for (let node of textNodes) text += node.textContent + ' ';
  return text.trim();
}

async function handlePdfFile(file) {
  showStatus('正在讀取 PDF 檔案...', 'info');
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (!window.pdfjsLib) throw new Error('PDF.js library missing');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    transcript = fullText.trim();
    showStatus('PDF 檔案讀取成功', 'success');
  } catch (error) {
    console.error('PDF error:', error);
    showStatus('PDF 檔案解析失敗', 'error');
  }
}

// ==========================================
// 7. Notion Integration
// ==========================================

async function handleUploadToNotion() {
  const notionConfig = configManager.getNotionConfig();
  if (!notionConfig.token || !notionConfig.databaseId) {
    showStatus('Notion 配置不足，請檢查 config.json', 'error');
    return;
  }

  // Update data from UI before uploading
  collectKeyPointsFromUI();

  if (!currentKeyPoints || currentKeyPoints.length === 0) {
    showStatus('沒有可上傳的重點', 'error');
    return;
  }

  showStatus('正在上傳至 Notion...', 'loading');
  try {
    const result = await uploadToNotionAPI(currentKeyPoints, notionConfig);

    if (result.errors && result.errors.length > 0) {
      showStatus(`⚠️ 部分成功：已上傳 ${result.count} 條記錄（共 ${currentKeyPoints.length} 條）`, 'success');
      console.warn('Some points failed to upload:', result.errors);
    } else {
      showStatus(`✅ 成功上傳 ${result.count} 條記錄至 Notion！`, 'success');
    }
  } catch (error) {
    console.error('Notion error:', error);
    showStatus(`Notion 上傳失敗: ${error.message}`, 'error');
  }
}

/**
 * Upload structured data to Notion - supports both simple array and structured JSON format
 */
async function uploadToNotionAPI(points, config) {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  try {
    // Determine if we have structured data or simple strings
    const isStructured = points.length > 0 && typeof points[0] === 'object' && points[0].properties;

    console.log(`[Notion Upload] Data type: ${isStructured ? 'Structured JSON' : 'Simple Array'}`);

    if (isStructured) {
      // Handle structured JSON data
      return await uploadStructuredDataToNotion(points, config, isLocalhost);
    } else {
      // Handle simple string array (legacy behavior)
      return await uploadSimpleDataToNotion(points, config, isLocalhost);
    }
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('CORS 錯誤：瀏覽器不允許直接連接 Notion API。建議使用本地伺服器或代理。');
    }
    throw error;
  }
}

/**
 * Upload structured JSON data with multiple fields to Notion
 */
async function uploadStructuredDataToNotion(items, config, isLocalhost) {
  const results = [];
  const errors = [];
  const apiUrl = isLocalhost ? '/api/notion/structured' : 'https://api.notion.com/v1/pages';

  // Auto-detect title property name
  let titlePropName = config.titlePropertyName;
  if (!titlePropName || isLocalhost) {
    console.log('🔍 Auto-detecting Notion title property for structured data...');
    const dbUrl = isLocalhost ? `/api/notion/database/${config.databaseId}` : `https://api.notion.com/v1/databases/${config.databaseId}`;
    const dbRes = await fetch(dbUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (dbRes.ok) {
      const dbInfo = await dbRes.json();
      const titleProp = Object.entries(dbInfo.properties).find(([name, attr]) => attr.type === 'title');
      if (titleProp) {
        titlePropName = titleProp[0];
        console.log(`✅ Detected title property: "${titlePropName}"`);
      }
    }
  }

  if (!titlePropName) titlePropName = 'Name'; // Fallback

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const props = item.properties;

    try {
      // Build Notion properties object
      const notionProperties = {};

      // Title field - use detected property name
      if (props.ToDo) {
        notionProperties[titlePropName] = {
          title: [{ text: { content: props.ToDo } }]
        };
      }

      // Multi-select fields (only add if not empty)
      if (props.歸屬分類 && Array.isArray(props.歸屬分類) && props.歸屬分類.length > 0) {
        notionProperties['歸屬分類'] = {
          multi_select: props.歸屬分類.map(name => ({ name }))
        };
      }

      if (props.專案 && Array.isArray(props.專案) && props.專案.length > 0) {
        notionProperties['專案'] = {
          multi_select: props.專案.map(name => ({ name }))
        };
      }

      // Status field
      if (props.狀態) {
        notionProperties['狀態'] = {
          status: { name: props.狀態 }
        };
      }

      // People field (not rich_text!) - Note: This requires the person to exist in your Notion workspace
      // For now, we'll skip this field as it requires user IDs, not names
      // If you want to use it, you need to map names to Notion user IDs
      /*
      if (props.負責人) {
        notionProperties['負責人'] = {
          people: [{ name: props.負責人 }]  // This won't work - needs user IDs
        };
      }
      */

      // Date fields
      if (props.到期日) {
        notionProperties['到期日'] = {
          date: { start: props.到期日 }
        };
      }

      if (props.建立時間) {
        // Convert to ISO 8601 format
        const isoDate = props.建立時間.replace(' ', 'T');
        notionProperties['建立時間'] = {
          date: { start: isoDate }
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          // For proxy
          token: config.token,
          databaseId: config.databaseId,
          properties: notionProperties,
          // Standard Notion format
          parent: { database_id: config.databaseId },
          properties: notionProperties
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        errors.push(`Item ${i + 1}: ${errorData.message || `HTTP ${response.status}`}`);
        console.error(`❌ Failed to upload item ${i + 1}:`, errorData);
      } else {
        const data = await response.json();
        results.push(data);
        console.log(`✅ Uploaded structured item ${i + 1}/${items.length}`);
      }
    } catch (error) {
      errors.push(`Item ${i + 1}: ${error.message}`);
      console.error(`❌ Failed to upload item ${i + 1}:`, error);
    }
  }

  // Report results
  if (results.length === items.length) {
    console.log(`✅ Successfully uploaded all ${results.length} structured items to Notion`);
    return { success: true, count: results.length, results };
  } else if (results.length > 0) {
    console.warn(`⚠️ Partial success: ${results.length}/${items.length} items uploaded`);
    return { success: true, count: results.length, results, errors };
  } else {
    throw new Error(`Failed to upload any items. Errors: ${errors.join('; ')}`);
  }
}

/**
 * Upload simple string array to Notion (legacy)
 */
async function uploadSimpleDataToNotion(points, config, isLocalhost) {
  let propName = config.titlePropertyName;

  // Auto-detect property name if not set
  if (!propName || isLocalhost) {
    console.log('🔍 Auto-detecting Notion title property...');
    const dbUrl = isLocalhost ? `/api/notion/database/${config.databaseId}` : `https://api.notion.com/v1/databases/${config.databaseId}`;
    const dbRes = await fetch(dbUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (dbRes.ok) {
      const dbInfo = await dbRes.json();
      const titleProp = Object.entries(dbInfo.properties).find(([name, attr]) => attr.type === 'title');
      if (titleProp) {
        propName = titleProp[0];
        console.log(`✅ Detected title property: "${propName}"`);
      }
    }
  }

  if (!propName) propName = 'Name'; // Fallback

  const apiUrl = isLocalhost ? '/api/notion' : 'https://api.notion.com/v1/pages';

  // Create one Notion page for each key point
  const results = [];
  const errors = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const title = point; // Use the key point itself as the title

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          token: config.token,         // For our proxy
          databaseId: config.databaseId, // For our proxy
          title: title,               // For our proxy
          children: [],               // No children needed, title is enough
          propertyName: propName,      // For our proxy
          // Standard Notion format below
          parent: { database_id: config.databaseId },
          properties: {
            [propName]: {
              title: [
                { text: { content: title } }
              ]
            }
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        errors.push(`Point ${i + 1}: ${errorData.message || `HTTP ${response.status}`}`);
        console.error(`❌ Failed to upload point ${i + 1}:`, errorData);
      } else {
        const data = await response.json();
        results.push(data);
        console.log(`✅ Uploaded point ${i + 1}/${points.length}`);
      }
    } catch (error) {
      errors.push(`Point ${i + 1}: ${error.message}`);
      console.error(`❌ Failed to upload point ${i + 1}:`, error);
    }
  }

  // Report results
  if (results.length === points.length) {
    console.log(`✅ Successfully uploaded all ${results.length} key points to Notion`);
    return { success: true, count: results.length, results };
  } else if (results.length > 0) {
    console.warn(`⚠️ Partial success: ${results.length}/${points.length} points uploaded`);
    return { success: true, count: results.length, results, errors };
  } else {
    throw new Error(`Failed to upload any points. Errors: ${errors.join('; ')}`);
  }
}

// ==========================================
// 8. Utility Functions
// ==========================================

function showStatus(message, type = 'info') {
  if (!elements.statusMessage) return;

  // Clear any pending timeout to prevent hiding the new status prematurely
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  elements.statusMessage.textContent = message;
  // Use simple class name to match CSS (.status-message.success etc.)
  elements.statusMessage.className = `status-message ${type}`;

  // Ensure display is block/flex (CSS loading uses flex)
  elements.statusMessage.style.display = type === 'loading' ? 'flex' : 'block';

  // Only auto-hide for success/error events, keep info/loading persistent
  if (type === 'success' || type === 'error') {
    statusTimeout = setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 5000);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Collect edited key points from DOM
 */
function collectKeyPointsFromUI() {
  const container = document.getElementById('keyPointsContainer');
  if (!container) return currentKeyPoints;

  const items = container.querySelectorAll('.key-point-item');
  const points = [];

  items.forEach(item => {
    if (item.classList.contains('structured')) {
      // Structured data
      const props = {};

      // Text inputs
      item.querySelectorAll('input.edit-field').forEach(input => {
        const field = input.dataset.field;
        const value = input.value.trim();

        if (field === '歸屬分類' || field === '專案') {
          // Split by comma
          props[field] = value ? value.split(/[,，]/).map(s => s.trim()).filter(s => s) : [];
        } else {
          props[field] = value;
        }
      });

      // Select
      const statusSelect = item.querySelector('select.edit-field');
      if (statusSelect) {
        props['狀態'] = statusSelect.value;
      }

      points.push({ properties: props });

    } else {
      // Simple list
      const textarea = item.querySelector('.simple-item');
      if (textarea) {
        const value = textarea.value.trim();
        if (value) points.push(value);
      }
    }
  });

  // Update global state
  if (points.length > 0) {
    currentKeyPoints = points;
    console.log('🔄 Updated key points from UI:', points);
  }

  return points;
}

function copyToClipboard() {
  // Sync with UI first
  collectKeyPointsFromUI();

  if (!currentKeyPoints.length) return;

  // Format based on type
  let text = '';
  const isStructured = currentKeyPoints.length > 0 && typeof currentKeyPoints[0] === 'object';

  if (isStructured) {
    text = currentKeyPoints.map((p, i) => {
      const props = p.properties;
      return `${i + 1}. ${props.ToDo || '無標題'} [${props.狀態}]`;
    }).join('\n');
  } else {
    text = currentKeyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');
  }

  navigator.clipboard.writeText(text).then(() => {
    showStatus('已複製到剪貼簿 (含修改)', 'success');
  });
}

// ==========================================
// 9. Start Application
// ==========================================
window.addEventListener('DOMContentLoaded', init);
