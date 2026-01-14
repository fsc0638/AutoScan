---
description: 完整且保守的 Git 分支管理工作流程
---

# Git 分支管理工作流程

此工作流程提供完整且保守的步驟，用於日常 Git 分支管理，包括合併到 main 分支和創建新功能分支。

---

## 情境一：完成工作，合併到 main 分支

### 前置檢查

**步驟 1: 確認當前分支和狀態**
```bash
git status
git branch
```
- 確認您在正確的分支（例如：`autoscan-development`）
- 檢查是否有未提交的變更

**步驟 2: 提交所有未完成的變更**
```bash
# 如果有未提交的變更
git add .
git status  # 再次確認要提交的文件
git commit -m "描述您的變更"
```

**步驟 3: 推送當前分支到遠程**
```bash
git push origin autoscan-development
```
- 確保遠程倉庫有最新的工作進度

### 安全合併流程

**步驟 4: 切換到 main 分支**
```bash
git checkout main
```

**步驟 5: 更新 main 分支（重要！）**
```bash
git pull origin main
```
- 確保本地 main 分支與遠程同步
- 避免合併衝突

**步驟 6: 合併開發分支**
```bash
git merge autoscan-development --no-ff
```
- `--no-ff` 參數會創建一個合併提交，保留分支歷史
- 這是更保守和清晰的做法

**步驟 7: 處理可能的衝突（如果有）**
如果出現衝突：
```bash
# 查看衝突文件
git status

# 手動編輯衝突文件，解決標記
# 然後添加解決後的文件
git add <衝突文件>

# 完成合併
git commit
```

**步驟 8: 驗證合併結果**
```bash
# 查看最近的提交歷史
git log --oneline -5

# 確認所有預期的變更都在
git diff origin/main
```

**步驟 9: 推送到遠程 main 分支**
```bash
git push origin main
```

**步驟 10: 返回開發分支繼續工作**
```bash
git checkout autoscan-development

# 同步 main 的變更到開發分支
git merge main
git push origin autoscan-development
```

---

## 情境二：創建新功能分支

### 前置檢查

**步驟 1: 提交當前工作**
```bash
# 確認當前狀態
git status

# 提交所有變更
git add .
git commit -m "完成 [當前功能描述]"
git push origin autoscan-development
```

**步驟 2: 決定從哪個分支建立新分支**

**選項 A: 從 main 分支建立（推薦用於新功能）**
```bash
# 切換到 main 並確保最新
git checkout main
git pull origin main

# 創建並切換到新分支
git checkout -b feature/新功能名稱
```

**選項 B: 從當前開發分支建立（用於相關功能）**
```bash
# 確保當前分支最新
git pull origin autoscan-development

# 創建並切換到新分支
git checkout -b feature/新功能名稱
```

### 分支命名規範

建議使用以下前綴：
- `feature/` - 新功能（例如：`feature/notion-integration`）
- `bugfix/` - 錯誤修復（例如：`bugfix/api-timeout`）
- `hotfix/` - 緊急修復（例如：`hotfix/security-patch`）
- `refactor/` - 重構（例如：`refactor/code-cleanup`）

**步驟 3: 推送新分支到遠程**
```bash
git push -u origin feature/新功能名稱
```

**步驟 4: 開始在新分支上工作**
現在您可以在新分支上進行開發，完全獨立於其他分支。

---

## 情境三：保守的合併檢查清單

在合併到 main 之前，建議完成以下檢查：

### ✅ 合併前檢查清單

- [ ] 所有測試都通過
- [ ] 代碼已經過審查（如果是團隊項目）
- [ ] 沒有 console.log 或調試代碼
- [ ] 敏感資訊（API 密鑰等）沒有被提交
- [ ] README 或文檔已更新（如有需要）
- [ ] 提交訊息清晰明確
- [ ] 已在開發分支上測試功能
- [ ] main 分支已更新到最新狀態

---

## 緊急回退流程

如果合併後發現問題：

**回退到合併前的狀態**
```bash
# 查看提交歷史
git log --oneline

# 回退到合併前的提交（假設是 abc1234）
git reset --hard abc1234

# 強制推送（謹慎使用！）
git push origin main --force
```

> ⚠️ **警告**: `--force` 會覆蓋遠程歷史，僅在緊急情況下使用！

**更安全的方式：創建回退提交**
```bash
# 創建一個新的提交來撤銷變更
git revert HEAD

# 推送回退提交
git push origin main
```

---

## 日常最佳實踐

1. **頻繁提交**: 小步提交，清晰的提交訊息
2. **定期推送**: 每天結束前推送到遠程
3. **保持同步**: 定期從 main 拉取更新
4. **分支隔離**: 每個功能使用獨立分支
5. **測試後合併**: 確保功能完整測試後才合併到 main
6. **備份重要**: 重要變更前先推送到遠程

---

## 快速參考命令

```bash
# 查看當前狀態
git status
git branch

# 切換分支
git checkout <分支名稱>

# 創建並切換到新分支
git checkout -b <新分支名稱>

# 提交變更
git add .
git commit -m "訊息"
git push origin <分支名稱>

# 合併分支
git checkout main
git pull origin main
git merge <分支名稱> --no-ff
git push origin main

# 刪除本地分支
git branch -d <分支名稱>

# 刪除遠程分支
git push origin --delete <分支名稱>
```

---

*建立日期: 2026-01-12*
