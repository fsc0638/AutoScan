# LLM 模組嫁接整合指南

> **版本**: 1.0  
> **更新日期**: 2024-01-16  
> **可移植性**: ⭐⭐⭐⭐⭐ (5/5)

## 📋 目錄

1. [概述](#概述)
2. [必要檔案清單](#必要檔案清單)
3. [嫁接步驟](#嫁接步驟)
4. [注意事項](#注意事項)
5. [範例代碼](#範例代碼)
6. [常見問題](#常見問題)

---

## 概述

本 LLM 模組採用**完全模組化設計**，可以輕鬆嫁接到任何頁面或應用中。

### 核心特性

- ✅ **零硬編碼依賴** - 所有配置外部化
- ✅ **統一介面** - 支援 Gemini、OpenAI、Vertex AI Agent
- ✅ **事件驅動** - 易於整合到現有代碼
- ✅ **完整的錯誤處理** - 重試機制、超時處理
- ✅ **系統指令分離** - 易於調整 AI 行為

---

## 必要檔案清單

### 1. 核心模組 (必須)

| 檔案 | 功能 | 大小 | 必要性 |
|------|------|------|--------|
| `llm-core.js` | 統一的 LLM API 引擎 | ~11KB | 🔴 必須 |
| `llm-ui-component.js` | UI 組件 (選擇器、按鈕) | ~8KB | 🔴 必須 |
| `llm-ui-component.css` | UI 樣式 | ~6KB | 🔴 必須 |

### 2. 系統指令 (必須)

| 檔案 | 功能 | 大小 | 必要性 |
|------|------|------|--------|
| `system-instruction.txt` | AI 角色提示詞模板 | ~14KB | 🔴 必須 |

### 3. 支援模組 (必須)

| 檔案 | 功能 | 大小 | 必要性 |
|------|------|------|--------|
| `format-converter.js` | 資料格式轉換 | ~2KB | 🔴 必須 |
| `ai-api.js` | 向後兼容包裝器 | ~18KB | 🟡 建議 |

### 4. 配置檔案 (必須)

| 檔案 | 功能 | 大小 | 必要性 |
|------|------|------|--------|
| `config.json` | API 金鑰和模型配置 | ~1KB | 🔴 必須 |
| `config-manager.js` | 配置管理器 | ~3KB | 🔴 必須 |

### 5. 視覺化模組 (可選)

| 檔案 | 功能 | 大小 | 必要性 |
|------|------|------|--------|
| `charts.js` | 圖表和文字雲 | ~18KB | ⚪ 可選 |

**總大小**: ~81KB (不含可選模組)

---

## 嫁接步驟

### 步驟 1: 複製必要檔案

將以下檔案複製到新專案：

```
your-project/
├── llm-core.js
├── llm-ui-component.js
├── llm-ui-component.css
├── system-instruction.txt
├── format-converter.js
├── ai-api.js
├── config-manager.js
└── config.json  ← 需要自行配置
```

### 步驟 2: 在 HTML 中載入模組

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Your App</title>
    
    <!-- LLM UI 樣式 -->
    <link rel="stylesheet" href="llm-ui-component.css">
</head>
<body>
    <!-- LLM UI 容器 -->
    <div id="llm-ui-container"></div>
    
    <!-- 結果顯示區域 -->
    <div id="results"></div>
    
    <!-- 依序載入 JS (順序很重要!) -->
    <script src="config-manager.js"></script>
    <script src="llm-core.js"></script>
    <script src="llm-ui-component.js"></script>
    <script src="format-converter.js"></script>
    <script src="ai-api.js"></script>
    
    <!-- 你的應用邏輯 -->
    <script src="your-app.js"></script>
</body>
</html>
```

### 步驟 3: 初始化 LLM 組件

在你的 JavaScript 中：

```javascript
// 等待 DOM 載入
window.addEventListener('DOMContentLoaded', async () => {
    // 1. 初始化 LLM UI 組件
    const llmUI = new window.LLMUIComponent('llm-ui-container');
    
    // 2. 設定分析回調
    llmUI.onAnalyze = async (inputText) => {
        try {
            // 獲取用戶選擇
            const selection = llmUI.getSelection();
            // {provider: 'gemini', model: 'gemini-2.0-flash-exp', useAgent: false}
            
            // 獲取目標語言
            const targetLanguage = getTargetLanguage(); // 你的實現
            
            // 載入系統指令
            const systemInstruction = await window.getSystemInstruction(targetLanguage);
            
            // 呼叫 LLM
            const result = await window.llmCore.call(inputText, {
                provider: selection.provider,
                model: selection.model,
                targetLanguage: targetLanguage,
                systemInstruction: systemInstruction,
                useAgent: selection.useAgent
            });
            
            // 解析結果
            let keyPoints = window.parseStructuredOutput(result.text);
            keyPoints = window.convertToPropertiesFormat(keyPoints);
            
            // 顯示結果
            displayResults(keyPoints);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            showError(error.message);
        }
    };
});
```

---

## 注意事項

### 1. 配置管理器初始化 ⚠️

確保 `config-manager.js` 在使用前已載入並初始化：

```javascript
// 檢查配置是否載入
if (!window.configManager || !window.configManager.loaded) {
    console.error('Config manager not loaded');
    alert('配置未載入，請刷新頁面');
}
```

### 2. 系統指令檔案路徑 📁

`system-instruction.txt` 必須在**相對於 HTML 的正確路徑**。

如果檔案在不同目錄，需修改 `ai-api.js`:

```javascript
// 在 ai-api.js 的 loadSystemInstruction 函數中
async function loadSystemInstruction() {
    // 修改路徑
    const response = await fetch('../path/to/system-instruction.txt');
    // ...
}
```

### 3. CSS 樣式隔離 🎨

如果新頁面有自己的樣式，可能需要調整選擇器避免衝突：

```css
/* 在 llm-ui-component.css 中添加命名空間 */
.llm-ui-wrapper {
    /* 現有樣式 */
}

/* 或使用更具體的選擇器 */
#llm-ui-container .llm-ui-wrapper {
    /* 樣式 */
}
```

### 4. 配置檔案格式 🔧

`config.json` 必須包含以下結構：

```json
{
  "gemini": {
    "apiKey": "YOUR_GEMINI_API_KEY",
    "models": ["gemini-2.0-flash-exp", "gemini-1.5-pro"]
  },
  "openai": {
    "apiKey": "YOUR_OPENAI_API_KEY",
    "models": ["gpt-4o", "gpt-4o-mini"]
  },
  "vertexAI": {
    "projectId": "YOUR_PROJECT_ID",
    "location": "us-central1",
    "agents": ["agent-id-1", "agent-id-2"]
  },
  "languageVersions": ["繁體中文", "English", "日本語"]
}
```

### 5. 大型檔案處理 📄

OpenAI API 有輸入長度限制，大型檔案請使用 Gemini：

```javascript
// 檢查文字長度
const MAX_OPENAI_TOKENS = 100000; // 約 75,000 字

if (inputText.length > MAX_OPENAI_TOKENS && selection.provider === 'openai') {
    alert('檔案過大，請改用 Gemini 模型');
    return;
}
```

### 6. 真實 Agent 調用 🤖

目前 `useAgent: true` 時會調用 Vertex AI Agent，需確保：

```javascript
// 在 index.html 中載入
<script src="vertex-agent-api.js"></script>

// 並確保 vertex-agent-api.js 中實現了
window.callVertexAgent = async function(text) {
    // 真實的 Vertex AI Agent 調用
};
```

---

## 範例代碼

### 最小化嫁接範例

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="llm-ui-component.css">
</head>
<body>
    <h1>My LLM App</h1>
    
    <!-- LLM UI -->
    <div id="my-llm"></div>
    
    <!-- 結果 -->
    <pre id="result"></pre>
    
    <!-- 載入模組 -->
    <script src="config-manager.js"></script>
    <script src="llm-core.js"></script>
    <script src="llm-ui-component.js"></script>
    <script src="format-converter.js"></script>
    <script src="ai-api.js"></script>
    
    <script>
        const llmUI = new LLMUIComponent('my-llm');
        
        llmUI.onAnalyze = async (text) => {
            const selection = llmUI.getSelection();
            const result = await window.llmCore.call(text, {
                provider: selection.provider,
                model: selection.model,
                targetLanguage: 'Traditional Chinese',
                systemInstruction: await window.getSystemInstruction('繁體中文')
            });
            
            document.getElementById('result').textContent = JSON.stringify(
                window.parseStructuredOutput(result.text),
                null,
                2
            );
        };
    </script>
</body>
</html>
```

### 完整整合範例

```javascript
class MyApp {
    constructor() {
        this.llmUI = null;
        this.currentLanguage = 'Traditional Chinese';
    }
    
    async init() {
        // 初始化 LLM UI
        this.llmUI = new LLMUIComponent('llm-container');
        this.llmUI.onAnalyze = this.handleAnalysis.bind(this);
        
        // 設定語言選擇器
        document.getElementById('lang-select').addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
        });
    }
    
    async handleAnalysis(inputText) {
        // 顯示載入中
        this.showLoading(true);
        
        try {
            // 獲取選擇
            const selection = this.llmUI.getSelection();
            
            // 檢查檔案大小
            if (this.shouldUseGemini(inputText, selection)) {
                this.showWarning('檔案過大，建議使用 Gemini');
                return;
            }
            
            // 載入系統指令
            const systemInstruction = await window.getSystemInstruction(
                this.currentLanguage
            );
            
            // 呼叫 LLM
            const result = await window.llmCore.call(inputText, {
                provider: selection.provider,
                model: selection.model,
                targetLanguage: this.currentLanguage,
                systemInstruction: systemInstruction,
                useAgent: selection.useAgent
            });
            
            // 解析和轉換
            let keyPoints = window.parseStructuredOutput(result.text);
            keyPoints = window.convertToPropertiesFormat(keyPoints);
            
            // 顯示結果
            this.displayResults(keyPoints);
            
        } catch (error) {
            this.showError(`分析失敗: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    shouldUseGemini(text, selection) {
        return text.length > 100000 && selection.provider === 'openai';
    }
    
    displayResults(data) {
        // 你的結果顯示邏輯
        console.log('Results:', data);
    }
    
    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }
    
    showError(message) {
        alert(message);
    }
    
    showWarning(message) {
        console.warn(message);
    }
}

// 初始化應用
const app = new MyApp();
window.addEventListener('DOMContentLoaded', () => app.init());
```

---

## 常見問題

### Q1: 為什麼我的 API 呼叫失敗？

**A**: 檢查以下項目：
1. `config.json` 中的 API 金鑰是否正確
2. 網路連線是否正常
3. API 額度是否用盡
4. Console 中的詳細錯誤訊息

### Q2: 如何自訂系統指令？

**A**: 直接編輯 `system-instruction.txt`，修改後刷新瀏覽器即可生效。

### Q3: 可以同時使用多個 LLM UI 組件嗎？

**A**: 可以！只需創建多個實例：

```javascript
const llm1 = new LLMUIComponent('container-1');
const llm2 = new LLMUIComponent('container-2');
```

### Q4: 如何處理 CORS 錯誤？

**A**: 
- 開發時使用 `npm start` 啟動本地伺服器（已配置代理）
- 生產環境需設定後端代理

### Q5: 翻譯失效怎麼辦？

**A**: 
1. 檢查 `system-instruction.txt` 是否正確載入
2. 清除瀏覽器緩存 (Ctrl + Shift + Delete)
3. 確認 `targetLanguage` 參數正確傳遞
4. 查看 Console 中的系統指令日誌

### Q6: 如何添加新的語言模型？

**A**: 
1. 在 `config.json` 中添加模型 ID
2. 刷新頁面，模型會自動出現在選單中

### Q7: 格式轉換器是做什麼的？

**A**: 將 AI 的直接輸出格式 `{歸屬分類: "..."}` 轉換為 charts.js 需要的 `{properties: {歸屬分類: "..."}}` 格式。

---

## 架構圖

```
┌─────────────────────────────────────────┐
│  HTML Page (你的應用)                    │
│  ├── <div id="llm-ui-container">        │
│  └── <div id="results">                 │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  llm-ui-component.js                    │
│  - 渲染 UI                               │
│  - 處理用戶交互                          │
│  - 觸發 onAnalyze 事件                   │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  你的應用邏輯                            │
│  - 獲取 selection                        │
│  - 載入 systemInstruction               │
│  - 呼叫 llmCore.call()                  │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  llm-core.js                            │
│  - 統一的 API 呼叫                       │
│  - 重試機制                              │
│  - 超時處理                              │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  API (Gemini / OpenAI / Vertex AI)     │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  parseStructuredOutput (ai-api.js)      │
│  - 解析 JSON                             │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  convertToPropertiesFormat              │
│  - 格式轉換                              │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  你的結果處理                            │
│  - 顯示數據                              │
│  - 圖表渲染                              │
└─────────────────────────────────────────┘
```

---

## 版本歷史

### v1.0 (2024-01-16)
- ✅ 初始版本
- ✅ 支援 Gemini、OpenAI、Vertex AI Agent
- ✅ 完整的翻譯支援
- ✅ 高品質關鍵字提取
- ✅ 格式自動轉換

---

## 授權

內部使用，請勿外傳。

---

## 聯繫方式

如有問題，請聯繫開發團隊。
