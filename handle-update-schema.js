/**
 * Handle Update Schema button click
 * Extract Notion Database schema and save to file
 */
async function handleUpdateSchema() {
    console.log('[App] Update Schema requested');

    showStatus('📥 正在儲存到檔案...', 'loading');

    try {
        // Get Notion config
        const config = window.configManager.getNotionConfig();

        if (!config.token || !config.databaseId) {
            showStatus('❌ Notion 配置不足，請檢查 config.json', 'error');
            return;
        }

        // Call proxy API to get database schema
        const apiUrl = `/api/notion/database/${config.databaseId}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            showStatus(`❌ Notion API 錯誤: ${error.message || response.statusText}`, 'error');
            return;
        }

        const database = await response.json();

        // Extract schema
        const properties = database.properties;
        const schemaResults = {};

        for (const [propName, propConfig] of Object.entries(properties)) {
            const propType = propConfig.type;

            schemaResults[propName] = {
                type: propType,
                options: null
            };

            switch (propType) {
                case 'select':
                    schemaResults[propName].options = propConfig.select.options.map(opt => opt.name);
                    break;

                case 'multi_select':
                    schemaResults[propName].options = propConfig.multi_select.options.map(opt => opt.name);
                    break;

                case 'status':
                    schemaResults[propName].options = propConfig.status.options.map(opt => opt.name);
                    schemaResults[propName].groups = propConfig.status.groups.map(g => ({
                        name: g.name,
                        color: g.color,
                        option_ids: g.option_ids
                    }));
                    break;

                case 'title':
                    schemaResults[propName].isTitle = true;
                    break;
            }
        }

        // Save to file via server endpoint
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

        if (!saveResponse.ok) {
            const error = await saveResponse.json();
            showStatus(`❌ 儲存檔案失敗: ${error.message}`, 'error');
            return;
        }

        const saveResult = await saveResponse.json();

        // Success message matching the screenshot format
        showStatus(
            `✅ Schema 已儲存到檔案: ${saveResult.filename}\n` +
            `📂 檔案路徑: ${saveResult.path}\n` +
            `📊 檔案大小: ${saveResult.size} bytes`,
            'success'
        );

        console.log('[App] Schema saved:', saveResult);

    } catch (error) {
        console.error('[App] Update Schema error:', error);
        showStatus(`❌ 更新選單項目失敗: ${error.message}`, 'error');
    }
}
