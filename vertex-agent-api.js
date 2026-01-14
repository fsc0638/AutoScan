/**
 * ============================================
 * Vertex AI Agent API Integration
 * ============================================
 * 
 * 獨立模組：處理 Vertex AI Agent Builder 呼叫
 * 
 * 此模組與現有的 ai-api.js 完全隔離，
 * 僅當 Toggle ON 時才會被呼叫。
 */

/**
 * Vertex AI Agent 設定
 */
const VERTEX_AGENT_CONFIG = {
    // 使用 Project Number (不是 Project ID) - Discovery Engine API 需要
    projectId: '374299927578',
    location: 'global',
    // 正確的 Engine ID (from Agent Builder Console)
    engineId: 'agent-e7367a0c-99a2-4d87-9398-d535b394532a-search-engine',
    // Data Store ID (for document retrieval)
    dataStoreId: 'autoscan-docs-store_1768371847989',
    // Cloud Storage Bucket (for file uploads)
    bucketName: 'autoscan-files-fsc',
    // Agent 顯示名稱
    agentName: 'AutoScan Agent',
    // Discovery Engine API endpoint
    apiEndpoint: 'https://discoveryengine.googleapis.com'
};

/**
 * 主要入口：呼叫 Vertex AI Agent 分析文字
 * 
 * @param {string} text - 要分析的文字內容
 * @param {File|null} file - 可選的檔案物件（用於檔案分析）
 * @returns {Promise<Array>} 結構化 JSON 陣列
 */
async function callVertexAgent(text, file = null) {
    console.log('[Vertex Agent] Starting agent call...');
    console.log('[Vertex Agent] Text length:', text.length);
    console.log('[Vertex Agent] File provided:', !!file);

    try {
        // 透過 Server Proxy 呼叫 Vertex AI Agent
        const response = await fetch('/api/vertex-agent/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: text,
                projectId: VERTEX_AGENT_CONFIG.projectId,
                location: VERTEX_AGENT_CONFIG.location,
                engineId: VERTEX_AGENT_CONFIG.engineId,
                dataStoreId: VERTEX_AGENT_CONFIG.dataStoreId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Vertex Agent Error: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('[Vertex Agent] Raw response:', data);

        // 解析 Agent 回傳的結構化資料
        return parseVertexAgentResponse(data);

    } catch (error) {
        console.error('[Vertex Agent] Error:', error);
        throw error;
    }
}

/**
 * 上傳檔案至 Cloud Storage
 * 
 * @param {File} file - 要上傳的檔案
 * @returns {Promise<string>} 上傳後的 GCS URI (gs://bucket/path)
 */
async function uploadToCloudStorage(file) {
    console.log('[Vertex Agent] Uploading file to Cloud Storage:', file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', VERTEX_AGENT_CONFIG.projectId);

    try {
        const response = await fetch('/api/gcs/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Upload Error: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('[Vertex Agent] File uploaded:', data.gcsUri);

        return data.gcsUri;

    } catch (error) {
        console.error('[Vertex Agent] Upload Error:', error);
        throw error;
    }
}

/**
 * 解析 Vertex AI Agent 回應
 * 
 * @param {Object} response - Agent API 回應
 * @returns {Array} 結構化 JSON 陣列 (符合 Notion 欄位格式)
 */
function parseVertexAgentResponse(response) {
    console.log('[Vertex Agent] Parsing response...');

    // Vertex AI Agent Builder 回應格式取決於 Agent 類型
    // 這裡假設 Agent 回傳的是 answer 或 results

    let rawContent = '';

    // 嘗試從不同的回應格式中提取內容
    if (response.answer) {
        // Conversational Agent 格式
        rawContent = response.answer;
    } else if (response.results && response.results.length > 0) {
        // Search Agent 格式
        rawContent = response.results.map(r => r.document?.derivedStructData || r).join('\n');
    } else if (response.reply) {
        // Chat Agent 格式
        rawContent = response.reply;
    } else if (typeof response === 'string') {
        rawContent = response;
    } else {
        // 如果是直接的 JSON 結構
        rawContent = JSON.stringify(response);
    }

    console.log('[Vertex Agent] Extracted content:', rawContent.substring(0, 200) + '...');

    // 嘗試解析為 JSON
    try {
        // 移除可能的 markdown 標記
        let cleanedText = rawContent.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const jsonData = JSON.parse(cleanedText);

        // 驗證是否為陣列
        if (Array.isArray(jsonData) && jsonData.length > 0) {
            console.log('[Vertex Agent] Parsed as JSON array:', jsonData.length, 'items');
            return jsonData;
        }

        // 如果是單一物件，包裝成陣列
        if (jsonData.properties) {
            console.log('[Vertex Agent] Wrapped single object as array');
            return [jsonData];
        }

        console.warn('[Vertex Agent] Unexpected JSON structure, returning as-is');
        return [{ operation: 'CREATE', properties: { ToDo: rawContent } }];

    } catch (parseError) {
        console.warn('[Vertex Agent] Failed to parse as JSON, falling back to text');
        // 如果解析失敗，建立一個基本的結構
        return [{
            operation: 'CREATE',
            properties: {
                ToDo: rawContent,
                狀態: '未開始',
                建立時間: new Date().toISOString().slice(0, 19).replace('T', ' ')
            }
        }];
    }
}

/**
 * 檢查 Vertex Agent 是否可用
 * 
 * @returns {Promise<boolean>} Agent 是否可用
 */
async function checkVertexAgentAvailability() {
    try {
        const response = await fetch('/api/vertex-agent/health');
        return response.ok;
    } catch (error) {
        console.warn('[Vertex Agent] Health check failed:', error);
        return false;
    }
}

// 匯出給其他模組使用
window.callVertexAgent = callVertexAgent;
window.uploadToCloudStorage = uploadToCloudStorage;
window.checkVertexAgentAvailability = checkVertexAgentAvailability;
