# 系統指令載入除錯指南

## 問題現象
- 關鍵字仍然是「然後」、「比較」等垃圾詞彙
- 日文翻譯失效
- 系統指令似乎沒有被正確使用

## 檢查步驟

### 1. 打開瀏覽器開發者工具
**按 F12** 或 **右鍵 → 檢查**

### 2. 查看 Console 日誌
搜尋以下關鍵訊息：

✅ **應該看到的訊息**：
```
✅ System instruction loaded from file
[App] Using AutoScan system instruction for gemini - gemini-2.0-flash-exp
```

❌ **如果看到錯誤**：
```
❌ Failed to load system instruction file: 404
```
→ 表示 `system-instruction.txt` 沒有被找到

### 3. 強制清除緩存（重要！）

#### 方法 1: 硬刷新（推薦）
```
Windows: Ctrl + Shift + R
或: Ctrl + F5
```

#### 方法 2: 清除所有緩存
1. 按 **Ctrl + Shift + Delete**
2. 選擇「快取的圖片和檔案」
3. 時間範圍選「所有時間」
4. 點擊「清除資料」
5. 重新啟動瀏覽器

#### 方法 3: 停用緩存（開發時使用）
1. F12 開啟開發者工具
2. 切換到 **Network** 標籤
3. 勾選「**Disable cache**」
4. 保持開發者工具打開
5. 刷新頁面

### 4. 驗證檔案載入

#### 檢查 Network 標籤：
1. F12 → **Network** 標籤
2. 重新刷新頁面
3. 搜尋「system-instruction.txt」
4. 查看狀態碼：
   - ✅ **200 OK** = 成功載入
   - ❌ **404 Not Found** = 檔案不存在
   - ❌ **304 Not Modified** = 使用舊緩存

#### 如果是 304，強制重新載入：
```
清除緩存 + Ctrl + Shift + R
```

### 5. 手動驗證檔案內容

在瀏覽器地址欄輸入：
```
http://localhost:3000/system-instruction.txt
```

應該能看到完整的系統指令內容，包含：
- ⚠️ CRITICAL: Language Translation is MANDATORY
- 關鍵字提取規則
- 禁止詞彙清單

### 6. 測試系統指令是否生效

#### 預期結果（日文）：
```json
{
  "歸屬分類": "技術開発",
  "專案": "AutoScan 最適化",
  "ToDo": "ユーザーインターフェース...",
  "關鍵字": ["製品開発", "ユーザー体験", "インターフェース設計"]
}
```

#### 實際結果（如果失敗）：
```json
{
  "歸屬分類": "技術開發",  // ← 沒翻譯成日文
  "關鍵字": ["然後", "比較", "出來"]  // ← 垃圾詞彙
}
```

## 常見問題

### Q: 為什麼關鍵字一直是垃圾詞彙？
**A**: 有兩個可能：
1. **系統指令沒被載入** → 檢查 Console 和 Network
2. **charts.js 使用本地提取** → AI 沒有輸出 `關鍵字` 欄位

### Q: 為什麼日文翻譯失效？
**A**: 
1. 系統指令緩存問題 → 強制清除緩存
2. AI 沒有遵守指令 → 檢查 Console 確認系統指令被傳送

### Q: 如何確認系統指令真的被 AI 使用？
**A**: 在 Console 中查找：
```javascript
// 在 llm-core.js 中添加日誌
console.log('[LLM Core] System Instruction:', systemInstruction?.substring(0, 200));
```

## 緊急修復步驟

如果以上都無效，執行以下操作：

### 1. 重啟開發服務器
```bash
# 停止 (Ctrl + C)
npm start
```

### 2. 清除瀏覽器所有數據
- 設定 → 隱私權和安全性 → 清除瀏覽資料
- 選擇「所有時間」+ 全部勾選
- 清除資料

### 3. 使用無痕模式測試
```
Ctrl + Shift + N (Chrome)
Ctrl + Shift + P (Firefox)
```

### 4. 檢查檔案路徑
確認 `system-instruction.txt` 在正確位置：
```
AutoScan/
├── index.html
├── app.js
├── llm-core.js
└── system-instruction.txt  ← 必須在根目錄
```

## 聯繫我

如果問題持續，請提供：
1. Console 中的所有日誌
2. Network 標籤中 system-instruction.txt 的狀態
3. 分析結果的 JSON 輸出範例
