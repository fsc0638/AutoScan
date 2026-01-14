// ==========================================
// AI Model API Integration
// ==========================================

/**
 * Call AI model to analyze text and extract key points
 * @param {string} text - Text to analyze
 * @param {string} targetLanguage - Target output language
 * @returns {Promise<Array>} Array of key points
 */
async function callAIModel(text, targetLanguage = 'Traditional Chinese') {
    const model = getSelectedModel();
    const providerConfig = await getModelConfig(model.provider);

    // Determine the API Key: Priority: Agent's specific key > Provider's global key
    let apiKey = providerConfig?.apiKey;

    // Standard API Key Logic
    if (!apiKey) {
        throw new Error(`未設定 ${model.provider} API 金鑰`);
    }

    console.log(`Using ${model.agentLabel} (${model.agent}) for analysis...`);
    console.log(`Agent Mode Enabled: ${model.useAgent}`);

    // ==========================================
    // AGENT MODE LOGIC (Toggle ON)
    // ==========================================
    if (model.useAgent) {
        // 呼叫獨立的 Vertex AI Agent 模組
        // 此模組與現有邏輯完全隔離
        if (typeof window.callVertexAgent === 'function') {
            console.log('[AI API] Routing to Vertex AI Agent...');
            return await window.callVertexAgent(text);
        } else {
            throw new Error("Vertex AI Agent 模組未載入，請確認 vertex-agent-api.js 已正確引入");
        }
    }

    // ==========================================
    // STANDARD MODE LOGIC (Toggle OFF)
    // ==========================================
    const defaultVersions = {
        gemini: 'gemini-2.0-flash-exp', // Default to 2.0 Flash as it was stable in main
        openai: 'gpt-4o'
    };

    const modelVersion = defaultVersions[model.provider];

    try {
        if (model.provider === 'gemini') {
            const targetModel = model.agent !== 'default' ? model.agent : modelVersion;
            // STRICTLY use Standard Mode (no agentLabel passing for logic detection)
            return await callGeminiAPI(text, targetModel, apiKey, targetLanguage);
        } else if (model.provider === 'openai') {
            return await callOpenAIAPI(text, modelVersion, apiKey, targetLanguage);
        } else {
            throw new Error('不支援的語言模型');
        }
    } catch (error) {
        console.error('AI Model API Error:', error);
        throw error;
    }
}

/**
 * Get model configuration from configManager
 * @param {string} provider - Model provider (gemini or openai)
 * @returns {Promise<Object>} Configuration object
 */
