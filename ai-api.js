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
    // 1. ROUTE TO VERTEX AI AGENT (If Toggle ON)
    // ==========================================
    if (model.useAgent) {
        if (typeof window.callVertexAgent === 'function') {
            console.log('[AI API] Routing to Vertex AI Agent...');
            try {
                return await window.callVertexAgent(text);
            } catch (agentError) {
                console.error('[AI API] Vertex Agent Error:', agentError);
                throw agentError;
            }
        } else {
            throw new Error("Vertex AI Agent 模組未載入，請確認 vertex-agent-api.js 已正確引入");
        }
    }

    // ==========================================
    // 2. STANDARD AI MODEL ROUTING (Toggle OFF)
    // ==========================================
    const defaultVersions = {
        gemini: 'gemini-2.0-flash-exp',
        openai: 'gpt-4o'
    };

    const modelVersion = defaultVersions[model.provider];

    try {
        if (model.provider === 'gemini') {
            let targetModel = model.agent;
            if (targetModel === 'default' || !targetModel.startsWith('gemini')) {
                targetModel = modelVersion;
            }
            return await callGeminiAPI(text, targetModel, apiKey, model.agentLabel, targetLanguage);
        } else if (model.provider === 'openai') {
            return await callOpenAIAPI(text, modelVersion, apiKey, model.agentLabel, targetLanguage);
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

/**
 * Get unified system instruction for AutoScan data structuring
 */
function getSystemInstruction(targetLanguage = 'Traditional Chinese') {
    return `# OUTPUT LANGUAGE (重要：輸出語言要求)
- ALL output content values MUST be in [${targetLanguage}].
- 如果輸入是英文而要求是繁體中文，請務必翻譯。
- 如果輸入是中文而要求是 English，請務必翻譯。

# Role
你是一位專門負責 Notion 數據結構化的專家。你的任務是將「會議內容或文件」拆解為多個獨立維度的屬性，以對應 Notion 的資料庫欄位。

# Constraints (核心約束)
1. **完整提取**：請仔細閱讀文件，提取所有重要的行動項目、討論重點、決議和待辦事項。目標是提取 15-20 個項目，如果內容豐富可以超過 20 個。
2. **禁止堆疊**：每個項目應該是獨立的待辦事項或重點，不要將所有資訊塞入單一項目。
3. **資訊拆解**：將背景資訊、專案名、負責人、日期分別提取到對應欄位。
4. **詳細描述**：ToDo 欄位應包含具體的行動項目及必要的背景說明，20 到 50 字元，不要過度精簡。
5. **語言與鍵值校準**：
   - **翻譯要求**：所有欄位的「內容值（Value）」必須完全使用 [${targetLanguage}]。
   - **鍵值固定**：**絕對嚴禁翻譯或更動 JSON 的鍵值（Key Name）**。鍵值必須維持：'operation', 'properties', '歸屬分類', '專案', 'ToDo', '狀態', '負責人', '到期日', '建立時間', '關鍵字', 'text', 'weight'。
6. **關鍵字提取**：針對每項重點，額外提取 3-5 個相關「關鍵字」並翻譯為 [${targetLanguage}]。
7. **輸出格式**：僅輸出純 JSON 陣列，不包含 Markdown 代碼塊標籤。
`;
}

/**
 * Call Gemini API
 */
async function callGeminiAPI(text, modelId, apiKey, agentLabel = '', targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiVersion = 'v1beta';
    const modelPath = (modelId.startsWith('models/') || modelId.startsWith('tunedModels/')) ? modelId : `models/${modelId}`;
    const baseUrl = isLocalhost ? `/api/gemini/${apiVersion}/${modelPath}:generateContent` : `https://generativelanguage.googleapis.com/${apiVersion}/${modelPath}:generateContent`;
    const url = `${baseUrl}?key=${apiKey}`;

    const useStructuredOutput = agentLabel.includes('AutoScan');
    let systemInstruction = null;
    let userPrompt = text;

    if (useStructuredOutput) {
        systemInstruction = getSystemInstruction(targetLanguage);
        userPrompt = `TASK: ANALYZE AND TRANSLATE TO [${targetLanguage}].
Structure the following text. IMPORTANT: Translate all content values into [${targetLanguage}], but KEEP ALL JSON KEYS exactly as defined. Content:\n\n${text}`;
    } else {
        userPrompt = `Please analyze the following text and provide key points. Ensure the output is in ${targetLanguage}.\n\n${text}`;
    }

    const requestBody = {
        contents: [{ parts: [{ text: userPrompt }] }]
    };

    if (systemInstruction) {
        requestBody.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...requestBody,
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return useStructuredOutput ? parseStructuredOutput(generatedText) : parseKeyPoints(generatedText);
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(text, modelVersion, apiKey, agentLabel = '', targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const url = isLocalhost ? '/api/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

    const useStructuredOutput = agentLabel.includes('AutoScan');
    let messages = [];

    if (useStructuredOutput) {
        messages = [
            { role: 'system', content: getSystemInstruction(targetLanguage) },
            { role: 'user', content: `Please analyze and structure the following text. IMPORTANT: Translate all content values into [${targetLanguage}], but KEEP ALL JSON KEYS exactly as defined. Content:\n\n${text}` }
        ];
    } else {
        messages = [{ role: 'user', content: `Analyze and extract key points. Output language: ${targetLanguage}.\n\n${text}` }];
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVersion, messages, temperature: 0.7, max_tokens: 8192 })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    return useStructuredOutput ? parseStructuredOutput(generatedText) : parseKeyPoints(generatedText);
}

/**
 * Parse structured JSON output with resilience
 */
function parseStructuredOutput(text) {
    try {
        let cleanedText = text.trim();
        const startIndex = cleanedText.indexOf('[');
        if (startIndex !== -1) {
            const lastEndIndex = cleanedText.lastIndexOf(']');
            if (lastEndIndex > startIndex) cleanedText = cleanedText.substring(startIndex, lastEndIndex + 1);
            else cleanedText = cleanedText.substring(startIndex);
        }
        cleanedText = cleanedText.replace(/```\s*$/g, '').trim();

        try {
            const jsonData = JSON.parse(cleanedText);
            if (Array.isArray(jsonData) && jsonData.length > 0) return jsonData;
        } catch (initialError) {
            if (cleanedText.startsWith('[')) {
                const lastBrace = cleanedText.lastIndexOf('}');
                if (lastBrace !== -1) {
                    try {
                        const repairedText = cleanedText.substring(0, lastBrace + 1) + ']';
                        const jsonData = JSON.parse(repairedText);
                        if (Array.isArray(jsonData)) return jsonData;
                    } catch (repairError) { }
                }
            }
            throw initialError;
        }
        return parseKeyPoints(text);
    } catch (error) {
        try {
            const matches = text.match(/\{"operation":\s*"CREATE"[\s\S]*?\}/g);
            if (matches && matches.length > 0) {
                const results = matches.map(m => {
                    try { return JSON.parse(m); } catch (e) { return null; }
                }).filter(p => p !== null);
                if (results.length > 0) return results;
            }
        } catch (deepError) { }
        return parseKeyPoints(text);
    }
}

/**
 * Parse key points from AI generated text
 */
function parseKeyPoints(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        .filter(line => ![/^```/, /^\[\s*$/, /^\]\s*,?$/, /^\{\s*$/, /^\}\s*,?$/].some(p => p.test(line)));

    return lines.map(line => line.replace(/^[-*?兡\s*/, '').replace(/^\d+[\.)]\s*/, '').trim())
        .filter(point => point.length > 0 && point !== 'json' && point !== 'properties');
}

/**
 * Get language name from language code
 */
function getLanguageName(langCode) {
    const langMap = { 'zh-TW': '繁體中文', 'zh-CN': '简体中文', 'en-US': 'English', 'ja-JP': '日本語', 'ko-KR': '한국어' };
    return langMap[langCode] || '繁體中文';
}

/**
 * Display key points in UI
 */
function displayKeyPoints(keyPoints) {
    const container = document.getElementById('keyPointsContainer');
    if (!container) return;
    if (!keyPoints || keyPoints.length === 0) {
        container.innerHTML = '<div class="empty-state">尚未提取重點</div>';
        return;
    }

    currentKeyPoints = keyPoints;
    const isStructured = keyPoints.length > 0 && typeof keyPoints[0] === 'object' && keyPoints[0].properties;

    let html = '<div class="key-points-list">';
    if (isStructured) {
        html += keyPoints.map((item, index) => {
            const props = item.properties;
            return `
                <div class="key-point-item structured" data-index="${index}">
                    <div class="key-point-number">${index + 1}</div>
                    <div class="key-point-content">
                        <div class="field-group full-width">
                            <input type="text" class="edit-field title" value="${escapeHtmlAttribute(props.ToDo || '')}" data-field="ToDo">
                        </div>
                        <div class="meta-row">
                            <div class="field-group"><span class="field-icon">📁</span><input type="text" class="edit-field tag" value="${escapeHtmlAttribute((props.歸屬分類 || []).join(', '))}" data-field="歸屬分類"></div>
                            <div class="field-group"><span class="field-icon">�</span><input type="text" class="edit-field project" value="${escapeHtmlAttribute((props.專案 || []).join(', '))}" data-field="專案"></div>
                        </div>
                        <div class="meta-row">
                            <div class="field-group"><span class="field-icon">👤</span><input type="text" class="edit-field person" value="${escapeHtmlAttribute(props.負責人 || '')}" data-field="負責人"></div>
                            <div class="field-group"><span class="field-icon">📅</span><input type="date" class="edit-field date" value="${escapeHtmlAttribute(props.到期日 || '')}" data-field="到期日"></div>
                            <div class="field-group"><span class="field-icon">�</span>
                                <select class="edit-field status" data-field="狀態">
                                    <option value="未開始" ${props.狀態 === '未開始' ? 'selected' : ''}>未開始</option>
                                    <option value="進行中" ${props.狀態 === '進行中' ? 'selected' : ''}>進行中</option>
                                    <option value="已完成" ${props.狀態 === '已完成' ? 'selected' : ''}>已完成</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    } else {
        html += keyPoints.map((point, index) => `
            <div class="key-point-item simple">
                <div class="key-point-number">${index + 1}</div>
                <div class="key-point-content"><textarea class="edit-field simple-item" rows="2" data-index="${index}">${escapeHtml(point)}</textarea></div>
            </div>`).join('');
    }
    html += '</div>';
    container.innerHTML = html;
}

function escapeHtmlAttribute(text) { return text ? text.toString().replace(/"/g, '&quot;') : ''; }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = `status-message status-${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { if (statusDiv) statusDiv.style.display = 'none'; }, 3000);
}

// Export functions to global window
window.getSystemInstruction = getSystemInstruction;
window.callAIModel = callAIModel;
window.callGeminiAPI = callGeminiAPI;
window.callOpenAIAPI = callOpenAIAPI;
window.parseStructuredOutput = parseStructuredOutput;
window.parseKeyPoints = parseKeyPoints;
window.getLanguageName = getLanguageName;
window.displayKeyPoints = displayKeyPoints;
window.showStatusMessage = showStatusMessage;
