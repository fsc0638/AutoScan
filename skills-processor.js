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

            const totalDuration = performance.now() - startTime;
            console.log(`[SkillsProcessor] ✅ Pipeline completed successfully in ${totalDuration.toFixed(2)}ms`);
            console.log('[SkillsProcessor] Output items:', jsonArray.length);

            return {
                success: true,
                text: JSON.stringify(jsonArray, null, 2),
                data: jsonArray,
                phases: {
                    phase1_cleaned: cleanedText,
                    phase2_org: orgData,
                    phase3_json: jsonArray
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
     * Output: Organization data (JSON) with validated employee names
     */
    async runPhase2(cleanedText, options) {
        const selectedDept = options?.selectedDepartment;

        if (this.debug) {
            console.log('[Phase 2] Selected Dept from options:', selectedDept);
        }

        // Fetch valid employee names from Personal List CSV
        let validEmployeeNames = new Set();
        try {
            const buildNameMapping = window.buildNameMappingFromCSV || (async () => new Map());
            const nameMap = await buildNameMapping();
            // Add all Chinese names to valid set
            for (const chineseName of nameMap.values()) {
                if (chineseName) validEmployeeNames.add(chineseName);
            }
            // Also add all English names (keys)
            for (const englishName of nameMap.keys()) {
                if (englishName) validEmployeeNames.add(englishName);
            }
            if (this.debug) {
                console.log('[Phase 2] Loaded employee whitelist:', validEmployeeNames.size, 'names');
            }
        } catch (error) {
            console.warn('[Phase 2] Could not load employee whitelist:', error.message);
        }

        const prompt = this.buildPhase2Prompt(cleanedText, selectedDept, validEmployeeNames);

        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        let orgData;
        try {
            orgData = this.extractJSON(result.text);

            // --- PHASE 2 HALLUCINATION GUARD ---
            // Strict validation ONLY for 負責人 (must be company employee or "待指派")
            // Relaxed for 識別人員 and 執行人 (can include external partners)
            if (validEmployeeNames.size > 0) {
                // ✅ STRICT: Validate 負責人 (only company employees)
                if (Array.isArray(orgData.負責人)) {
                    const originalOwners = orgData.負責人;
                    orgData.負責人 = originalOwners.filter(name => {
                        if (name === '待指派') return true;
                        const isValid = validEmployeeNames.has(name);
                        if (!isValid && this.debug) {
                            console.warn(`[Phase 2] 🛡️ Hallucination blocked (負責人): "${name}" - not in employee list`);
                        }
                        return isValid;
                    });
                    if (orgData.負責人.length === 0) {
                        orgData.負責人 = ['待指派'];
                    }
                }

                // ⚠️ RELAXED: Keep 識別人員 as-is (may include external partners)
                // Only filter out obvious hallucinations (very common fake names)
                const obviousHallucinations = new Set(['王小華', '張偉', '李強', '王強', '陳明', '李佳', '張麗', '王芳']);
                if (Array.isArray(orgData.識別人員)) {
                    const originalPeople = orgData.識別人員;
                    orgData.識別人員 = originalPeople.filter(name => {
                        const isObviouslyFake = obviousHallucinations.has(name);
                        if (isObviouslyFake && this.debug) {
                            console.warn(`[Phase 2] 🛡️ Hallucination blocked (識別人員): "${name}" - obvious fake name`);
                        }
                        return !isObviouslyFake;
                    });
                }

                // ⚠️ RELAXED: Keep 執行人 as-is (may include external partners)
                if (Array.isArray(orgData.執行人)) {
                    const originalExecutors = orgData.執行人;
                    orgData.執行人 = originalExecutors.filter(name => {
                        if (name === '待指派') return true;
                        const isObviouslyFake = obviousHallucinations.has(name);
                        if (isObviouslyFake && this.debug) {
                            console.warn(`[Phase 2] 🛡️ Hallucination blocked (執行人): "${name}" - obvious fake name`);
                        }
                        return !isObviouslyFake;
                    });
                }

                if (this.debug) {
                    console.log('[Phase 2] After Hallucination Guard - 識別人員:', orgData.識別人員);
                    console.log('[Phase 2] After Hallucination Guard - 負責人:', orgData.負責人);
                    console.log('[Phase 2] After Hallucination Guard - 執行人:', orgData.執行人);
                }
            }

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
    buildPhase2Prompt(cleanedText, selectedDept, validEmployeeNames = new Set()) {
        const userHint = selectedDept?.subDepartment ?
            `\n⚠️ 用戶已在 UI 選擇部門：${selectedDept.subDepartment.name} (代號: ${selectedDept.subDepartment.code})，請以此為優先參考。` : '';

        // Create a sample of employee names for the prompt (max 50 to keep prompt reasonable)
        const employeeArray = [...validEmployeeNames];
        const sampleSize = Math.min(employeeArray.length, 50);
        const employeeSample = employeeArray.slice(0, sampleSize).join('、');
        const employeeHint = employeeSample ?
            `\n\n【公司員工名單 (部分)】僅供參考，用於識別會議中的人名：\n${employeeSample}${employeeArray.length > sampleSize ? '... 等' : ''}` : '';

        return `你是一位專門的「組織識別專家」，負責識別文本中的人名、職稱、部門以及他們在會議中的角色。${userHint}

【核心任務】
1. **識別參與者**：列出所有在對話中出現的人名。
2. **區分角色**：
   - **會議主持人/負責人**：決定方向、分配任務的人。
   - **執行人/關係人**：被指派任務、或是被提及與某事有關的人。
3. **識別職稱/單位**：如果文本中有提到如「工程師」、「業務」、「開發組」等，請一併記錄。
4. **部門對應**：將識別到的部門對應到代號（如 T255, T201 等）。

【⚠️ 嚴格人名限制 (CRITICAL)】
- **僅識別文本中明確出現的人名**。
- **嚴禁自創或編造任何人名**（如：王小華、張偉、李強 等常見虛構名字）。
- 若文本中沒有任何人名被提及，**負責人** 和 **執行人** 欄位請填入 ["待指派"]。
- 只有在文本中「字面上」出現某人的名字時，才能將其列入。${employeeHint}

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
2. **負責人** 欄位請填入此份會議的最主要決策者或主持人。若無法確定，填入 ["待指派"]。
3. **執行人** 欄位請列出所有「被指派任務」或「未來需要採取行動」的人員清單。若無，填入空陣列 []。

【輸出格式 (JSON)】
{
  "識別人員": ["人名1", "人名2"],
  "負責人": ["最主要的決策人"],
  "執行人": ["所有被指派任務的人"],
  "職稱或單位": ["識別到的職稱或內部單位名稱"],
  "責任部門": "名稱",
  "責任部門代碼": "4碼(如T255)或KWAY"
}

【待分析文本】
${cleanedText}`;
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

        // Initialize candidate list for the prompt and for post-processing validation
        // Handle both string arrays and object arrays (with .姓名 property)
        const rawIdentifiedPeople = orgData?.識別人員 || [];
        const identifiedPeople = rawIdentifiedPeople.map(p => {
            if (typeof p === 'string') return p;
            if (p && p.姓名) return p.姓名;
            return null;
        }).filter(n => n != null);

        const meetingLead = orgData?.負責人?.[0] || '待指派';
        const taskOwners = orgData?.執行人 || [];

        // Combine all legitimate candidates (filter undefined/null/待指派)
        const candidates = [...new Set([...identifiedPeople, ...taskOwners, meetingLead])]
            .filter(n => n != null && n !== '待指派' && n !== undefined);
        const candidateSet = new Set(candidates);
        candidateSet.add('待指派');

        const prompt = this.buildPhase3Prompt(cleanedText, orgData, options, candidates);

        if (this.debug) {
            console.log('[Phase 3] Generating items with candidates:', candidates);
        }

        const result = await this.llm.call(prompt, {
            ...options,
            systemInstruction: null
        });

        let jsonArray;
        try {
            jsonArray = this.extractJSON(result.text);
            if (!Array.isArray(jsonArray)) jsonArray = [jsonArray];

            // --- HALLUCINATION GUARD ---
            // प्रोग्रामmatically ensure only valid candidates are allowed
            jsonArray = jsonArray.map(item => {
                if (item.負責人) {
                    const originalOwners = Array.isArray(item.負責人) ? item.負責人 : [item.負責人];

                    // Filter out any name not in our official candidate list
                    const validOwners = originalOwners.filter(name => candidateSet.has(name));

                    if (validOwners.length === 0) {
                        if (this.debug) console.warn(`[Phase 3] 🛡️ Hallucination blocked: "${originalOwners.join(', ')}" replaced with "待指派"`);
                        item.負責人 = ["待指派"];
                    } else {
                        item.負責人 = validOwners;
                    }
                } else {
                    item.負責人 = ["待指派"];
                }
                return item;
            });

            if (this.debug) {
                console.log('[Phase 3] Extracted items after Hallucination Guard:', jsonArray.length);
            }

            // Name standardization - convert English names to Chinese
            try {
                const buildNameMapping = window.buildNameMappingFromCSV || (async () => new Map());
                const nameMap = await buildNameMapping();

                if (nameMap.size > 0) {
                    jsonArray = jsonArray.map(item => {
                        // Standardize 負責人 field
                        if (item.負責人) {
                            if (typeof item.負責人 === 'string') {
                                const chineseName = nameMap.get(item.負責人) || item.負責人;
                                item.負責人 = chineseName;
                                if (this.debug && nameMap.get(item.負責人)) {
                                    console.log(`[Phase 3] Name standardized: "${item.負責人}" → "${chineseName}"`);
                                }
                            } else if (Array.isArray(item.負責人)) {
                                item.負責人 = item.負責人.map(name => {
                                    const chineseName = nameMap.get(name) || name;
                                    if (this.debug && nameMap.get(name)) {
                                        console.log(`[Phase 3] Name standardized: "${name}" → "${chineseName}"`);
                                    }
                                    return chineseName;
                                });
                            }
                        }
                        return item;
                    });

                    if (this.debug) {
                        console.log('[Phase 3] Name standardization completed');
                    }
                } else if (this.debug) {
                    console.warn('[Phase 3] Name mapping is empty, skipping standardization');
                }
            } catch (error) {
                if (this.debug) {
                    console.error('[Phase 3] Name standardization error:', error);
                }
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
    buildPhase3Prompt(cleanedText, orgData, options = {}, candidates = []) {
        const targetLanguage = options.targetLanguage || 'Traditional Chinese';
        const sourceOptions = options.sourceOptions || '商業模式, 外部合作, 法律法規, 會議記錄, 董事會顧問會議, 董事長交辦, KWAY研發中心';

        // Project prefix: "T612_yyyymmdd" or "KWAY_yyyymmdd" (default)
        const selectedDept = options.selectedDepartment;
        // Try subDepartment first, fallback to mainDepartment, then KWAY
        const deptCode = selectedDept?.subDepartment?.code || selectedDept?.mainDepartment?.code || 'KWAY';
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // yyyymmdd
        const projectPrefix = `${deptCode}_${dateStr}`;

        const meetingLead = orgData?.負責人?.[0] || '待指派';
        const candidateStr = candidates.length > 0 ? candidates.join(', ') : '待指派';

        return `你是「資料庫專家」，負責將文本轉為 Notion JSON Array。

【語言要求】
**所有輸出內容（ToDo、專案、負責人、關鍵詞等）必須完全使用「${targetLanguage}」書寫。** 嚴禁用日文或其他原始語言輸出。

【關鍵變數】
- **專案前綴: ${projectPrefix}** (重要：專案欄位格式為「${projectPrefix} 專案名稱」)
- **人員候選名單: [${candidateStr}]** (包含：${meetingLead} 等)

【欄位規則】
1. ToDo: **25-50 字**，精簡書面語。**必須動詞開頭**（如：優化、提升、建立、完成、審閱）。
   - **內容要素**：必須包含「核心動作」與「具體對象」，避免過於籠統（例如：不要只寫「簽署合約」，應寫「完成與 Groovenauts 的日本公司合作意向書簽署」）。
   - **長度控制**：若超過 60 字，請改寫為 25-50 字的格式，保留關鍵細節並刪除修飾性形容詞。
2. 專案: 必須為「${projectPrefix} 專案核心名稱」格式。
3. **負責人 (重要)**: 
   - **嚴格限制 (CRITICAL)**：僅能從提供的「人員候選名單」中挑選。**嚴禁自創或編造名單以外的任何姓名**（如：王小華、陳志強等）。
   - **語意指派**：分析 ToDo 內容，若與名單中某人職責相關則指派之。
   - **唯一備選方案**：若名單中無人適任，或名單為空，**必須**填寫 ["待指派"]。
   - **格式**：必須是 Array of Strings，例如 ["張三"]。
4. 來源: 從 [${sourceOptions}] 擇一。**請務必根據 ToDo 的語意內容進行分析，選擇最貼切的來源。**
5. 狀態: 未開始/進行中/完成 (預設使用 未開始)
6. **關鍵詞 (CRITICAL)**: 提取 **5-8** 個具有代表性的名詞。請包含：技術術語、專案代號、具體主題。
   - **嚴格禁止**以下垃圾詞彙：
     ❌ 的、了、是、在、有、和、與、也、都、就、後、個
     ❌ 那個、這個、然後、時候、大家、東西、內容、問題
   - **保留多樣性**：每個項目應保留至少 5 個具體名詞。儘量保留專業術語（如：量子、金融、技術、合約、簽署、人才）。
7. 建立時間: "${new Date().toISOString().split('T')[0]}"

【語言要求 (CRITICAL)】
**所有輸出內容（ToDo、專案、負責人、關鍵詞等）必須完全使用「${targetLanguage}」書寫。** 若發現殘留的日文或其他語言，必須立即翻譯。嚴禁用日文或其他原始語言輸出。

【輸入文本】
${cleanedText}

【輸出格式】
1. **必須為純 JSON Array**，不包含 Markdown 標記或引言。
2. **嚴禁巢狀結構**：所有欄位值必須是 String 或 String Array (如範例)。**禁止**輸出 Notion API 格式的屬性物件 (如 ❌ {"title": [...]} 或 ❌ {"select": {"name": ...}})。
3. **確保 JSON 格式完美**，無語法錯誤。
4. **範例結構**:
[
  {
    "來源": "會議記錄",
    "專案": ["${projectPrefix} 核心名稱"],
    "ToDo": "動詞開頭的行動描述",
    "狀態": "未開始",
    "負責人": ["${meetingLead}"],
    "關鍵詞": ["關鍵詞1", "關鍵詞2"],
    "建立時間": "${new Date().toISOString().split('T')[0]}"
  }
]

提取 15-20 個獨立行動。`;

    }


}

// Module exports
if (typeof module !== 'undefined' && module.exports) module.exports = SkillsProcessor;
if (typeof window !== 'undefined') window.SkillsProcessor = SkillsProcessor;
