/**
 * Skills Processor
 * 
 * Executes the 4-phase Agent Skills processing pipeline:
 * Phase 1: Sanitizer - Clean text
 * Phase 2: Org Specialist - Identify people and departments
 * Phase 3: Schema Mapper - Map to Notion format
 * Phase 4: QA Inspector - Validate and clean
 */

class SkillsProcessor {
    constructor(skillsLoader, llmCore) {
        this.loader = skillsLoader;
        this.llm = llmCore;
        this.debug = true; // Enable detailed logging
    }

    /**
     * Main processing pipeline
     */
    async process(inputText, options) {
        console.log('[SkillsProcessor] 🚀 Starting 4-phase processing pipeline...');
        console.log('[SkillsProcessor] Input length:', inputText.length, 'chars');
        console.log('[SkillsProcessor] Options:', options);

        try {
            // PHASE 1: Sanitizer - Clean the text
            console.log('\n[SkillsProcessor] === PHASE 1: Sanitizer ===');
            const cleanedText = await this.runPhase1(inputText, options);

            // PHASE 2: Org Specialist - Identify organization info
            console.log('\n[SkillsProcessor] === PHASE 2: Org Specialist ===');
            const orgData = await this.runPhase2(cleanedText, options);

            // PHASE 3: Schema Mapper - Convert to Notion format
            console.log('\n[SkillsProcessor] === PHASE 3: Schema Mapper ===');
            const jsonArray = await this.runPhase3(cleanedText, orgData, options);

            // PHASE 4: QA Inspector - Validate and clean
            console.log('\n[SkillsProcessor] === PHASE 4: QA Inspector ===');
            const validatedData = await this.runPhase4(jsonArray, options);

            console.log('[SkillsProcessor] ✅ Pipeline completed successfully');
            console.log('[SkillsProcessor] Output items:', validatedData.length);

            return {
                success: true,
                text: JSON.stringify(validatedData, null, 2),
                data: validatedData,
                phases: {
                    phase1_cleaned: cleanedText,
                    phase2_org: orgData,
                    phase3_json: jsonArray,
                    phase4_validated: validatedData
                }
            };

        } catch (error) {
            console.error('[SkillsProcessor] ❌ Pipeline failed:', error);
            throw error;
        }
    }

    /**
     * PHASE 1: Sanitizer
     * Input: Raw transcript text
     * Output: Cleaned, well-structured text
     */
    async runPhase1(inputText, options) {
        const prompt = this.buildPhase1Prompt(inputText);

        if (this.debug) {
            console.log('[Phase 1] Prompt length:', prompt.length);
        }

        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        const cleanedText = result.text.trim();

        if (this.debug) {
            console.log('[Phase 1] Output length:', cleanedText.length);
            console.log('[Phase 1] Preview:', cleanedText.substring(0, 100) + '...');
        }

        return cleanedText;
    }

    /**
     * Build Phase 1 Prompt
     */
    buildPhase1Prompt(inputText) {
        return `你是一位專門的「文本清洗專家」，負責將非結構化的口語資料轉化為乾淨、語意完整的書面文本。

【核心任務】
1. 強制去噪 (De-noise): 刪除「然後、那個、比較、就是、出來、這樣子、對對對、嗯、啊、呢」等語助詞。
2. 語意重組 (Rephrase): 將破碎句子合併為完整的書面語，補齊主詞、謂語、受詞。
3. 保持繁體中文。

【輸入文本】
${inputText}

【輸出要求】
直接輸出清洗後的文本，不要說明、註解或 Markdown 標記。`;
    }

    /**
     * PHASE 2: Org Specialist
     * Input: Cleaned text
     * Output: Organization data (JSON)
     */
    async runPhase2(cleanedText, options) {
        const selectedDept = options?.selectedDepartment;

        if (this.debug) {
            console.log('[Phase 2] Selected Dept from options:', selectedDept);
        }

        const prompt = this.buildPhase2Prompt(cleanedText, selectedDept);
        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        let orgData;
        try {
            let jsonText = result.text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
            orgData = JSON.parse(jsonText);

            // FORCE OVERRIDE with user selection if available
            const subDept = selectedDept?.subDepartment;
            if (subDept && subDept.code) {
                orgData.責任部門 = subDept.name;
                orgData.責任部門代碼 = subDept.code;
                console.log('[Phase 2] ✅ FORCE OVERRIDE with selection:', subDept.code, subDept.name);
            }

            if (this.debug) {
                console.log('[Phase 2] Final Dept Group Code:', orgData.責任部門代碼);
            }
        } catch (parseError) {
            console.warn('[Phase 2] Parse failed, fallback to defaults');
            const subDept = selectedDept?.subDepartment;
            orgData = {
                識別人員: [],
                負責人: ['待指派'],
                執行人: [],
                責任部門: subDept?.name || '凱位',
                責任部門代碼: subDept?.code || 'KWAY'
            };
        }

        return orgData;
    }

