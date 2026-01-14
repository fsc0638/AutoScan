/**
 * AutoScan - Charting Component
 * 
 * Handles data visualization for analyzed key points.
 * Specifically designed to process structured data from AutoScan agent.
 */

window.initCharts = function (data, fullText = '') {
    console.log('[Charts] Initializing charts with data:', data);

    const chartsSection = document.getElementById('chartsSection');
    const container = document.getElementById('chartsContainer');

    if (!chartsSection || !container) return;

    // Clear previous charts
    container.innerHTML = '';

    // 1. Core Logic: Structured Data Charts (only if structured data exists)
    const isStructured = data.length > 0 && typeof data[0] === 'object' && data[0].properties;

    if (isStructured) {
        chartsSection.style.display = 'block';
        renderStatusChart(data, container);
        renderProjectChart(data, container);
        renderCategoryChart(data, container);
    } else {
        // Even if not structured, we show the section for keywords if text is present
        chartsSection.style.display = fullText ? 'block' : 'none';
    }

    // 2. Keyword Analysis (independent of structured data)
    if (fullText) {
        const keywords = extractKeywords(fullText);
        if (keywords.length > 0) {
            renderKeywordBarChart(keywords, container);
            renderWordCloud(keywords);
        }
    }
};

/**
 * Basic Keyword Extraction (Client-side)
 * Filters stops words and counts frequencies
 */
function extractKeywords(text) {
    if (!text) return [];

    // Simple stop words (Traditional Chinese and common English)
    const stopWords = new Set([
        '的', '了', '和', '是', '就', '都', '而', '及', '與', '著', '或', '之', '在', '為', '到', '從', '以', '於', '對於', '關於',
        '你', '我', '他', '她', '它', '我們', '你們', '他們', '這', '那', '哪', '什麼', '誰', '這裏', '那裏',
        'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at', 'by', 'of', 'for', 'with'
    ]);

    // Tokenize: split by spaces and punctuation

    // 1. Extract English words (min length 3)
    const englishWords = text.match(/[a-zA-Z]{3,}/g) || [];

    // 2. Extract Chinese "words" (simple heuristic: 2-3 chars)
    const chineseChars = text.replace(/[^\u4E00-\u9FA5]/g, '');
    const chineseWords = [];

    for (let i = 0; i < chineseChars.length - 1; i++) {
        chineseWords.push(chineseChars.substr(i, 2));
        if (i < chineseChars.length - 2) chineseWords.push(chineseChars.substr(i, 3));
    }

    const allTokens = [...englishWords.map(w => w.toLowerCase()), ...chineseWords];
    const freqMap = {};

    allTokens.forEach(token => {
        if (!stopWords.has(token)) {
            freqMap[token] = (freqMap[token] || 0) + 1;
        }
    });

    const sorted = Object.entries(freqMap)
        .filter(([token, count]) => {
            if (/[a-zA-Z]/.test(token)) return count > 1;
            return count > 2;
        })
        .sort((a, b) => b[1] - a[1]);

    return sorted.slice(0, 50);
}

function renderWordCloud(keywords) {
    const canvas = document.getElementById('wordCloudCanvas');
    if (!canvas || !window.WordCloud) return;

    // WordCloud2 expects data in [word, count] format
    const list = keywords.slice(0, 30).map(([text, weight]) => [text, weight * 3 + 10]);

    // Wait for container to be visible
    setTimeout(() => {
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;

        WordCloud(canvas, {
            list: list,
            gridSize: 10,
            weightFactor: function (size) {
                return (size * canvas.width) / 800;
            },
            fontFamily: 'Inter, sans-serif',
            color: 'random-light',
            backgroundColor: 'transparent',
            rotateRatio: 0.5,
            rotationSteps: 2,
            minRotation: -Math.PI / 6,
            maxRotation: Math.PI / 6,
            shuffle: true
        });
    }, 200);
}

function renderKeywordBarChart(keywords, container) {
    const top10 = keywords.slice(0, 10);

    createChartCanvas(container, 'keywordChart', '頻率最高關鍵字', 'bar', {
        labels: top10.map(k => k[0]),
        datasets: [{
            label: '提及次數',
            data: top10.map(k => k[1]),
            backgroundColor: 'rgba(255, 159, 64, 0.6)',
            borderRadius: 6
        }]
    }, {
        plugins: {
            legend: { display: false }
        }
    });
}

function renderStatusChart(data, container) {
    const statusCounts = {};
    data.forEach(item => {
        const status = item.properties.狀態 || '未開始';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    createChartCanvas(container, 'statusChart', '狀態分佈', 'pie', {
        labels: Object.keys(statusCounts),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: [
                'rgba(255, 99, 132, 0.7)',
                'rgba(54, 162, 235, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(255, 206, 86, 0.7)'
            ],
            borderColor: '#fff',
            borderWidth: 2
        }]
    });
}

function renderProjectChart(data, container) {
    const projectCounts = {};
    data.forEach(item => {
        const projects = item.properties.專案 || [];
        projects.forEach(p => {
            projectCounts[p] = (projectCounts[p] || 0) + 1;
        });
    });

    if (Object.keys(projectCounts).length === 0) return;

    createChartCanvas(container, 'projectChart', '專案關聯度', 'bar', {
        labels: Object.keys(projectCounts),
        datasets: [{
            label: '提及次數',
            data: Object.values(projectCounts),
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
            borderRadius: 8
        }]
    }, {
        indexAxis: 'y'
    });
}

function renderCategoryChart(data, container) {
    const categoryCounts = {};
    data.forEach(item => {
        const categories = item.properties.歸屬分類 || [];
        categories.forEach(c => {
            categoryCounts[c] = (categoryCounts[c] || 0) + 1;
        });
    });

    if (Object.keys(categoryCounts).length === 0) return;

    createChartCanvas(container, 'categoryChart', '分析領域', 'doughnut', {
        labels: Object.keys(categoryCounts),
        datasets: [{
            data: Object.values(categoryCounts),
            backgroundColor: [
                'rgba(255, 159, 64, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(54, 162, 235, 0.7)',
                'rgba(153, 102, 255, 0.7)',
                'rgba(201, 203, 207, 0.7)'
            ]
        }]
    });
}

function createChartCanvas(container, id, title, type, chartData, options = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';

    const h3 = document.createElement('h3');
    h3.textContent = title;
    wrapper.appendChild(h3);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';

    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvasContainer.appendChild(canvas);
    wrapper.appendChild(canvasContainer);

    container.appendChild(wrapper);

    new Chart(canvas, {
        type: type,
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e0e0e0', font: { size: 10 } }
                }
            },
            ...options
        }
    });
}
