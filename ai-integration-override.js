// ==================================================
// OVERRIDE: AI Model Integration
// ==================================================
// This file overrides app.js functions to use AI API

// Store original extractKeyPoints if it exists
const originalExtractKeyPoints = window.extractKeyPoints;

/**
 * Extract key points using AI model
 * Overrides the original extractKeyPoints function
 */
window.extractKeyPoints = async function () {
    const text = window.transcript || '';

    if (!text || text.trim().length === 0) {
        showStatus('沒有文字可以分析', 'error');
        return;
    }

    try {
        showStatus('正在使用 AI 分析重點...', 'info');

        // Call AI model
        const keyPoints = await callAIModel(text);

        if (!keyPoints || keyPoints.length === 0) {
            showStatus('未能提取重點，請稍後再試', 'error');
            return;
        }

        // Display key points
        displayKeyPoints(keyPoints);
        showStatus(`成功提取 ${keyPoints.length} 個重點`, 'success');

    } catch (error) {
        console.error('Extract key points error:', error);
        showStatus(`分析失敗：${error.message}`, 'error');
    }
};

/**
 * Override analyze manual input to use new extractKeyPoints
 */
const originalAnalyzeManualInput = window.analyzeManualInput;

window.analyzeManualInput = async function () {
    const manualTranscript = document.getElementById('manualTranscript');
    if (!manualTranscript) {
        showStatus('找不到文字輸入框', 'error');
        return;
    }

    const text = manualTranscript.value.trim();

    if (!text) {
        showStatus('請輸入逐字稿內容', 'error');
        return;
    }

    if (text.length < 50) {
        showStatus('逐字稿內容過短，請輸入至少 50 個字元', 'error');
        return;
    }

    window.transcript = text;
    await window.extractKeyPoints();
};

/**
 * Override showStatus to use showStatusMessage
 */
if (typeof showStatus === 'undefined') {
    window.showStatus = function (message, type = 'info') {
        showStatusMessage(message, type);
    };
}

/**
 * Setup copy button
 */
document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copyKeyPoints');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyKeyPointsToClipboard);
        console.log('✅ Copy button handler attached');
    }
});

console.log('✅ AI integration overrides loaded');