    /**
     * Build Phase 2 Prompt
     */
    buildPhase2Prompt(cleanedText, selectedDept) {
        const userHint = selectedDept?.subDepartment ?
            `\n⚠️ 用戶已在 UI 選擇部門：${selectedDept.subDepartment.name} (代號: ${selectedDept.subDepartment.code})，請以此為優先參考。` : '';

        return `你是一位專門的「組織識別專家」，負責識別文本中的人名和部門資訊。${userHint}

【參考部門清單】
- Y200 研發中心-開發處
- T201 (一)產品開發一處開發一組
- T202 (一)產品開發一處開發二組
- T203 (一)產品開發一處開發三組
- T255 (二)產品開發處開發二組
- C140 公關暨專案室
- C130 資訊處

【核心任務】
1. 識別負責人(管理/決策)與執行人(實際操作)。
2. 將識別到的部門對應到代號（如 T255, T201 等）。

【輸入文本】
${cleanedText}

【輸出格式 (JSON)】
{
  "識別人員": [],
  "負責人": ["人名" 或 "待指派"],
  "執行人": ["人名/職稱"],
  "責任部門": "名稱",
  "責任部門代碼": "4碼(如T255)或KWAY"
}`;
    }

    /**
     * PHASE 3: Schema Mapper
     * Input: Cleaned text + Org data
     * Output: Notion-format JSON array
     */
    async runPhase3(cleanedText, orgData, options) {
        // DOUBLE CHECK: Ensure user selection is prioritized even if AI failed Phase 2
        const selectedDept = options?.selectedDepartment;
        if (selectedDept && selectedDept.subDepartment && selectedDept.subDepartment.code) {
            orgData.責任部門代碼 = selectedDept.subDepartment.code;
            orgData.責任部門 = selectedDept.subDepartment.name;
            console.log('[Phase 3] ✅ Ensuring selection is used:', orgData.責任部門代碼);
        }

        const prompt = this.buildPhase3Prompt(cleanedText, orgData);

        if (this.debug) {
            console.log('[Phase 3] Generating items for dept:', orgData.責任部門代碼);
        }

        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        let jsonArray;
        try {
            let jsonText = result.text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
            jsonArray = JSON.parse(jsonText);
            if (!Array.isArray(jsonArray)) jsonArray = [jsonArray];

            if (this.debug) {
                console.log('[Phase 3] Extracted items:', jsonArray.length);
            }
        } catch (e) {
            console.error('[Phase 3] JSON parse error:', e.message);
            throw e;
        }

        return jsonArray;
    }

    /**
     * Build Phase 3 Prompt
     */
    buildPhase3Prompt(cleanedText, orgData) {
        const deptCode = orgData?.責任部門代碼 || 'KWAY';
        const deptName = orgData?.責任部門 || '凱位';
        const owner = orgData?.負責人?.join(', ') || '待指派';

        return `你是「資料庫專家」，負責將文本轉為 Notion JSON Array。

【關鍵變數】
- **部門前綴: ${deptCode}** (重要：必須用於「專案」欄位)
- 負責人: ${owner}
- 部門名稱: ${deptName}

【欄位規則】
1. ToDo: 20-50 字，書面語。
2. 專案: 必須為「${deptCode} 專案核心名稱」。
3. 負責人: ["${owner}"]
4. 責任部門: ["${deptName}"]
5. 來源: 從 [商業模式, 外部合作, 法律法規, 會議記錄, 董事會顧問會議, 董事長交辦, KWAY研發中心] 擇一。
6. 狀態: 未開始/進行中/完成 (預設使用 未開始)
7. 關鍵詞: 3-5個有意義的名詞。**絕對嚴格禁用垃圾詞：然後、比較、覺得、沒有、時候、內容、問題、東西、大家。**
8. 建立時間: "${new Date().toISOString().split('T')[0]}"

【輸入文本】
${cleanedText}

【輸出格式】
純 JSON Array，不要 Markdown。提取 15-20 個獨立行動。`;
    }

    /**
     * PHASE 4: QA Inspector
     * Input: JSON array
     * Output: Validated and cleaned JSON array
     */
    async runPhase4(jsonArray, options) {
        const jsonString = JSON.stringify(jsonArray, null, 2);
        const prompt = this.buildPhase4Prompt(jsonString);

        if (this.debug) {
            console.log('[Phase 4] Starting final QA cleaning...');
        }

        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        let validatedData;
        try {
            let jsonText = result.text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
            validatedData = JSON.parse(jsonText);
            if (!Array.isArray(validatedData)) validatedData = [validatedData];

            if (this.debug) {
                console.log('[Phase 4] Final items count:', validatedData.length);
                console.log('[Phase 4] Cleanup completed.');
            }
        } catch (e) {
            console.warn('[Phase 4] Final parse failed, using Phase 3 output.');
            validatedData = jsonArray;
        }

        return validatedData;
    }

    /**
     * Build Phase 4 Prompt
     */
    buildPhase4Prompt(jsonData) {
        return `你是「品質守門員」，負責最終檢查並嚴格過濾垃圾資訊。

【極度重要：清除垃圾關鍵詞】
檢查所有「關鍵詞(Multi-select)」欄位，若包含以下詞彙，必須立即刪除並替換為有意義的專業術語：
❌ 的、了、是、在、有、和、與、也、都、就、後
❌ 然後、那個、比較、覺得、沒有、時候、問題、事情、大家、東西、內容、活動、物流
❌ 確認、同意、知道、建議、希望、感覺、目前、未來、之前、後來

【檢查規則】
1. 確保關鍵詞欄位中「只保留具體名詞」（如：量子、金融、技術、合約、簽署、人才、人才培育）。
2. ToDo 若太短或包含口語詞，請修訂為專業書面語（20-50字）。
3. 確保 JSON 格式完美。

【輸入資料】
${jsonData}

【輸出要求】
純 JSON Array，不要 Markdown。`;
    }
}

// Module exports
if (typeof module !== 'undefined' && module.exports) module.exports = SkillsProcessor;
if (typeof window !== 'undefined') window.SkillsProcessor = SkillsProcessor;
