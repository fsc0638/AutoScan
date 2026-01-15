// ==========================================
// AI Model API Integration
//
// LOCKED AREA: AI INTERFACE & PROMPTS
// Do not modify the prompt structure or API call flow
// to maintain consistency with the master branch.
// ==========================================

/**
 * Call AI model to analyze text and extract key points
 * @param {string} text - Text to analyze
 * @returns {Promise<Array>} Array of key points
 */
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

    // If a specific agent is selected, look for its dedicated API Key in the config
    if (model.agent !== 'default') {
        const agents = providerConfig?.agents || [];
        // Support both array and object formats
        const agentList = Array.isArray(agents) ? agents : (agents[model.agent] ? [agents[model.agent]] : []);
        const selectedAgentConfig = agentList.find(a => (a.agentKey === model.agent || a.assistantId === model.agent || a.key === model.agent || a.id === model.agent));

        if (selectedAgentConfig && selectedAgentConfig.apiKey) {
            apiKey = selectedAgentConfig.apiKey;
            console.log(`Using dedicated API Key for agent: ${model.agentLabel}`);
        }
    }

    if (!apiKey) {
        throw new Error(`未設定 ${model.provider} API 金鑰`);
    }

    console.log(`Using ${model.agentLabel} (${model.agent}) for analysis...`);

    const defaultVersions = {
        gemini: 'gemini-2.0-flash-exp',
        openai: 'gpt-4o-mini'  // Changed to mini for higher TPM limits
    };

    const modelVersion = defaultVersions[model.provider];

    try {
        if (model.provider === 'gemini') {
            const targetModel = model.agent !== 'default' ? model.agent : modelVersion;
            // Pass agentLabel to determine if we should use structured output
            return await callGeminiAPI(text, targetModel, apiKey, model.agentLabel, targetLanguage);
        } else if (model.provider === 'openai') {
            if (model.agent !== 'default') {
                // Check if agent has assistantId (use Assistants API) or should use Chat Completion
                const agentConfig = providerConfig.agents?.[model.agent];
                if (agentConfig?.assistantId) {
                    // Use Assistants API for configured assistants
                    return await callOpenAIAssistant(text, agentConfig.assistantId, apiKey, targetLanguage);
                } else {
                    // Use Chat Completion API with agentLabel for System Instructions
                    return await callOpenAIAPI(text, modelVersion, apiKey, model.agentLabel, targetLanguage);
                }
            } else {
                // Use Chat Completion API (pass agentLabel to support AutoScan agents)
                return await callOpenAIAPI(text, modelVersion, apiKey, model.agentLabel, targetLanguage);
            }
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
    // Wait for configManager to load if not ready
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

/**
 * Call Gemini API
 * @param {string} text - Text to analyze
 * @param {string} modelId - Gemini model ID
 * @param {string} apiKey - API key
 * @param {string} agentLabel - Agent label to determine behavior
 * @returns {Promise<Array>} Key points or structured data
 */
/**
 * Call Gemini API
 * @param {string} text - Text to analyze
 * @param {string} modelId - Gemini model ID
 * @param {string} apiKey - API key
 * @param {string} agentLabel - Agent label to determine behavior
 * @param {string} targetLanguage - Target language for output
 * @returns {Promise<Array>} Key points or structured data
 */
async function callGeminiAPI(text, modelId, apiKey, agentLabel = '', targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Forced to v1beta to ensure compatibility with both standard and tuned models
    const apiVersion = 'v1beta';

    // Improved path handling: if it already looks like a model path, keep it; otherwise prepend 'models/'
    const modelPath = (modelId.startsWith('models/') || modelId.startsWith('tunedModels/'))
        ? modelId
        : `models/${modelId}`;

    const baseUrl = isLocalhost
        ? `/api/gemini/${apiVersion}/${modelPath}:generateContent`
        : `https://generativelanguage.googleapis.com/${apiVersion}/${modelPath}:generateContent`;

    const url = `${baseUrl}?key=${apiKey}`;

    // Determine if we should use structured output based on agent name
    const useStructuredOutput = agentLabel.includes('AutoScan');

    let systemInstruction = null;
    let userPrompt = text;

    if (useStructuredOutput) {
        // System Instructions for Notion data structuring (only for AutoScan Agent)
        systemInstruction = `# Role
你是一位專門負責 Notion 數據結構化的專家。你的任務是將「會議內容或文件」拆解為多個獨立維度的屬性，以對應 Notion 的資料庫欄位。

# Constraints (核心約束)
1. **完整提取**：請仔細閱讀文件，提取所有重要的行動項目、討論重點、決策和待辦事項。目標是提取 5-20 個項目，如果內容豐富可以超過 20 個。
2. **禁止堆疊**：每個項目應該是獨立的待辦事項或重點，不要將所有資訊塞入單一項目。
3. **資訊拆解**：將背景資訊、專案名、負責人、日期分別提取到對應欄位。
4. **詳細描述**：ToDo 欄位應包含具體的行動項目及必要的背景說明，不要過度精簡。
5. **翻譯與繁體化**：所有輸出必須為 [${targetLanguage}]。
6. **關鍵字提取**：針對每項重點，額外提取 3-5 個相關「關鍵字」並翻譯為 [${targetLanguage}]。
7. **輸出格式**：僅輸出純 JSON 陣列，不包含 Markdown 代碼塊標籤。

# Field Mapping Logic (欄位對齊邏輯)
- **歸屬分類 (Array)**: 根據語意判斷分類（例：補助申請、海外市場、商務簽約、會議記錄、產品開發）。
- **專案 (Array)**: 提取具體的專案名稱（例：台日產業交流活動、Q1 產品發布計劃）。
- **ToDo (String)**: 包含具體的行動項目及必要背景。例如：「準備 Q1 產品發布簡報，需包含市場分析和競品比較」而非僅「準備簡報」。
- **狀態 (Status)**: 根據內容判定，預設為 "未開始"。如果提到「已完成」或「進行中」則相應設定。
- **負責人 (Person)**: 提取提到的個人或團隊（例：凱衛、產品團隊、行銷部門）。
- **到期日 (Date)**: 提取日期格式 YYYY-MM-DD。若提到「4月」，請根據當前年份輸出 YYYY-04-01。若提到「下週」等相對時間，請根據當前時間推算。
- **建立時間 (DateTime)**: 使用當前時間 ${new Date().toISOString().slice(0, 19).replace('T', ' ')}。
- **關鍵字 (Array of Objects)**: 提取 3-5 個「翻譯後」的核心關鍵字，並賦予 1-10 的權重（10 為最核心）。格式：[{"text": "關鍵字", "weight": 5}]。

# Extraction Guidelines
- 包含所有明確的行動項目（Action Items）
- 提取重要的決策點和結論
- 記錄需要跟進的討論主題
- 識別風險、問題或待解決事項
- 不要遺漏任何具體的日期、人名或專案名稱

# JSON Output Structure
[
  {
    "operation": "CREATE",
    "properties": {
      "歸屬分類": ["String"],
      "專案": ["String"],
      "ToDo": "String (詳細的行動項目描述)",
      "狀態": "未開始" | "進行中" | "完成",
      "負責人": "String",
      "到期日": "YYYY-MM-DD",
      "建立時間": "YYYY-MM-DD HH:mm:ss",
      "關鍵字": [{"text": "String", "weight": Number}]
    }
  }
]`;
        console.log('[Gemini API] Using structured output mode for AutoScan Agent');
    } else {
        console.log('[Gemini API] Using simple prompt mode');
        userPrompt = `Please analyze the following text and provide key points. Ensure the output is in ${targetLanguage}.\n\n${text}`;
    }

    // Build request body
    const requestBody = {
        contents: [{
            parts: [{
                text: text
            }]
        }]
    };

    // Add system instruction only if using structured output
    if (systemInstruction) {
        requestBody.system_instruction = {
            parts: [{
                text: systemInstruction
            }]
        };
    }

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

    // Parse based on output mode
    if (useStructuredOutput) {
        return parseStructuredOutput(generatedText);
    } else {
        return parseKeyPoints(generatedText);
    }
}

/**
 * Call OpenAI API
 * @param {string} text - Text to analyze
 * @param {string} modelVersion - OpenAI model version
 * @param {string} apiKey - API key
 * @returns {Promise<Array>} Key points
 */
/**
 * Call OpenAI API
 * @param {string} text - Text to analyze
 * @param {string} modelVersion - OpenAI model version
 * @param {string} apiKey - API key
 * @param {string} agentLabel - Agent label to determine behavior
 * @param {string} targetLanguage - Target output language
 * @returns {Promise<Array>} Key points or structured data
 */
async function callOpenAIAPI(text, modelVersion, apiKey, agentLabel = '', targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const url = isLocalhost ? '/api/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

    // Determine if we should use structured output based on agent name
    const useStructuredOutput = agentLabel.includes('AutoScan');

    let messages = [];

    if (useStructuredOutput) {
        // System Instructions for Notion data structuring (only for AutoScan Agent)
        const systemInstruction = `# Role
你是一位專門負責 Notion 數據結構化的專家。你的任務是將「會議內容或文件」拆解為多個獨立維度的屬性，以對應 Notion 的資料庫欄位。

# Constraints (核心約束)
1. **完整提取**：請仔細閱讀文件，提取所有重要的行動項目、討論重點、決策和待辦事項。目標是提取 5-20 個項目，如果內容豐富可以超過 20 個。
2. **禁止堆疊**：每個項目應該是獨立的待辦事項或重點，不要將所有資訊塞入單一項目。
3. **資訊拆解**：將背景資訊、專案名、負責人、日期分別提取到對應欄位。
4. **詳細描述**：ToDo 欄位應包含具體的行動項目及必要的背景說明，不要過度精簡。
5. **翻譯與繁體化**：所有輸出必須為 [${targetLanguage}]。
6. **關鍵字提取**：針對每項重點，額外提取 3-5 個相關「關鍵字」並翻譯為 [${targetLanguage}]。
7. **輸出格式**：僅輸出純 JSON 陣列，不包含 Markdown 代碼塊標籤。

# Field Mapping Logic (欄位對齊邏輯)
- **歸屬分類 (Array)**: 根據語意判斷分類（例：補助申請、海外市場、商務簽約、會議記錄、產品開發）。
- **專案 (Array)**: 提取具體的專案名稱（例：台日產業交流活動、Q1 產品發布計劃）。
- **ToDo (String)**: 包含具體的行動項目及必要背景。例如：「準備 Q1 產品發布簡報，需包含市場分析和競品比較」而非僅「準備簡報」。
- **狀態 (Status)**: 根據內容判定，預設為 "未開始"。如果提到「已完成」或「進行中」則相應設定。
- **負責人 (Person)**: 提取提到的個人或團隊（例：凱衛、產品團隊、行銷部門）。
- **到期日 (Date)**: 提取日期格式 YYYY-MM-DD。若提到「4月」，請根據當前年份輸出 YYYY-04-01。若提到「下週」等相對時間，請根據當前時間推算。
- **建立時間 (DateTime)**: 使用當前時間 ${new Date().toISOString().slice(0, 19).replace('T', ' ')}。
- **關鍵字 (Array of Objects)**: 提取 3-5 個「翻譯後」的核心關鍵字，並賦予 1-10 的權重（10 為最核心）。格式：[{"text": "關鍵字", "weight": 5}]。

# Extraction Guidelines
- 包含所有明確的行動項目（Action Items）
- 提取重要的決策點和結論
- 記錄需要跟進的討論主題
- 識別風險、問題或待解決事項
- 不要遺漏任何具體的日期、人名或專案名稱

# JSON Output Structure
[
  {
    "operation": "CREATE",
    "properties": {
      "歸屬分類": ["String"],
      "專案": ["String"],
      "ToDo": "String (詳細的行動項目描述)",
      "狀態": "未開始" | "進行中" | "完成",
      "負責人": "String",
      "到期日": "YYYY-MM-DD",
      "建立時間": "YYYY-MM-DD HH:mm:ss",
      "關鍵字": [{"text": "String", "weight": Number}]
    }
  }
]`;

        console.log('[OpenAI API] Using structured output mode for AutoScan Agent');

        messages = [
            {
                role: 'system',
                content: systemInstruction
            },
            {
                role: 'user',
                content: text
            }
        ];
    } else {
        console.log('[OpenAI API] Using simple prompt mode');
        const prompt = `Analyze and extract key points. Output language: ${targetLanguage}.\n\n${text}`;
        messages = [{
            role: 'user',
            content: prompt
        }];
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: modelVersion,
            messages: messages,
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

    // Parse based on output mode
    if (useStructuredOutput) {
        return parseStructuredOutput(generatedText);
    } else {
        return parseKeyPoints(generatedText);
    }
}

/**
 * Parse structured JSON output from Gemini for Notion
 * @param {string} text - Generated text with JSON structure
 * @returns {Array} Array of structured objects or fallback to simple key points
 */
function parseStructuredOutput(text) {
    try {
        // Remove markdown code block tags if present (more robust version)
        let cleanedText = text.trim();

        // Remove markdown code blocks (```json or ```)
        cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '');

        // Trim again after removing code blocks
        cleanedText = cleanedText.trim();

        // Additional cleanup: remove any leading/trailing whitespace
        cleanedText = cleanedText.replace(/^\s+|\s+$/g, '');

        console.log('[AI API] Attempting to parse JSON:', cleanedText.substring(0, 100) + '...');

        // Try to parse as JSON
        const jsonData = JSON.parse(cleanedText);

        // Validate it's an array
        if (Array.isArray(jsonData) && jsonData.length > 0) {
            console.log('[AI API] Successfully parsed structured JSON output with', jsonData.length, 'items');
            return jsonData;
        }

        // If not valid array, fall back to simple parsing
        console.warn('[AI API] JSON is not an array or is empty, falling back to simple parsing');
        console.warn('[AI API] Parsed data type:', typeof jsonData, 'Array:', Array.isArray(jsonData));
        return parseKeyPoints(text);

    } catch (error) {
        // If JSON parsing fails, fall back to simple key points parsing
        console.error('[AI API] Failed to parse as JSON:', error.message);
        console.error('[AI API] Failed text (first 200 chars):', text.substring(0, 200));
        return parseKeyPoints(text);
    }
}

/**
 * Parse key points from AI generated text
 * @param {string} text - Generated text with key points
 * @returns {Array} Array of key point strings
 */
function parseKeyPoints(text) {
    // Split by newlines and filter empty lines
    const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // Remove bullet points, numbers, and other markers
    const keyPoints = lines.map(line => {
        return line
            .replace(/^[-*•]\s*/, '')  // Remove bullet points
            .replace(/^\d+[\.)]\s*/, '') // Remove numbers
            .replace(/^[一二三四五六七八九十]+[、.]\s*/, '') // Remove Chinese numbers
            .trim();
    }).filter(point => point.length > 0);

    return keyPoints;
}

/**
 * Get language name from language code
 * @param {string} langCode - Language code
 * @returns {string} Language name
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
 * @param {Array} keyPoints - Array of key point strings or structured objects
 */
function displayKeyPoints(keyPoints) {
    const container = document.getElementById('keyPointsContainer');
    if (!container) return;

    if (!keyPoints || keyPoints.length === 0) {
        container.innerHTML = '<div class="empty-state">未能提取重點</div>';
        return;
    }

    currentKeyPoints = keyPoints;

    // Determine if we have structured data or simple strings
    const isStructured = keyPoints.length > 0 && typeof keyPoints[0] === 'object' && keyPoints[0].properties;

    let html;
    if (isStructured) {
        // Display structured data with multiple editable fields
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
                <input type="text" class="edit-field title" value="${escapeHtmlAttribute(props.ToDo || '')}" placeholder="待辦事項標題" data-field="ToDo">
            </div>
            
            <div class="meta-row">
                <!-- 歸屬分類 -->
                <div class="field-group">
                    <span class="field-icon">🏷️</span>
                    <input type="text" class="edit-field tag" value="${escapeHtmlAttribute((props.歸屬分類 || []).join(', '))}" placeholder="分類 (逗號分隔)" data-field="歸屬分類">
                </div>

                <!-- 專案 -->
                <div class="field-group">
                    <span class="field-icon">🚀</span>
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
                    <span class="field-icon">🔄</span>
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

    console.log(`✅ Displayed ${keyPoints.length} editable items`);
}

/**
 * Helper to escape HTML attributes
 */
function escapeHtmlAttribute(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;');
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Copy key points to clipboard
 */
function copyKeyPointsToClipboard() {
    if (!currentKeyPoints || currentKeyPoints.length === 0) {
        alert('沒有重點可以複製');
        return;
    }

    const text = currentKeyPoints
        .map((point, index) => `${index + 1}. ${point}`)
        .join('\n');

    navigator.clipboard.writeText(text).then(() => {
        showStatusMessage('已複製到剪貼簿', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showStatusMessage('複製失敗', 'error');
    });
}

/**
 * Show status message
 * @param {string} message - Message to show
 * @param {string} type - Message type (success, error, info)
 */
function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;

    statusDiv.textContent = message;
    statusDiv.className = `status-message status-${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

/**
 * Call OpenAI Assistants API
 * @param {string} text - Text to analyze
 * @param {string} assistantId - Assistant ID (asst_...)
 * @param {string} apiKey - API key
 * @returns {Promise<Array>} Key points
 */
async function callOpenAIAssistant(text, assistantId, apiKey, targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? '/api/openai/v1' : 'https://api.openai.com/v1';

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
    };

    try {
        // 1. Create a Thread
        const threadResponse = await fetch(`${baseUrl}/threads`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: `Please output in ${targetLanguage}.`
                }]
            })
        });

        if (!threadResponse.ok) {
            const errorText = await threadResponse.text();
            throw new Error(`Failed to create thread: ${threadResponse.status} - ${errorText}`);
        }

        const thread = await threadResponse.json();
        const threadId = thread.id;

        // 2. Add a Message to the Thread
        const prompt = text; // Assistants have their own instructions

        const messageResponse = await fetch(`${baseUrl}/threads/${threadId}/messages`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                role: 'user',
                content: prompt
            })
        });

        if (!messageResponse.ok) {
            const errorText = await messageResponse.text();
            throw new Error(`Failed to add message: ${messageResponse.status} - ${errorText}`);
        }

        // 3. Create a Run
        const runResponse = await fetch(`${baseUrl}/threads/${threadId}/runs`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                assistant_id: assistantId
            })
        });

        if (!runResponse.ok) {
            const errorText = await runResponse.text();
            throw new Error(`Failed to create run: ${runResponse.status} - ${errorText}`);
        }

        const run = await runResponse.json();
        if (!run.id) throw new Error(run.error?.message || 'Failed to create run');
        const runId = run.id;

        // 4. Poll for completion
        let status = run.status;
        let pollCount = 0;
        const maxPolls = 30; // Timeout after 45 seconds (reduced from 90s)

        console.log(`[Client] Initial run status: ${status}`);
        console.log(`[Client] Starting polling for run: ${runId}`);

        while (status === 'queued' || status === 'in_progress' || status === 'requires_action') {
            if (pollCount >= maxPolls) {
                throw new Error(`Assistant response timeout after ${maxPolls * 1.5} seconds. Status: ${status}`);
            }

            // Show progress to user
            if (typeof showStatusMessage === 'function') {
                showStatusMessage(`AI 分析中... (${pollCount + 1}/${maxPolls})`, 'info');
            }

            await new Promise(resolve => setTimeout(resolve, 1500));

            const pollResponse = await fetch(`${baseUrl}/threads/${threadId}/runs/${runId}`, {
                method: 'GET',
                headers: headers
            });

            if (!pollResponse.ok) {
                const errorText = await pollResponse.text();
                throw new Error(`Failed to poll run status: ${pollResponse.status} - ${errorText}`);
            }

            const poll = await pollResponse.json();
            status = poll.status;
            pollCount++;

            console.log(`[Client] Poll #${pollCount}: status = ${status}`);

            if (status === 'failed' || status === 'cancelled' || status === 'expired') {
                const errorMsg = poll.last_error?.message || 'Unknown error';
                throw new Error(`Assistant Run ${status}: ${errorMsg}`);
            }

            // Handle requires_action (e.g., function calls)
            if (status === 'requires_action') {
                console.warn('[Client] Run requires action - this is not supported yet');
                throw new Error('Assistant requires action (function calls) which is not currently supported');
            }
        }

        console.log(`[Client] Run completed with status: ${status} after ${pollCount} polls`);

        // 5. Retrieve the Messages
        const messagesResponse = await fetch(`${baseUrl}/threads/${threadId}/messages`, {
            method: 'GET',
            headers: headers
        });

        if (!messagesResponse.ok) {
            const errorText = await messagesResponse.text();
            throw new Error(`Failed to retrieve messages: ${messagesResponse.status} - ${errorText}`);
        }

        const messagesData = await messagesResponse.json();

        // Find the last assistant message
        const lastMessage = messagesData.data.find(m => m.role === 'assistant');
        const generatedText = lastMessage?.content?.[0]?.text?.value || '';

        return parseKeyPoints(generatedText);

    } catch (error) {
        console.error('OpenAI Assistant Error:', error);
        throw error;
    }
}
