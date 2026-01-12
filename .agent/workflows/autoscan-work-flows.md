---
description: 會議摘要自動化
---

1. Start (啟動節點)
這是你輸入逐字稿的地方。
設定一個變數，名稱叫 transcript (類型：String)。

2. LLM Node (AI 邏輯節點 - 這是我的大腦)
選擇模型：如果用戶點選語言模型為[Gemini]則選擇 gemini-1.5-pro；如果用戶點選語言模型為[OPEN AI]則選擇 gpt-4o。
System Prompt (系統提示詞)：

你是一位專精於 Notion 的助理。解析使用者的輸入，並輸出為純 JSON 格式。
JSON 格式規範：
[
  {
    "歸屬分類": ["填入分類"],
    "專案": ["填入專案名稱"],
    "ToDo": "具體事項",
    "狀態": "未開始",
    "負責人": "姓名",
    "到期日": "YYYY-MM-DD"
  }
]
約束：僅輸出 JSON，不准有其他文字。
User Input (用戶輸入)：設定為 {{transcript}} (來自上一個節點)。

3. Notion Action Node (執行節點)
授權：點擊連接你的 Notion 帳號，並選取「范書愷さんのスペースHQ」工作區。
選擇資料庫：2e62059200d88010830efb67104f032e
欄位對齊 (Mapping)：
ToDo 欄位 ← 選擇來自 LLM 節點的 ToDo
歸屬分類 欄位 ← 選擇來自 LLM 節點的 歸屬分類
到期日 欄位 ← 選擇來自 LLM 節點的 到期日
(以此類推)