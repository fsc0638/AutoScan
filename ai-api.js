// ==========================================
// AI Model API Integration - COMPATIBILITY LAYER
// ==========================================
// This file now serves as a compatibility wrapper for the new LLM Core module
// Maintains backward compatibility with existing AutoScan code
// 
// ⚠️  NEW PROJECTS: Use llm-core.js directly instead of this file
// 📌 This wrapper will be deprecated in future versions

console.log('⚠️  ai-api.js loaded as compatibility layer. Consider migrating to llm-core.js');

/**
 * Call AI model to analyze text and extract key points
 * @param {string} text - Text to analyze
 * @param {string} targetLanguage - Target output language
 * @returns {Promise<Array>} Array of key points
 * 
 * @deprecated Use window.llmCore.call() instead
 */
async function callAIModel(text, targetLanguage = 'Traditional Chinese') {
    // Get model configuration from the old model selector if it exists
    // Otherwise use LLM UI Component
    let model;

    if (typeof getSelectedModel === 'function') {
        // Old model selector still exists
        model = getSelectedModel();
    } else if (window.llmUI) {
        // Use new LLM UI Component
        model = window.llmUI.getSelection();
        model = {
            provider: model.provider,
            agent: model.model,
            agentLabel: model.modelName,
            useAgent: model.useAgent
        };
    } else {
        // Fallback to default
        model = {
            provider: 'gemini',
            agent: 'gemini-2.0-flash-exp',
            agentLabel: 'Gemini 2.0 Flash',
            useAgent: false
        };
    }

    const providerConfig = await getModelConfig(model.provider);

    // Determine the API Key
    let apiKey = providerConfig?.apiKey;
    if (!apiKey) {
        throw new Error(`未設定 ${model.provider} API 金鑰`);
    }

    console.log(`[AI API Wrapper] Using ${model.agentLabel} (${model.agent})`);
    console.log(`[AI API Wrapper] Agent Mode: ${model.useAgent}`);

    // ==========================================
    // ROUTE TO VERTEX AI AGENT (If Toggle ON)
    // ==========================================
    if (model.useAgent) {
        if (typeof window.callVertexAgent === 'function') {
            console.log('[AI API Wrapper] Routing to Vertex AI Agent...');
            try {
                return await window.callVertexAgent(text);
            } catch (agentError) {
                console.error('[AI API Wrapper] Vertex Agent Error:', agentError);
                throw agentError;
            }
        } else {
            throw new Error("Vertex AI Agent 模組未載入，請確認 vertex-agent-api.js 已正確引入");
        }
    }

    // ==========================================
    // STANDARD AI MODEL ROUTING (Using LLM Core)
    // ==========================================
    if (!window.llmCore) {
        console.error('[AI API Wrapper] LLM Core not available, falling back to direct API calls');
        // Fallback to old implementation
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

    // Use new LLM Core
    try {
        // ==========================================
        // 重要：所有標準模型都使用 AutoScan 系統指令
        // 不再根據 agentLabel 判斷
        // ==========================================
        const systemInstruction = getSystemInstruction(targetLanguage);

        console.log('[AI API Wrapper] Using AutoScan system instruction for all standard models');

        const result = await window.llmCore.call(text, {
            provider: model.provider,
            model: model.agent,
            targetLanguage: targetLanguage,
            systemInstruction: systemInstruction,  // 永遠使用
            useAgent: false // Already handled above
        });

        // Parse - 永遠嘗試解析結構化輸出
        return parseStructuredOutput(result.text);
    } catch (error) {
        console.error('[AI API Wrapper] Error:', error);
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
 * System instruction cache
 */
let systemInstructionCache = null;

/**
 * Load system instruction from external file
 */
async function loadSystemInstruction() {
    if (systemInstructionCache) {
        return systemInstructionCache;
    }

    try {
        const response = await fetch('system-instruction.txt');
        if (!response.ok) {
            throw new Error(`Failed to load system instruction: ${response.status}`);
        }
        systemInstructionCache = await response.text();
        console.log('✅ System instruction loaded from file');
        console.log(`📄 File size: ${systemInstructionCache.length} characters`);
        console.log(`📝 First 200 chars: ${systemInstructionCache.substring(0, 200)}...`);
        return systemInstructionCache;
    } catch (error) {
        console.error('❌ Failed to load system instruction file:', error);
        // Fallback to minimal instruction if file load fails
        const fallback = `You are an expert in structuring meeting content for Notion databases. 
Extract key points and format as JSON array with fields: 歸屬分類, 專案, ToDo, 狀態, 負責人, 到期日, 建立時間, 關鍵字.
Translate all content values to [{targetLanguage}].`;
        console.warn('⚠️ Using fallback system instruction');
        return fallback;
    }
}

/**
 * Get unified system instruction for AutoScan data structuring
 * Now loads from external file
 */
async function getSystemInstruction(targetLanguage = 'Traditional Chinese') {
    const template = await loadSystemInstruction();
    const finalInstruction = template.replace(/{targetLanguage}/g, targetLanguage);
    console.log(`🎯 System Instruction prepared for language: ${targetLanguage}`);
    console.log(`📏 Final instruction length: ${finalInstruction.length} characters`);
    console.log(`🔍 Contains "CRITICAL"? ${finalInstruction.includes('CRITICAL')}`);
    console.log(`🔍 Contains "關鍵字"? ${finalInstruction.includes('關鍵字')}`);
    return finalInstruction;
}

/**
 * Call Gemini API (Legacy fallback)
 */
async function callGeminiAPI(text, modelId, apiKey, agentLabel = '', targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiVersion = 'v1beta';
    const modelPath = (modelId.startsWith('models/') || modelId.startsWith('tunedModels/')) ? modelId : `models/${modelId}`;
    const baseUrl = isLocalhost ? `/api/gemini/${apiVersion}/${modelPath}:generateContent` : `https://generativelanguage.googleapis.com/${apiVersion}/${modelPath}:generateContent`;
    const url = `${baseUrl}?key=${apiKey}`;

    // ==========================================
    // 重要：所有模型都使用 AutoScan 系統指令
    // ==========================================
    const systemInstruction = await getSystemInstruction(targetLanguage);
    const userPrompt = `TASK: ANALYZE AND TRANSLATE TO [${targetLanguage}].
Structure the following text. IMPORTANT: Translate all content values into [${targetLanguage}], but KEEP ALL JSON KEYS exactly as defined. Content:\n\n${text}`;

    const requestBody = {
        contents: [{ parts: [{ text: userPrompt }] }],
        system_instruction: { parts: [{ text: systemInstruction }] }
    };

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

    // 永遠嘗試解析結構化輸出
    return parseStructuredOutput(generatedText);
}

/**
 * Call OpenAI API (Legacy fallback)
 */
async function callOpenAIAPI(text, modelVersion, apiKey, agentLabel = '', targetLanguage = 'Traditional Chinese') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const url = isLocalhost ? '/api/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

    // ==========================================
    // 重要：所有模型都使用 AutoScan 系統指令
    // ==========================================
    const messages = [
        { role: 'system', content: getSystemInstruction(targetLanguage) },
        { role: 'user', content: `Please analyze and structure the following text. IMPORTANT: Translate all content values into [${targetLanguage}], but KEEP ALL JSON KEYS exactly as defined. Content:\n\n${text}` }
    ];

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

    // 永遠嘗試解析結構化輸出
    return parseStructuredOutput(generatedText);
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

    return lines.map(line => line.replace(/^[-*•]\s*/, '').replace(/^\d+[\.)]\s*/, '').trim())
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

    // Check if structured data - handle both {properties: {...}} and direct {...} formats
    const isStructured = keyPoints.length > 0 && typeof keyPoints[0] === 'object' && (keyPoints[0].properties || keyPoints[0]['ToDo'] || keyPoints[0]['專案']);

    console.log('[displayKeyPoints] isStructured:', isStructured);
    console.log('[displayKeyPoints] First item:', keyPoints[0]);

    let html = '<div class="key-points-list">';
    if (isStructured) {
        html += keyPoints.map((item, index) => {
            const props = item.properties || item;
            return `
                <div class="key-point-item structured" data-index="${index}">
                    <div class="key-point-number">${index + 1}</div>
                    <div class="key-point-content">
                        <div class="field-group full-width">
                            <input type="text" class="edit-field title" value="${escapeHtmlAttribute(props.ToDo || '')}" data-field="ToDo">
                        </div>
                        <div class="meta-row">
                            <div class="field-group"><span class="field-icon">📁</span><input type="text" class="edit-field tag" value="${escapeHtmlAttribute(Array.isArray(props.歸屬分類) ? props.歸屬分類.join(', ') : (props.歸屬分類 || ''))}" data-field="歸屬分類"></div>
                            <div class="field-group"><span class="field-icon">📎</span><input type="text" class="edit-field project" value="${escapeHtmlAttribute(Array.isArray(props.專案) ? props.專案.join(', ') : (props.專案 || ''))}" data-field="專案"></div>
                        </div>
                        <div class="meta-row">
                            <div class="field-group"><span class="field-icon">👤</span><input type="text" class="edit-field person" value="${escapeHtmlAttribute(props.負責人 || '')}" data-field="負責人"></div>
                            <div class="field-group"><span class="field-icon">📅</span><input type="date" class="edit-field date" value="${escapeHtmlAttribute(props.到期日 || '')}" data-field="到期日"></div>
                            <div class="field-group"><span class="field-icon">⚙️</span>
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

console.log('✅ AI API compatibility layer loaded');
