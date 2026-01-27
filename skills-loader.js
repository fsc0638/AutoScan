/**
 * Skills Loader
 * 
 * Reads and manages the 4 Agent Skills from .agent/skills/
 * Converts SKILL.md content into AI prompts for each processing phase
 */

const fs = require('fs');
const path = require('path');

class SkillsLoader {
  constructor() {
    this.skills = {
      cleaner: null,
      orgParser: null,
      notionMapper: null,
      qaInspector: null
    };
    
    this.deptList = null;
    this.notionSchema = null;
  }

  /**
   * Load all skill files
   */
  async loadAll() {
    console.log('[SkillsLoader] Loading all skills...');
    
    try {
      // Load 4 SKILL.md files
      this.skills.cleaner = this.loadSkill('cleaner');
      this.skills.orgParser = this.loadSkill('org-parser');
      this.skills.notionMapper = this.loadSkill('notion-mapper');
      this.skills.qaInspector = this.loadSkill('qa-inspector');
      
      // Load reference files
      this.deptList = this.loadDepartmentList();
      this.notionSchema = this.loadNotionSchema();
      
      console.log('[SkillsLoader] ✅ All skills loaded successfully');
      return true;
    } catch (error) {
      console.error('[SkillsLoader] ❌ Failed to load skills:', error);
      throw error;
    }
  }

  /**
   * Load a single SKILL.md file
   */
  loadSkill(skillName) {
    const skillPath = path.join(__dirname, '.agent', 'skills', skillName, 'SKILL.md');
    
    if (!fs.existsSync(skillPath)) {
      throw new Error(`Skill file not found: ${skillPath}`);
    }
    
    const content = fs.readFileSync(skillPath, 'utf-8');
    console.log(`[SkillsLoader] Loaded ${skillName}: ${content.length} bytes`);
    return content;
  }

  /**
   * Load Department List reference file
   */
  loadDepartmentList() {
    const deptPath = path.join(__dirname, 'Department List of Kway.txt');
    
    if (!fs.existsSync(deptPath)) {
      console.warn('[SkillsLoader] ⚠️ Department List not found, using empty');
      return '';
    }
    
    return fs.readFileSync(deptPath, 'utf-8');
  }

  /**
   * Load latest Notion Schema file
   */
  loadNotionSchema() {
    const schemaPattern = /^Notion_schema_ID_.*\.txt$/;
    const files = fs.readdirSync(__dirname);
    
    // Find all schema files
    const schemaFiles = files.filter(f => schemaPattern.test(f));
    
    if (schemaFiles.length === 0) {
      console.warn('[SkillsLoader] ⚠️ No Notion Schema found, using empty');
      return '';
    }
    
    // Sort by filename (timestamp) and get the latest
    schemaFiles.sort().reverse();
    const latestSchema = schemaFiles[0];
    const schemaPath = path.join(__dirname, latestSchema);
    
    console.log(`[SkillsLoader] Using schema: ${latestSchema}`);
    return fs.readFileSync(schemaPath, 'utf-8');
  }

  /**
   * Convert SKILL.md to AI Prompt for PHASE 1: Sanitizer
   */
  buildPhase1Prompt(inputText) {
    return `你是一位專門的「文本清洗專家」，負責將非結構化的口語資料轉化為乾淨、語意完整的書面文本。

【核心任務】

1. 強制去噪 (De-noise)
必須刪除以下無意義語助詞：
- 然後、那個、比較、就是、出來、這樣子、對對對、嗯、啊、呢

2. 語意重組 (Rephrase)
將破碎的口語句子合併為「語意完整的書面語」。
每個段落必須有明確的：
- 主詞 (Subject): 誰/什麼
- 謂語 (Predicate): 做什麼
- 受詞 (Object): 對象是什麼

3. 語言翻譯
保持繁體中文。

【輸入文本】
${inputText}

【輸出要求】
請直接輸出清洗後的文本，不要有任何說明、註解或 Markdown 標記。`;
  }