async function getModelConfig(provider) {
    if (!window.configManager || !window.configManager.loaded) {
        console.log('Waiting for configuration to load...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!window.configManager || !window.configManager.loaded) {
        throw new Error('配置未載入，請刷新頁面');
    }

    if (provider === 'gemini') {
        return configManager.getGeminiConfig();
    } else if (provider === 'openai') {
        return configManager.getOpenAIConfig();
    }

    return null;
}

// ==========================================
// ⚠️ STABLE CODE - DO NOT MODIFY
// 標準模式分析功能 (Toggle OFF)
// 此區域已完成測試並穩定運行，包含：
// - System Instruction (翻譯功能)
// - Gemini API 呼叫邏輯
// ==========================================
/**
 * Call Gemini API (Standard Strict Mode)
 * @param {string} text - Text to analyze
 * @param {string} modelId - Gemini model ID
 * @param {string} apiKey - API key
 * @param {string} targetLanguage - Target language for output
 * @returns {Promise<Array>} Key points
 */
async function callGeminiAPI(text, modelId, apiKey, targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Forced to v1beta to ensure compatibility
    const apiVersion = 'v1beta';

    const modelPath = (modelId.startsWith('models/') || modelId.startsWith('tunedModels/'))
        ? modelId
        : `models/${modelId}`;

    const baseUrl = isLocalhost
        ? `/api/gemini/${apiVersion}/${modelPath}:generateContent`
        : `https://generativelanguage.googleapis.com/${apiVersion}/${modelPath}:generateContent`;

    const url = `${baseUrl}?key=${apiKey}`;

    console.log('[Gemini API] Using AutoScan Agent System Instruction (Standard Mode)');
    console.log('[Gemini API] Target Language:', targetLanguage);

    // AutoScan Agent System Instruction - Enhanced to extract ALL items
    const systemInstruction = `# Role
你是一位專門負責 Notion 數據結構化的專家。你的任務是將「會議內容」拆解為**多個**獨立的行動項目，每個項目對應一筆 Notion 資料庫記錄。

# 核心任務
**從會議逐字稿中提取所有可識別的行動項目、待辦事項、決議事項**。一份會議記錄通常會有 5-20 個不等的行動項目，請務必全部提取，不要遺漏。

# Constraints (核心約束)
1. **多筆輸出**：一份會議記錄應輸出多個 JSON 物件，每個物件代表一個獨立的行動項目。
2. **禁止堆疊**：嚴禁將所有資訊塞入單一 ToDo 欄位。每個行動項目都應該是獨立的物件。
3. **資訊拆解**：將背景資訊、專案名、負責人、日期分別提取到對應欄位。
4. **語言翻譯（極度重要）**：
   - **100% 完整翻譯**：所有輸出內容必須完全翻譯成「${targetLanguage}」，不得保留任何原語言文字
   - **專有名詞處理**：
     * 公司名稱、人名、地名等專有名詞也必須翻譯或音譯
     * 日文專有名詞請翻譯成中文或進行音譯（例：「パラレルレンタル」→「平行租賃」、「日本経済新聞」→「日本經濟新聞」）
     * 保持語意清晰，必要時可在括號內附註原文
   - **完整翻譯範例**：
     * ❌ 錯誤：「進行グローバルソーツ的會議」
     * ✅ 正確：「進行全球體育（グローバルソーツ）的會議」或「進行全球體育的會議」
5. **輸出格式**：嚴格遵守 JSON 格式。僅輸出純 JSON 陣列，不要包含 Markdown 標籤或開場白。

# Field Mapping Logic (欄位對齊邏輯)
- **歸屬分類 (Array)**: 根據語意判斷分類（例：補助申請、海外市場、商務簽約、法說會、研討會）。
- **專案 (Array)**: 提取具體的專案名稱（例：台日產業交流活動、Goonas合作案、12/18簽約儀式）。
- **ToDo (String)**: 提取「重點大意」，字數不需過於精簡，約50字以下。
- **狀態 (Status)**: 根據內容判定，預設為 "未開始"。分析語意提到相似於["完成"、"已完成"、"完成"、"已結案"、"已結案"、"已結束"、"進行中"、"處理中"、"進行中"]詞彙。
- **負責人 (Person)**: 提取語意中提到的單位、個人、實體、公司部門（例：凱衛、文龍、Jason、財務部...）。
- **到期日 (Date)**: 提取日期格式 YYYY-MM-DD。若提到「12/18」則輸出當前年度的 12-18。
- **建立時間 (DateTime)**: 使用 ${new Date().toISOString().slice(0, 19).replace('T', ' ')}。

# JSON Output Structure (輸出多個物件)
[
  {
    "operation": "CREATE",
    "properties": {
      "歸屬分類": ["商務簽約"],
      "專案": ["Goonas合作案"],
      "ToDo": "與日本公司簽約",
      "狀態": "未開始",
      "負責人": "凱衛",
      "到期日": "2026-12-18",
      "建立時間": "2026-01-14 11:00:00"
    }
  },
  {
    "operation": "CREATE",
    "properties": {
      "歸屬分類": ["法說會"],
      "專案": ["Q4財報發表"],
      "ToDo": "準備法說會簡報",
      "狀態": "未開始",
      "負責人": "財務部",
      "到期日": "2026-12-02",
      "建立時間": "2026-01-14 11:00:00"
    }
  }
]

**重要提醒**：請確保輸出陣列包含所有從會議中識別到的行動項目。`;

    const requestBody = {
        contents: [{
            parts: [{
                text: text
            }]
        }],
        system_instruction: {
            parts: [{
                text: systemInstruction
            }]
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Gemini API] Raw Response:', generatedText);

    // ⚠️ END OF STABLE CODE - Standard Mode完整邏輯結束

    // Always use robust parsing (handles JSON or Text)
    return parseStructuredOutput(generatedText);
}

/**
 * Call OpenAI API (Standard Strict Mode)
 * @param {string} text - Text to analyze
 * @param {string} modelVersion - OpenAI model version
 * @param {string} apiKey - API key
 * @param {string} targetLanguage - Target output language
 * @returns {Promise<Array>} Key points
 */
async function callOpenAIAPI(text, modelVersion, apiKey, targetLanguage = 'Traditional Chinese') {
    // Simple prompt for OpenAI (Same as Main Branch)
    const prompt = `Analyze and extract key points. Output language: ${targetLanguage}.\n\n${text}`;

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const url = isLocalhost ? '/api/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: modelVersion,
            messages: [{
                role: 'user',
                content: prompt
            }],
            temperature: 0.7,
            max_tokens: 2048
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    return parseStructuredOutput(generatedText);
}

/**
 * Parse structured JSON output (Helper for future Agent Mode & Robust Standard Mode)
 */
function parseStructuredOutput(text) {
    try {
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const jsonData = JSON.parse(cleanedText);

        if (Array.isArray(jsonData) && jsonData.length > 0) {
            // Check if it's a simple string array (Gemini sometimes returns this even if not asked strings)
            if (typeof jsonData[0] === 'string') {
                return jsonData.map(line => cleanKeyPoint(line));
            }
            // Otherwise assume it's the structured object format
            return jsonData;
        }
        return parseKeyPoints(text);
    } catch (error) {
        // Fallback to text parsing
        return parseKeyPoints(text);
    }
}

/**
 * Helper to clean a single key point string
 */
function cleanKeyPoint(line) {
    return line
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+[\.)]\s*/, '')
        .replace(/^[一二三四五六七八九十]+[、.]\s*/, '')
        .trim();
}

