/**
 * Format Converter for AI Output
 * Converts direct field format to properties wrapper format for charts.js compatibility
 */

/**
 * Convert AI output to properties wrapper format if needed
 * @param {Array} data - Parsed JSON array from AI
 * @returns {Array} - Array with properties wrapper format
 */
function convertToPropertiesFormat(data) {
    if (!Array.isArray(data) || data.length === 0) {
        console.log('[Format Converter] Empty or invalid data');
        return data;
    }

    const firstItem = data[0];

    // Check if it's direct format (has 歸屬分類, ToDo, 專案, or 關鍵字 directly)
    const isDirectFormat = firstItem['歸屬分類'] || firstItem['ToDo'] || firstItem['專案'] || firstItem['關鍵字'];

    if (isDirectFormat) {
        console.log('[Format Converter] ✅ Direct format detected - converting to properties wrapper');
        console.log('[Format Converter] First item sample:', {
            歸屬分類: firstItem['歸屬分類'],
            專案: firstItem['專案'],
            hasKeywords: !!firstItem['關鍵字']
        });

        // Wrap each item in properties object
        const wrapped = data.map(item => ({
            properties: item
        }));

        console.log(`[Format Converter] ✅ Converted ${wrapped.length} items to properties format`);
        return wrapped;
    }

    // Check if already has properties wrapper
    if (firstItem.properties) {
        console.log('[Format Converter] ✅ Already has properties wrapper - no conversion needed');
        return data;
    }

    // Unknown format
    console.warn('[Format Converter] ⚠️ Unknown format - returning as-is');
    return data;
}

// Export to global window
window.convertToPropertiesFormat = convertToPropertiesFormat;

console.log('✅ Format Converter loaded');