  /**
   * Convert SKILL.md to AI Prompt for PHASE 2: Org Specialist
   */
  buildPhase2Prompt(cleanedText) {
    return `你是一位專門的「組織實體識別專家」，負責將文本中提到的人名、部門名稱精確對應到公司的組織架構代碼。

【核心任務】

1. 人員識別
掃描文本中的人名，識別其部門歸屬。

2. 部門代碼映射
將口語部門名稱轉換為標準代碼。

3. 職責區分
區分兩種角色：
- 負責人 (Owner): 管理、監督或決策者
- 執行人 (Executor): 實際操作、執行人員

【參考資料：組織架構】
${this.deptList}

【輸入文本】
${cleanedText}

【輸出要求】
請以 JSON 格式輸出，不要有 Markdown 標記：
{
  "識別人員": [
    {
      "姓名": "范書愷",
      "部門代碼": "Y200",
      "部門名稱": "研發中心-開發處",
      "角色": "執行人"
    }
  ],
  "負責人": ["范書愷"],
  "執行人": ["開發一組"],
  "責任部門": "研發中心-開發處",
  "責任部門代碼": "Y200"
}`;
  }

  /**
   * Convert SKILL.md to AI Prompt for PHASE 3: Schema Mapper
   */
  buildPhase3Prompt(cleanedText, orgData) {
    const deptCode = orgData?.責任部門代碼 || 'KWAY';
    const owner = orgData?.負責人?.join(', ') || '待指派';
    const executor = orgData?.執行人?.join(', ') || '';
    const deptName = orgData?.責任部門 || '';

    return `你是一位專門的「資料庫架構專家」，負責將結構化資訊精確對應到 Notion 資料庫欄位。

【Notion Schema】
${this.notionSchema}

【已識別的組織資訊】
- 責任部門代碼: ${deptCode}
- 責任部門名稱: ${deptName}
- 負責人: ${owner}
- 執行人: ${executor}

【欄位提取規則】

1. ToDo (Title): 20-50 字元，語意完整的書面語

2. 專案 (Multi-select): 格式為 [${deptCode}] 專案名稱
   例如：${deptCode} AI裝置研發

3. 負責人 (Multi-select): ${owner}

4. 執行人 (Multi-select): ${executor}

5. 責任部門 (Multi-select): ${deptName}

6. 來源 (Multi-select): 必須從以下 7 個選項選擇
   - 商業模式、外部合作、法律法規、會議記錄、董事會顧問會議、董事長交辦、KWAY研發中心
   - 若無法判斷，使用「會議記錄」

7. 狀態 (Status): 未開始、進行中、完成

8. 到期日 (Date): YYYY-MM-DD 格式，若無則 null

9. 工時 (Number): 1-40 小時

10. 階段里程碑 (Multi-select): 關鍵節點

11. 關鍵詞 (Multi-select): 3-5 個專業術語
    嚴格禁止：然後、那個、比較、就是、出來、時候、沒有、問題、事情、大家

12. 建立時間 (Created Time): ${new Date().toISOString().split('T')[0]}

【輸入文本】
${cleanedText}

【輸出要求】
輸出純 JSON Array，不要有任何 Markdown 標記（如 \`\`\`json）。
目標提取 15-20 個項目。
每個 JSON 物件只能代表一個獨立動作。`;
  }

  /**
   * Convert SKILL.md to AI Prompt for PHASE 4: QA Inspector
   */
  buildPhase4Prompt(jsonData) {
    return `你是一位專門的「品質守門員」，負責在資料進入 Notion 系統前進行最終檢查。

【核心任務】

1. 格式清洗
- 移除任何 Markdown 標記（\`\`\`json, \`\`\`）
- 確保 JSON 開頭為 [ 或 {
- 確保 JSON 結尾為 ] 或 }

2. 關鍵字覆核
再次掃描 ToDo 與 關鍵詞 欄位，確保不包含垃圾詞彙：
- 然後、那個、比較、就是、出來、這樣子、對對對
- 時候、時間、未來、沒有、問題、事情、大家

3. 必要欄位檢查
- ToDo: 長度 20-50 字元
- 建立時間: 今日日期
- 狀態: 必須為 [未開始, 進行中, 完成]
- 來源: 必須從允許清單選擇
- 關鍵詞: 必須有 3-5 個值

【輸入資料】
${jsonData}

【輸出要求】
輸出清理和驗證後的純 JSON Array，不要有任何說明或 Markdown 標記。
若發現錯誤，請自動修正。`;
  }
}

module.exports = SkillsLoader;
