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
window.currentKeyPoints = [];
let statusTimeout = null;
let analysisInterval = null;
let analysisStartTime = null;

// Multi-language Status Dictionary
const STATUS_I18N = {
  'zh-TW': {
    'starting': '🚀 正在啟動 AI 進行分析...',
    'phase1': '📋 階段 1/4: 清洗文本...',
    'phase2': '📋 階段 2/4: 組織識別...',
    'phase3': '📋 階段 3/4: Notion 結構映射...',
    'phase4': '📋 階段 4/4: 品質核檢...',
    'success': '✅ 分析完成！',
    'error': '❌ 分析失敗',
    'loading': '分析中...',
    'executing': '已執行'
  },
  'en': {
    'starting': '🚀 Starting AI analysis...',
    'phase1': '📋 Phase 1/4: Sanitizing text...',
    'phase2': '📋 Phase 2/4: Org Specialist...',
    'phase3': '📋 Phase 3/4: Notion mapping...',
    'phase4': '📋 Phase 4/4: QA Inspector...',
    'success': '✅ Analysis complete!',
    'error': '❌ Analysis failed',
    'loading': 'Analyzing...',
    'executing': 'Executing'
  },
  'ja': {
    'starting': '🚀 AI分析を開始しています...',
    'phase1': '📋 フェーズ 1/4: テキストのクレンジング...',
    'phase2': '📋 フェーズ 2/4: 組織の識別...',
    'phase3': '📋 フェーズ 3/4: Notion構造マッピング...',
    'phase4': '📋 フェーズ 4/4: 品質チェック...',
    'success': '✅ 分析が完了しました！',
    'error': '❌ 分析に失敗しました',
    'loading': '分析中...',
    'executing': '実行中'
  }
};

// LLM UI Component instance
let llmUI = null;

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
  languageSelect: document.getElementById('languageSelect'),
  statusMessage: document.getElementById('statusMessage'),

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
  initLLMComponent();
  console.log('🚀 AutoScan initialized');
}

/**
 * Initialize LLM UI Component
 */