/**
 * Parse key points from AI generated text
 * @param {string} text - Generated text with key points
 * @returns {Array} Array of key point strings
 */
function parseKeyPoints(text) {
    const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const keyPoints = lines.map(line => cleanKeyPoint(line)).filter(point => point.length > 0);

    return keyPoints;
}

/**
 * Get language name from language code
 */
function getLanguageName(langCode) {
    const langMap = {
        'zh-TW': '繁體中文',
        'zh-CN': '简体中文',
        'en-US': 'English',
        'en-GB': 'English',
        'ja-JP': '日本語',
        'ko-KR': '한국어'
    };
    return langMap[langCode] || '繁體中文';
}

/**
 * Display key points in UI - supports both simple array and structured JSON
 * Now renders editable inputs instead of static text
 */
function displayKeyPoints(keyPoints) {
    const container = document.getElementById('keyPointsContainer');
    if (!container) return;

    if (!keyPoints || keyPoints.length === 0) {
        container.innerHTML = '<div class="empty-state">未能提取重點</div>';
        return;
    }

    currentKeyPoints = keyPoints;

    // Check structure
    const isStructured = keyPoints.length > 0 && typeof keyPoints[0] === 'object' && keyPoints[0].properties;

    let html;
    if (isStructured) {
        // Display structured data with multiple editable fields (AutoScan Agent Mode)
        html = `
    <div class="key-points-list">
      ${keyPoints.map((item, index) => {
            const props = item.properties;
            return `
        <div class="key-point-item structured" data-index="${index}">
          <div class="key-point-number">${index + 1}</div>
          <div class="key-point-content">
            <!-- ToDo / Title -->
            <div class="field-group full-width">
                <input type="text" class="edit-field title" value="${escapeHtmlAttribute(props.ToDo || '')}" placeholder="請輸入標題" data-field="ToDo">
            </div>

            <div class="meta-row">
                <!-- 歸屬分類 -->
                <div class="field-group">
                    <span class="field-icon">🏷️</span>
                    <input type="text" class="edit-field tag" value="${escapeHtmlAttribute((props.歸屬分類 || []).join(', '))}" placeholder="分類 (逗號)" data-field="歸屬分類">
                </div>

                <!-- 專案 -->
                <div class="field-group">
                    <span class="field-icon">📁</span>
                    <input type="text" class="edit-field project" value="${escapeHtmlAttribute((props.專案 || []).join(', '))}" placeholder="專案" data-field="專案">
                </div>
            </div>

            <div class="meta-row">
                <!-- 負責人 -->
                <div class="field-group">
                    <span class="field-icon">👤</span>
                    <input type="text" class="edit-field person" value="${escapeHtmlAttribute(props.負責人 || '')}" placeholder="負責人" data-field="負責人">
                </div>

                <!-- 到期日 -->
                <div class="field-group">
                    <span class="field-icon">📅</span>
                    <input type="date" class="edit-field date" value="${escapeHtmlAttribute(props.到期日 || '')}" data-field="到期日">
                </div>

                <!-- 狀態 -->
                <div class="field-group">
                    <span class="field-icon">📊</span>
                    <select class="edit-field status" data-field="狀態">
                        <option value="未開始" ${props.狀態 === '未開始' ? 'selected' : ''}>未開始</option>
                        <option value="進行中" ${props.狀態 === '進行中' ? 'selected' : ''}>進行中</option>
                        <option value="完成" ${props.狀態 === '完成' ? 'selected' : ''}>完成</option>
                    </select>
                </div>
            </div>
          </div>
        </div>
      `;
        }).join('')}
    </div>
  `;
    } else {
        // Display simple string array as editable textareas
        html = `
    <div class="key-points-list">
      ${keyPoints.map((point, index) => `
        <div class="key-point-item simple">
          <div class="key-point-number">${index + 1}</div>
          <div class="key-point-content">
            <textarea class="edit-field simple-item" rows="2" data-index="${index}">${escapeHtml(point)}</textarea>
          </div>
        </div>
      `).join('')}
    </div>
  `;
    }

    container.innerHTML = html;

    // Show copy button
    const copyBtn = document.getElementById('copyKeyPoints');
    if (copyBtn) {
        copyBtn.style.display = 'inline-flex';
    }

    console.log(`Displayed ${keyPoints.length} editable items`);
}

function escapeHtmlAttribute(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyKeyPointsToClipboard() {
    if (!currentKeyPoints || currentKeyPoints.length === 0) {
        alert('沒有重點可以複製');
        return;
    }
    const text = currentKeyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
        showStatusMessage('已複製到剪貼簿', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = `status-message status-${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
}
