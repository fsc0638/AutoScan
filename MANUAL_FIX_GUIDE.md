# 🔧 緊急修復：手動添加 format-converter.js 到 index.html

## 問題確認 ✅

您的 AI **已經輸出高品質關鍵字**：
- `["天澤", "會議問卷", "合作流程"]`
- `["東京大學", "專家", "Comtis", "金融服務"]`

但圖表顯示垃圾詞彙：`["覺得", "然後", "沒有"]`

**原因**：`format-converter.js` 沒有被載入到 `index.html` 中！

---

## 手動修復步驟

### 步驟 1：編輯 index.html

打開 `index.html`，找到第 156 行附近：

```html
<!-- Keep legacy modules for compatibility -->
<script src="vertex-agent-api.js"></script>
<script src="ai-api.js"></script>

<script src="charts.js"></script>
<script src="app.js"></script>
```

**修改為**：

```html
<!-- Keep legacy modules for compatibility -->
<script src="vertex-agent-api.js"></script>
<script src="ai-api.js"></script>

<!-- Format converter for AI output -->
<script src="format-converter.js"></script>

<script src="charts.js"></script>
<script src="app.js"></script>
```

### 步驟 2：編輯 app.js

打開 `app.js`，找到第 255-262 行：

```javascript
keyPoints = window.parseStructuredOutput(result.text);
console.log('[App] Parsed keyPoints:', keyPoints);

// Validate keyPoints structure
if (!Array.isArray(keyPoints)) {
  console.warn('[App] parseStructuredOutput did not return array, falling back to parseKeyPoints');
  keyPoints = null;
}
```

**在第 257 行後插入**：

```javascript
keyPoints = window.parseStructuredOutput(result.text);
console.log('[App] Parsed keyPoints:', keyPoints);

// 🔧 Convert format if needed
if (typeof window.convertToPropertiesFormat === 'function') {
  keyPoints = window.convertToPropertiesFormat(keyPoints);
  console.log('[App] After format conversion:', keyPoints);
}

// Validate keyPoints structure
if (!Array.isArray(keyPoints)) {
  console.warn('[App] parseStructuredOutput did not return array, falling back to parseKeyPoints');
  keyPoints = null;
}
```

---

## 驗證

修改後，**刷新瀏覽器 (Ctrl + Shift + R)**，Console 應該顯示：

```
✅ Format Converter loaded
[Format Converter] ✅ Direct format detected - converting to properties wrapper
[Format Converter] ✅ Converted 38 items to properties format
[Charts] Using 150 keywords from AI analysis
```

圖表應該顯示高品質關鍵字：
- ✅ "天澤"、"會議問卷"、"合作流程"
- ❌ 不再是 "覺得"、"然後"、"沒有"

---

## 如需幫助

如果手動修改有困難，請截圖您看到的程式碼，我會提供更詳細的指示！