function initLLMComponent() {
  // Wait for config to load
  if (!window.LLMUIComponent) {
    console.warn('⚠️ LLM UI Component not loaded yet, retrying...');
    setTimeout(initLLMComponent, 500);
    return;
  }

  llmUI = new LLMUIComponent({
    containerId: 'llm-component-container',
    configManager: window.configManager,
    llmCore: window.llmCore,
    onAnalyze: startAnalysis,
    onUpdateSchema: handleUpdateSchema
  });

  llmUI.render();
  console.log('✅ LLM UI Component initialized');
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

  // Result Tabs (Key Points / Charts)
  document.querySelectorAll('.result-tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const tab = this.dataset.resultTab;
      document.querySelectorAll('.result-tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.result-panel').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(`${tab}Panel`);
      if (target) target.classList.add('active');
    });
  });
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

  // Get model selection from LLM UI Component
  const selection = llmUI.getSelection();
  console.log('[App] Model selection:', selection);

  // Get selected language
  const langCode = elements.languageSelect.value;
  const targetLanguage = typeof window.getLanguageName === 'function'
    ? window.getLanguageName(langCode)
    : 'Traditional Chinese';

  // Start AI analysis
  try {
    const lang = elements.languageSelect.value;
    const i18n = STATUS_I18N[lang] || STATUS_I18N['zh-TW'];

    showStatus(i18n.starting, 'loading', true);
    llmUI.updateButtonState('loading', i18n.loading);

    // ==========================================
    // 使用 Agent Skills 4 階段處理流程
    // ==========================================

    // Check if Skills Processor is available
    if (!window.SkillsProcessor) {
      throw new Error('Skills Processor not loaded. Please refresh the page.');
    }

    // Check if using Agent mode
    if (selection.useAgent) {
      // For Agent mode, keep the original system instruction approach
      const systemInstruction = typeof window.getSystemInstruction === 'function'
        ? await window.getSystemInstruction(targetLanguage)
        : null;

      console.log('[App] Using Vertex AI Agent with system instruction');

      const result = await window.llmCore.call(textToAnalyze, {
        provider: selection.provider,
        model: selection.model,
        targetLanguage: targetLanguage,
        systemInstruction: systemInstruction,
        useAgent: true
      });

      // Parse result normally
      keyPoints = window.parseStructuredOutput ? window.parseStructuredOutput(result.text) : [];

    } else {
      // For standard models, use Skills Processor
      console.log('[App] Using Skills Processor 4-phase pipeline');
      showStatus(i18n.phase1, 'loading', true);

      // Initialize Skills Processor (no need for SkillsLoader in browser)
      // Create a mock loader with built-in prompts
      const mockLoader = {
        buildPhase1Prompt: (text) => window.SkillsProcessor.prototype.buildPhase1Prompt(text),
        buildPhase2Prompt: (text, dept) => window.SkillsProcessor.prototype.buildPhase2Prompt(text, dept),
        buildPhase3Prompt: (text, org, opt) => window.SkillsProcessor.prototype.buildPhase3Prompt(text, org, opt),
        buildPhase4Prompt: (json) => window.SkillsProcessor.prototype.buildPhase4Prompt(json)
      };

      const processor = new SkillsProcessor(mockLoader, window.llmCore);

      // Get user-selected department info from UI
      const selectedDept = window.departmentSelector ?
        window.departmentSelector.getSelectedDepartmentInfo() :
        null;

      console.log('[App] User selected department:', selectedDept);

      const sourceOptions = localStorage.getItem('notion_source_options') ||
        '商業模式, 外部合作, 法律法規, 會議記錄, 董事會顧問會議, 董事長交辦, KWAY研發中心';

      const skillsOptions = {
        provider: selection.provider,
        model: selection.model,
        targetLanguage: targetLanguage,
        selectedDepartment: selectedDept,
        sourceOptions: sourceOptions
      };

      // Decompose 4-phase process to allow step-by-step status updates
      showStatus(i18n.phase1, 'loading', true);
      const cleanedText = await processor.runPhase1(textToAnalyze, skillsOptions);

      showStatus(i18n.phase2, 'loading', true);
      const orgData = await processor.runPhase2(cleanedText, skillsOptions);

      showStatus(i18n.phase3, 'loading', true);
      const jsonArray = await processor.runPhase3(cleanedText, orgData, skillsOptions);

      showStatus(i18n.phase4, 'loading', true);
      const validatedData = await processor.runPhase4(jsonArray, skillsOptions);

      // Use the validated data
      keyPoints = validatedData;
      console.log('[App] Skills Processor pipeline completed:', keyPoints.length, 'items');
    }

    // Final validation
    if (!keyPoints || keyPoints.length === 0) {
      throw new Error('分析結果為空，請檢查輸入內容或重試');
    }

    console.log('[App] Final keyPoints to display:', keyPoints);
    window.currentKeyPoints = keyPoints;

    // Update UI
    if (typeof window.displayKeyPoints === 'function') {
      window.displayKeyPoints(keyPoints);
    }

    // Initialize Charts if data is available
    if (typeof window.initCharts === 'function') {
      try {
        window.initCharts(keyPoints, textToAnalyze);
      } catch (chartError) {
        console.error('[App] Chart initialization error:', chartError);
        // Don't fail the whole analysis if charts fail
      }
    }

    showStatus('✅ 分析完成！', 'success');
    llmUI.updateButtonState('success', '分析完成');

    // Show buttons
    if (elements.copyKeyPoints) {
      elements.copyKeyPoints.style.display = 'inline-flex';
    }
    if (configManager.isConfigured('notion')) {
      elements.uploadToNotion.style.display = 'inline-flex';
    }
    // Display success
    showStatus(`${i18n.success} (${keyPoints.length})`, 'success');
    llmUI.updateButtonState('normal');

  } catch (error) {
    console.error('Analysis error:', error);
    const lang = elements.languageSelect.value;
    const i18n = STATUS_I18N[lang] || STATUS_I18N['zh-TW'];
    showStatus(`${i18n.error}: ${error.message}`, 'error');
    llmUI.updateButtonState('normal');
  }
}


// ==========================================
// ⚠️ STABLE CODE - DO NOT MODIFY
// 6. File Handling (檔案處理功能)
// 此區域已完成測試並穩定運行，包含：
// - TXT, PDF, Word 檔案讀取
// - 檔案大小限制 (5MB)
// ==========================================


