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
     * Helper: Extract JSON from text that might contain conversational filler or markdown
     */
    extractJSON(text) {
        if (!text) return null;
        let cleaned = text.trim();

        // 1. Try direct parse
        try {
            return JSON.parse(cleaned);
        } catch (e) { }

        // 2. Remove common Markdown markers
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch (e) { }

        // 3. Brute force search for JSON structure
        const startIdx = Math.min(
            cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'),
            cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('[')
        );
        const endIdx = Math.max(
            cleaned.lastIndexOf('}'),
            cleaned.lastIndexOf(']')
        );

        if (startIdx !== Infinity && endIdx !== -1 && endIdx > startIdx) {
            try {
                return JSON.parse(cleaned.substring(startIdx, endIdx + 1));
            } catch (e) { }
        }

        throw new Error('無法從文本中提取有效的 JSON 結構');
    }

    /**
     * Main processing pipeline
     */
    async process(inputText, options) {
        const startTime = performance.now();
        console.log('[SkillsProcessor] 🚀 Starting 4-phase processing pipeline...');
        console.log('[SkillsProcessor] Input length:', inputText.length, 'chars');
        console.log('[SkillsProcessor] Options:', options);

        try {
            // PHASE 1: Sanitizer - Clean the text
            console.log('\n[SkillsProcessor] === PHASE 1: Sanitizer ===');
            const p1Start = performance.now();
            const cleanedText = await this.runPhase1(inputText, options);
            console.log(`[SkillsProcessor] Phase 1 completed in ${(performance.now() - p1Start).toFixed(2)}ms`);

            // PHASE 2: Org Specialist - Identify organization info
            console.log('\n[SkillsProcessor] === PHASE 2: Org Specialist ===');
            const p2Start = performance.now();
            const orgData = await this.runPhase2(cleanedText, options);
            console.log(`[SkillsProcessor] Phase 2 completed in ${(performance.now() - p2Start).toFixed(2)}ms`);

            // PHASE 3: Schema Mapper - Convert to Notion format
            console.log('\n[SkillsProcessor] === PHASE 3: Schema Mapper ===');
            const p3Start = performance.now();
            const jsonArray = await this.runPhase3(cleanedText, orgData, options);
            console.log(`[SkillsProcessor] Phase 3 completed in ${(performance.now() - p3Start).toFixed(2)}ms`);

            // PHASE 4: QA Inspector - Validate and clean
            console.log('\n[SkillsProcessor] === PHASE 4: QA Inspector ===');
            const p4Start = performance.now();
            const validatedData = await this.runPhase4(jsonArray, options);
            console.log(`[SkillsProcessor] Phase 4 completed in ${(performance.now() - p4Start).toFixed(2)}ms`);

            const totalDuration = performance.now() - startTime;
            console.log(`[SkillsProcessor] ✅ Pipeline completed successfully in ${totalDuration.toFixed(2)}ms`);
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
        const targetLanguage = options?.targetLanguage || 'Traditional Chinese';
        const prompt = this.buildPhase1Prompt(inputText, targetLanguage);

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
    buildPhase1Prompt(inputText, targetLanguage = 'Traditional Chinese') {
        return `你是一位專門的「文本清洗與翻譯專家」，負責將非結構化的口語資料轉化為乾淨、語意完整的書面文本，並確保語言符合目標要求。

【核心任務】
1. 強制去噪 (De-noise): 刪除「然後、那個、比較、就是、出來、這樣子、對對對、嗯、啊、呢」等語助詞。
2. 語意重組 (Rephrase): 將破碎句子合併為完整的書面語，補齊主詞、謂語、受詞。
3. **語系轉換 (Translation)**: 必須將輸出內容完全轉換為「${targetLanguage}」。若輸入為其他語言，請務必進行準確翻譯。
4. 保持語氣正式、簡潔。

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
            orgData = this.extractJSON(result.text);

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
            console.warn('[Phase 2] Parse failed, fallback to defaults. Raw text:', result.text);
            console.error('[Phase 2] Error:', parseError.message);
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

        return `你是一位專門的「組織識別專家」，負責識別文本中的人名、職稱、部門以及他們在會議中的角色。${userHint}

【核心任務】
1. **識別參與者**：列出所有在對話中出現的人名。
2. **區分角色**：
   - **會議主持人/負責人**：決定方向、分配任務的人。
   - **執行人/關係人**：被指派任務、或是被提及與某事有關的人。
3. **識別職稱/單位**：如果文本中有提到如「工程師」、「業務」、「開發組」等，請一併記錄。
4. **部門對應**：將識別到的部門對應到代號（如 T255, T201 等）。

【參考部門清單】
- Y200 研發中心-開發處
- T201 (一)產品開發一處開發一組
- T202 (一)產品開發一處開發二組
- T203 (一)產品開發一處開發三組
- T255 (二)產品開發處開發二組
- C140 公關暨專案室
- C130 資訊處

【輸出要求】
1. 僅輸出 JSON，不要 Markdown。
2. **負責人** 欄位請填入此份會議的最主要決策者或主持人。
3. **執行人** 欄位請列出所有「被指派任務」或「未來需要採取行動」的人員清單。

【輸出格式 (JSON)】
{
  "識別人員": ["人名1", "人名2"],
  "負責人": ["最主要的決策人"],
  "執行人": ["所有被指派任務的人"],
  "職稱或單位": ["識別到的職稱或內部單位名稱"],
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

        const prompt = this.buildPhase3Prompt(cleanedText, orgData, options);

        if (this.debug) {
            console.log('[Phase 3] Generating items for dept:', orgData.責任部門代碼);
        }

        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        let jsonArray;
        try {
            jsonArray = this.extractJSON(result.text);
            if (!Array.isArray(jsonArray)) jsonArray = [jsonArray];

            if (this.debug) {
                console.log('[Phase 3] Extracted items:', jsonArray.length);
            }
        } catch (e) {
            console.error('[Phase 3] JSON parse error. Raw text:', result.text);
            throw e;
        }

        return jsonArray;
    }

    /**
     * Build Phase 3 Prompt
     */
    buildPhase3Prompt(cleanedText, orgData, options = {}) {
        const targetLanguage = options.targetLanguage || 'Traditional Chinese';
        const sourceOptions = options.sourceOptions || '商業模式, 外部合作, 法律法規, 會議記錄, 董事會顧問會議, 董事長交辦, KWAY研發中心';

        // Project prefix: "KWAY_yyyymmdd" or "DeptCode_yyyymmdd"
        const selectedDept = options.selectedDepartment;
        const deptCode = selectedDept?.code || 'KWAY';
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // yyyymmdd
        const projectPrefix = `${deptCode}_${dateStr}`;

        // Potential owners identified in Phase 2
        const identifiedPeople = orgData?.識別人員 || [];
        const meetingLead = orgData?.負責人?.[0] || '待指派';
        const taskOwners = orgData?.執行人 || [];

        // Combine all people into a list for the AI to choose from
        const candidates = [...new Set([...identifiedPeople, ...taskOwners, meetingLead])].filter(n => n !== '待指派');
        const candidateStr = candidates.length > 0 ? candidates.join(', ') : '待指派';

        return `你是「資料庫專家」，負責將文本轉為 Notion JSON Array。

【語言要求】
**所有輸出內容（ToDo、專案、負責人、關鍵詞等）必須完全使用「${targetLanguage}」書寫。** 嚴禁用日文或其他原始語言輸出。

【關鍵變數】
- **專案前綴: ${projectPrefix}** (重要：專案欄位格式為「${projectPrefix} 專案名稱」)
- **人員候選名單: [${candidateStr}]** (包含：${meetingLead} 等)

【欄位規則】
1. ToDo: **15-30 字**，精簡書面語。**必須動詞開頭**（如：優化、提升、建立、完成、審閱）。
2. 專案: 必須為「${projectPrefix} 專案核心名稱」格式。
3. **負責人 (重要)**: 
   - **語意指派**：請分析 ToDo 的內容，從「人員候選名單」中挑選最可能的負責人。
   - **邏輯點名**：如果在文本中有人主動認領任務，或被某人指派，請填寫該人名。
   - **預設值**：若無法確定具體個人，則填寫 ["${meetingLead}"] 或 ["待指派"]。
   - **格式**：必須是 Array of Strings，例如 ["張三"]。
4. **責任部門**: 不需要填寫，系統會根據負責人自動從 Personal List 查詢對應部門。
5. 來源: 從 [${sourceOptions}] 擇一。**請務必根據 ToDo 的語意內容進行分析，選擇最貼切的來源。**
6. 狀態: 未開始/進行中/完成 (預設使用 未開始)
7. 關鍵詞 (IMPORTANT): 提取 **5-8** 個具有代表性的名詞。請包含：技術術語、專案代號、具體主題。**禁止使用單個虛詞（如：的、了、是）。**
8. 建立時間: "${new Date().toISOString().split('T')[0]}"

【輸入文本】
${cleanedText}

【輸出格式】
1. **必須為純 JSON Array**，不包含 Markdown 標記或引言。
2. **嚴禁巢狀結構**：所有欄位值必須是 String 或 String Array (如範例)。**禁止**輸出 Notion API 格式的屬性物件 (如 ❌ {"title": [...]} 或 ❌ {"select": {"name": ...}})。
3. **範例結構**:
[
  {
    "來源": "會議記錄",
    "專案": ["${deptCode} 核心名稱"],
    "ToDo": "動詞開頭的行動描述",
    "狀態": "未開始",
    "負責人": ["${meetingLead}"],
    "關鍵詞": ["關鍵詞1", "關鍵詞2"],
    "建立時間": "2026-01-28"
  }
]

提取 15-20 個獨立行動。`;
    }

    /**
     * PHASE 4: QA Inspector
     * Input: JSON array
     * Output: Validated and cleaned JSON array
     */
    async runPhase4(jsonArray, options) {
        const jsonString = JSON.stringify(jsonArray, null, 2);
        const targetLanguage = options?.targetLanguage || 'Traditional Chinese';
        const prompt = this.buildPhase4Prompt(jsonString, targetLanguage);

        if (this.debug) {
            console.log('[Phase 4] Starting final QA cleaning...');
        }

        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        let validatedData;
        try {
            validatedData = this.extractJSON(result.text);
            if (!Array.isArray(validatedData)) validatedData = [validatedData];

            // Name standardization - convert English names to Chinese
            try {
                const buildNameMapping = window.buildNameMappingFromCSV || (async () => new Map());
                const nameMap = await buildNameMapping();

                if (nameMap.size > 0) {
                    validatedData = validatedData.map(item => {
                        // Standardize 負責人 field
                        if (item.負責人) {
                            if (typeof item.負責人 === 'string') {
                                const chineseName = nameMap.get(item.負責人) || item.負責人;
                                item.負責人 = chineseName;
                                if (this.debug && nameMap.get(item.負責人)) {
                                    console.log(`[Phase 4] Name standardized: "${item.負責人}" → "${chineseName}"`);
                                }
                            } else if (Array.isArray(item.負責人)) {
                                item.負責人 = item.負責人.map(name => {
                                    const chineseName = nameMap.get(name) || name;
                                    if (this.debug && nameMap.get(name)) {
                                        console.log(`[Phase 4] Name standardized: "${name}" → "${chineseName}"`);
                                    }
                                    return chineseName;
                                });
                            }
                        }
                        return item;
                    });

                    if (this.debug) {
                        console.log('[Phase 4] Name standardization completed');
                    }
                } else if (this.debug) {
                    console.warn('[Phase 4] Name mapping is empty, skipping standardization');
                }
            } catch (error) {
                if (this.debug) {
                    console.error('[Phase 4] Name standardization error:', error);
                }
            }

            if (this.debug) {
                console.log('[Phase 4] Final items count:', validatedData.length);
                console.log('[Phase 4] Cleanup completed.');
            }
        } catch (e) {
            console.warn('[Phase 4] Final parse failed, using Phase 3 output. Raw text:', result.text);
            validatedData = jsonArray;
        }

        return validatedData;
    }

    /**
     * Build Phase 4 Prompt
     */
    buildPhase4Prompt(jsonData, targetLanguage = 'Traditional Chinese') {
        return `你是「品質守門員」，負責最終檢查並嚴格過濾垃圾資訊。

【語言核對】
確認所有內容是否已完全轉換為「${targetLanguage}」。若發現殘留的日文或其他語言，必須立即翻譯。

【ToDo 長度限制 (CRITICAL)】
檢查每個項目的「ToDo」：
- **若超過 40 字，必須立即將其改寫為 15-30 字的精簡格式。**
- **保留核心動詞與對象，刪除形容詞與背景描述。**

【極度重要：清除垃圾關鍵詞】
檢查所有「關鍵詞(Multi-select)」欄位，若包含以下詞彙，必須立即刪除：
❌ 的、了、是、在、有、和、與、也、都、就、後、個
❌ 那個、這個、然後、時候、大家、東西、內容、問題

【檢查規則】
1. **保留多樣性**：每個項目應保留至少 5 個具體名詞。只要不是上述垃圾詞，請儘量保留專業術語（如：量子、金融、技術、合約、簽署、人才）。
2. ToDo 若太短或包含口語詞，請修訂為專業書面語（15-40字）。
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
