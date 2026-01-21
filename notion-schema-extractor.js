/**
 * Notion Database Schema Extractor
 * 從 Notion Database 中提取所有下拉選單、多選等欄位的選項
 */

async function extractNotionSchema() {
    console.log('🔍 正在讀取 Notion Database Schema...\n');

    try {
        // 讀取配置
        const config = await window.configManager.getNotionConfig();

        if (!config.token || !config.databaseId) {
            console.error('❌ 錯誤：未找到 Notion Token 或 Database ID');
            console.log('請在 config.json 中設定 notion.token 和 notion.databaseId');
            return;
        }

        // 🔧 使用本地代理避免 CORS 問題
        const apiUrl = `/api/notion/database/${config.databaseId}`;

        console.log('📡 呼叫 API:', apiUrl);

        // 呼叫代理 API 獲取 Database 資訊
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Notion API 錯誤:', error);
            return;
        }

        const database = await response.json();

        // 顯示 Database 基本資訊
        console.log('📊 Database 資訊:');
        console.log(`  名稱: ${database.title[0]?.plain_text || '(無標題)'}`);
        console.log(`  ID: ${database.id}`);
        console.log(`  建立時間: ${database.created_time}`);
        console.log('\n' + '='.repeat(80) + '\n');

        // 提取所有欄位及其選項
        const properties = database.properties;
        const schemaResults = {};

        console.log('📋 欄位及選項列表:\n');

        for (const [propName, propConfig] of Object.entries(properties)) {
            const propType = propConfig.type;

            console.log(`\n🔹 ${propName}`);
            console.log(`   類型: ${propType}`);

            schemaResults[propName] = {
                type: propType,
                options: null
            };

            // 根據欄位類型提取選項
            switch (propType) {
                case 'select':
                    const selectOptions = propConfig.select.options.map(opt => opt.name);
                    schemaResults[propName].options = selectOptions;
                    console.log(`   選項 (${selectOptions.length} 個):`);
                    selectOptions.forEach((opt, idx) => {
                        console.log(`     ${idx + 1}. ${opt}`);
                    });
                    break;

                case 'multi_select':
                    const multiSelectOptions = propConfig.multi_select.options.map(opt => opt.name);
                    schemaResults[propName].options = multiSelectOptions;
                    console.log(`   選項 (${multiSelectOptions.length} 個):`);
                    multiSelectOptions.forEach((opt, idx) => {
                        console.log(`     ${idx + 1}. ${opt}`);
                    });
                    break;

                case 'status':
                    const statusGroups = propConfig.status.groups;
                    const statusOptions = propConfig.status.options.map(opt => opt.name);
                    schemaResults[propName].options = statusOptions;
                    schemaResults[propName].groups = statusGroups.map(g => ({
                        name: g.name,
                        color: g.color,
                        option_ids: g.option_ids
                    }));
                    console.log(`   狀態分組 (${statusGroups.length} 個):`);
                    statusGroups.forEach((group, idx) => {
                        console.log(`     ${idx + 1}. ${group.name} (${group.color})`);
                    });
                    console.log(`   全部狀態 (${statusOptions.length} 個):`);
                    statusOptions.forEach((opt, idx) => {
                        console.log(`     ${idx + 1}. ${opt}`);
                    });
                    break;

                case 'title':
                    console.log(`   → 這是標題欄位`);
                    schemaResults[propName].isTitle = true;
                    break;

                case 'date':
                    console.log(`   → 日期欄位`);
                    break;

                case 'people':
                    console.log(`   → 人員欄位`);
                    break;

                case 'rich_text':
                    console.log(`   → 富文字欄位`);
                    break;

                default:
                    console.log(`   → 其他類型`);
            }
        }

        console.log('\n' + '='.repeat(80) + '\n');

        // 生成 JavaScript 物件格式，方便複製使用
        console.log('📦 可複製的 JavaScript 物件:\n');
        console.log('const notionSchemaOptions = {');

        for (const [propName, propData] of Object.entries(schemaResults)) {
            if (propData.options && propData.options.length > 0) {
                console.log(`  "${propName}": [`);
                propData.options.forEach((opt, idx) => {
                    const comma = idx < propData.options.length - 1 ? ',' : '';
                    console.log(`    "${opt}"${comma}`);
                });
                console.log('  ],');
            }
        }

        console.log('};\n');

        // 儲存結果到全域變數
        window.notionSchemaResults = schemaResults;

        console.log('✅ Schema 提取完成！');
        console.log('💡 結果已儲存到 window.notionSchemaResults');

        // 🔧 自動儲存到檔案
        console.log('\n📁 正在儲存到檔案...');

        try {
            const saveResponse = await fetch('/api/save-notion-schema', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    databaseId: config.databaseId,
                    schemaData: schemaResults
                })
            });

            if (saveResponse.ok) {
                const saveResult = await saveResponse.json();
                console.log(`✅ Schema 已儲存到檔案: ${saveResult.filename}`);
                console.log(`📂 檔案路徑: ${saveResult.path}`);
                console.log(`📊 檔案大小: ${saveResult.size} bytes`);
            } else {
                const error = await saveResponse.json();
                console.error('❌ 儲存檔案失敗:', error.message);
            }
        } catch (saveError) {
            console.error('❌ 儲存檔案時發生錯誤:', saveError.message);
        }

        return schemaResults;

    } catch (error) {
        console.error('❌ 提取 Schema 時發生錯誤:', error);
        console.error('錯誤詳情:', error.message);

        if (error.message.includes('Failed to fetch')) {
            console.log('\n💡 提示：如果遇到 CORS 錯誤，請：');
            console.log('   1. 使用 npm start 啟動本地伺服器');
            console.log('   2. 或安裝瀏覽器 CORS 擴充套件');
        }
    }
}

// 匯出到全域
window.extractNotionSchema = extractNotionSchema;

console.log('✅ Notion Schema Extractor 已載入');
console.log('💡 使用方式：在 Console 中執行 extractNotionSchema()');
