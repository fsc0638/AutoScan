# AutoScan System Instruction Configuration

## 概述

系統指令（System Instruction）現在已從代碼中提取到獨立的文本文件中，方便管理和修改。

## 文件位置

```
AutoScan/
├── system-instruction.txt   ← AI 角色提示詞配置文件
├── ai-api.js                ← 讀取並使用系統指令
└── app.js                   ← 調用系統指令
```

## 文件說明

### `system-instruction.txt`

這是 AI 模型的核心指令文件，定義了：
- AI 的角色和任務
- 輸出格式要求
- 數據結構規範
- 語言翻譯規則

**重要說明**：
- 文件使用 `{targetLanguage}` 作為佔位符，會在運行時動態替換為實際的目標語言
- 修改此文件後，刷新瀏覽器即可生效，無需重新編譯

## 如何修改系統指令

1. 打開 `system-instruction.txt`
2. 編輯內容（保持 `{targetLanguage}` 佔位符不變）
3. 保存文件
4. 刷新瀏覽器（Ctrl + F5 強制刷新）

## 工作原理

1. **載入時機**：首次調用 AI 時載入系統指令
2. **緩存機制**：載入後會緩存在記憶體中，避免重複讀取
3. **動態替換**：使用前會將 `{targetLanguage}` 替換為用戶選擇的語言
4. **容錯機制**：如果文件載入失敗，會使用內建的備用指令

## 技術實現

###ai-api.js
```javascript
// 載入系統指令
async function loadSystemInstruction() {
    const response = await fetch('system-instruction.txt');
    return await response.text();
}

// 使用系統指令
async function getSystemInstruction(targetLanguage) {
    const template = await loadSystemInstruction();
    return template.replace(/{targetLanguage}/g, targetLanguage);
}
```

## 優點

✅ **易於維護**：不用修改代碼就能調整 AI 行為  
✅ **版本控制**：提示詞可以進行版本管理  
✅ **多語言支持**：透過佔位符支持動態語言切換  
✅ **提高可讀性**：長篇指令不再混在代碼中  
✅ **團隊協作**：非技術人員也能調整 AI 行為

## 注意事項

⚠️ **文件必須存在**：確保 `system-instruction.txt` 在項目根目錄  
⚠️ **編碼格式**：使用 UTF-8 編碼保存文件  
⚠️ **佔位符格式**：使用 `{targetLanguage}` 而不是 `${targetLanguage}`  
⚠️ **測試修改**：修改後務必測試 AI 輸出是否符合預期