function handleFile(file) {
  // Update file info UI
  elements.fileInfo.style.display = 'flex';
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);

  // Clear previous transcript
  transcript = '';
  if (elements.keyPointsContainer) {
    elements.keyPointsContainer.innerHTML = '<div class="empty-state">檔案已載入，請點擊「分析文字」進行分析</div>';
  }
  if (elements.copyKeyPoints) elements.copyKeyPoints.style.display = 'none';
  if (elements.uploadToNotion) elements.uploadToNotion.style.display = 'none';

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
 * Handle Update Schema button click
 * Extract Notion Database schema and save to file
 */
async function handleUpdateSchema() {
  console.log('[App] Update Schema requested');

  showStatus('📥 正在儲存到檔案...', 'loading');

  try {
    // Get Notion config
    const config = window.configManager.getNotionConfig();

    if (!config.token || !config.databaseId) {
      showStatus('❌ Notion 配置不足，請檢查 config.json', 'error');
      return;
    }

    // Call proxy API to get database schema
    const apiUrl = `/api/notion/database/${config.databaseId}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      showStatus(`❌ Notion API 錯誤: ${error.message || response.statusText}`, 'error');
      return;
    }

    const database = await response.json();

    // Extract schema
    const properties = database.properties;
    const schemaResults = {};

    for (const [propName, propConfig] of Object.entries(properties)) {
      const propType = propConfig.type;

      schemaResults[propName] = {
        type: propType,
        options: null
      };

      switch (propType) {
        case 'select':
          schemaResults[propName].options = propConfig.select.options.map(opt => opt.name);
          break;

        case 'multi_select':
          schemaResults[propName].options = propConfig.multi_select.options.map(opt => opt.name);
          break;

        case 'status':
          schemaResults[propName].options = propConfig.status.options.map(opt => opt.name);
          schemaResults[propName].groups = propConfig.status.groups.map(g => ({
            name: g.name,
            color: g.color,
            option_ids: g.option_ids
          }));
          break;

        case 'title':
          schemaResults[propName].isTitle = true;
          break;
      }
    }

    // Cache specific options for logic
    if (schemaResults['來源'] && schemaResults['來源'].options) {
      localStorage.setItem('notion_source_options', schemaResults['來源'].options.join(', '));
      console.log('[App] Cached Source options:', schemaResults['來源'].options);
    }

    // Save to file via server endpoint
    const saveResponse = await fetch('/api/save-notion-schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        databaseId: config.databaseId,
        schemaData: schemaResults
      })
    });

    if (!saveResponse.ok) {
      const error = await saveResponse.json();
      showStatus(`❌ 儲存檔案失敗: ${error.message}`, 'error');
      return;
    }

    const saveResult = await saveResponse.json();

    // Success message with structured format
    showStatus(
      `✅ 儲存成功！\n` +
      `檔案名稱：${saveResult.filename}\n` +
      `檔案路徑：${saveResult.path}\n` +
      `檔案大小：${saveResult.size} bytes`,
      'success'
    );

    console.log('[App] Schema saved:', saveResult);

  } catch (error) {
    console.error('[App] Update Schema error:', error);
    showStatus(
      `❌ 儲存失敗！\n` +
      `錯誤訊息：${error.message}`,
      'error'
    );
  }
}

/**
 * Build name mapping from Personal List CSV
 * Creates a lookup table to standardize names to Chinese
 * @returns {Promise<Map<string, string>>} Map of (name|email) => Chinese name
 */
async function buildNameMappingFromCSV() {
  const nameMap = new Map();

  try {
    const csvPath = 'Personal List of Kway.csv';
    const response = await fetch(csvPath);
    if (!response.ok) {
      console.warn('[Name Mapping] CSV file not found');
      return nameMap;
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');

    // Parse CSV (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV format: 序號,員工編號,姓名,分機,部門代號,部門名稱,職稱,信箱
      const parts = line.split(',');
      if (parts.length < 8) continue;

      const chineseName = parts[2]?.trim(); // 姓名
      const email = parts[7]?.trim(); // 信箱

      if (!chineseName) continue;

      // Map Chinese name to itself
      nameMap.set(chineseName, chineseName);

      // Extract English name from email (e.g., "james@mail.kway.com.tw" -> "james")
      if (email) {
        const emailUsername = email.split('@')[0]?.toLowerCase();
        if (emailUsername) {
          nameMap.set(emailUsername, chineseName);
          // Also map capitalized version
          nameMap.set(emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1), chineseName);
          nameMap.set(emailUsername.toUpperCase(), chineseName);
        }
      }
    }

    console.log(`[Name Mapping] Built mapping for ${nameMap.size} name variations`);
    return nameMap;

  } catch (error) {
    console.error('[Name Mapping] Error reading CSV:', error);
    return nameMap;
  }
}

/**
 * Lookup departments from Personal List CSV based on owner names
 * @param {string[]} ownerNames - Array of owner names to look up
 * @returns {Promise<string[]>} Array of unique department names
 */
async function lookupDepartmentsFromCSV(ownerNames) {
  if (!ownerNames || ownerNames.length === 0) return [];

  try {
    // Load CSV file
    const csvPath = 'Personal List of Kway.csv';
    const response = await fetch(csvPath);
    if (!response.ok) {
      console.warn('[CSV Lookup] CSV file not found, skipping department lookup');
      return [];
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');
    const departments = new Set();

    // Build a lookup structure for both exact and fuzzy matching
    const csvData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV format: 序號,員工編號,姓名,分機,部門代號,部門名稱,職稱,信箱
      const parts = line.split(',');
      if (parts.length < 6) continue;

      const name = parts[2]?.trim(); // 姓名
      const deptName = parts[5]?.trim().replace(/^"(.*)"$/, '$1'); // 部門名稱
      const email = parts[7]?.trim(); // 信箱

      if (name && deptName) {
        csvData.push({ name, deptName, email });
      }
    }

    // Process each owner name
    for (const ownerName of ownerNames) {
      if (!ownerName || ownerName === '待指派') continue;

      const ownerLower = ownerName.toLowerCase().trim();
      let matched = false;

      // Strategy 1: Exact name match (Chinese name)
      for (const row of csvData) {
        if (row.name === ownerName) {
          departments.add(row.deptName);
          matched = true;
          console.log(`[CSV Lookup] ✅ Exact match: "${ownerName}" → "${row.deptName}"`);
          break;
        }
      }

      // Strategy 2: Email prefix match (English name / email username)
      if (!matched) {
        for (const row of csvData) {
          if (!row.email) continue;

          const emailPrefix = row.email.split('@')[0]?.toLowerCase();
          if (emailPrefix && emailPrefix === ownerLower) {
            departments.add(row.deptName);
            matched = true;
            console.log(`[CSV Lookup] ✅ Email match: "${ownerName}" → "${emailPrefix}@..." → "${row.deptName}"`);
            break;
          }
        }
      }

      // Strategy 3: Partial email match (case-insensitive contains)
      if (!matched) {
        for (const row of csvData) {
          if (!row.email) continue;

          const emailPrefix = row.email.split('@')[0]?.toLowerCase();
          if (emailPrefix && emailPrefix.includes(ownerLower)) {
            departments.add(row.deptName);
            matched = true;
            console.log(`[CSV Lookup] ⚠️ Fuzzy match: "${ownerName}" contained in "${emailPrefix}@..." → "${row.deptName}"`);
            break;
          }
        }
      }

      if (!matched) {
        console.warn(`[CSV Lookup] ❌ No match found for: "${ownerName}"`);
      }
    }

    const result = Array.from(departments);
    console.log(`[CSV Lookup] Found departments for [${ownerNames.join(', ')}]:`, result);
    return result;

  } catch (error) {
    console.error('[CSV Lookup] Error reading CSV:', error);
    return [];
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

      // 來源 field - Notion expects multi_select type
      if (props.來源) {
        if (typeof props.來源 === 'string') {
          // Convert string to array for multi_select
          notionProperties['來源'] = {
            multi_select: [{ name: props.來源 }]
          };
        } else if (Array.isArray(props.來源) && props.來源.length > 0) {
          notionProperties['來源'] = {
            multi_select: props.來源.map(name => ({ name }))
          };
        }
      } else if (props.歸屬分類) {
        // Backward compatibility
        const sources = typeof props.歸屬分類 === 'string' ? [props.歸屬分類] : props.歸屬分類;
        if (sources && sources.length > 0) {
          notionProperties['來源'] = {
            multi_select: sources.map(name => ({ name }))
          };
        }
      }

      if (props.專案 && Array.isArray(props.專案) && props.專案.length > 0) {
        notionProperties['專案'] = {
          multi_select: props.專案.map(name => ({ name }))
        };
      }

      // 關鍵詞 field - check multiple possible property names
      console.log(`[Debug Item ${i + 1}] Checking keywords field...`);
      console.log(`[Debug Item ${i + 1}] props.關鍵詞:`, props.關鍵詞);
      console.log(`[Debug Item ${i + 1}] props.關鍵字:`, props.關鍵字);
      console.log(`[Debug Item ${i + 1}] All props keys:`, Object.keys(props));

      const keywords = props.關鍵詞 || props.關鍵字 || props.關鍵字標籤 || props['關鍵詞'];
      console.log(`[Debug Item ${i + 1}] Final keywords value:`, keywords);

      if (keywords && Array.isArray(keywords) && keywords.length > 0) {
        notionProperties['關鍵詞'] = {
          multi_select: keywords.map(name => ({ name }))
        };
        console.log(`[Debug Item ${i + 1}] ✅ Added keywords to Notion properties:`, keywords);
      } else {
        console.warn(`[Debug Item ${i + 1}] ❌ Keywords not added - keywords:`, keywords, 'isArray:', Array.isArray(keywords));
      }

      if (props.責任部門 && Array.isArray(props.責任部門) && props.責任部門.length > 0) {
        notionProperties['責任部門'] = {
          multi_select: props.責任部門.map(name => ({ name }))
        };
      } else if (props.責任部門 && typeof props.責任部門 === 'string') {
        notionProperties['責任部門'] = {
          multi_select: [{ name: props.責任部門 }]
        };
      }

      // Status field
      if (props.狀態) {
        notionProperties['狀態'] = {
          status: { name: props.狀態 }
        };
      }

      // 負責人 field - use multi_select as workaround for People type
      // Notion's People type requires user IDs, which we don't have
      // So we store names as multi_select instead
      const owners = props.負責人 || props.負責人員;
      if (owners) {
        if (typeof owners === 'string') {
          notionProperties['負責人'] = {
            multi_select: [{ name: owners }]
          };
        } else if (Array.isArray(owners) && owners.length > 0) {
          notionProperties['負責人'] = {
            multi_select: owners.map(name => ({ name }))
          };
        }
      }

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

      // Debug: Log final properties before upload
      console.log(`[Debug Item ${i + 1}] Final Notion Properties:`, JSON.stringify(notionProperties, null, 2));

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

function showStatus(message, type = 'info', hasTimer = false) {
  if (!elements.statusMessage) return;

  // Clear any pending timeout
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  // Clear existing interval if starting a new status or stopping
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }

  const lang = elements.languageSelect ? elements.languageSelect.value : 'zh-TW';
  const i18n = STATUS_I18N[lang] || STATUS_I18N['zh-TW'];

  const updateDisplay = () => {
    let displayMessage = message.replace(/\n/g, '<br>');
    if (hasTimer && analysisStartTime) {
      const seconds = Math.floor((Date.now() - analysisStartTime) / 1000);
      displayMessage += ` <span style="opacity: 0.8; font-size: 0.9em;">(${i18n.executing}: ${seconds}s)</span>`;
    }
    elements.statusMessage.innerHTML = displayMessage;
  };

  if (hasTimer) {
    if (!analysisStartTime || type === 'loading') {
      analysisStartTime = Date.now();
    }
    updateDisplay();
    analysisInterval = setInterval(updateDisplay, 1000);
  } else {
    analysisStartTime = null;
    elements.statusMessage.innerHTML = message.replace(/\n/g, '<br>');
  }

  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.style.display = type === 'loading' || hasTimer ? 'flex' : 'block';

  if (type !== 'loading' && !hasTimer) {
    statusTimeout = setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 30000);
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

        // Fields that should be arrays (split by comma)
        const arrayFields = ['歸屬分類', '專案', '關鍵詞', '負責人', '責任部門', '來源'];

        if (arrayFields.includes(field)) {
          // Split by comma and filter empty strings
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
