/**
 * AutoScan - Charting Component
 * 
 * Handles data visualization for analyzed key points.
 * Specifically designed to process structured data from AutoScan agent.
 */

window.initCharts = function (data, fullText = '') {
    console.log('[Charts] Initializing charts with data:', data);

    const container = document.getElementById('chartsContainer');
    if (!container) return;

    // Clear previous charts
    container.innerHTML = '';

    // Initialize tabs if not already done
    initResultTabs();

    // 1. Core Logic: Structured Data Charts (only if structured data exists)
    const isStructured = data.length > 0 && typeof data[0] === 'object' && data[0].properties;

    if (isStructured) {
        renderStatusChart(data, container);
        // renderProjectChart(data, container); // Removed as requested
        renderCategoryChart(data, container);
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
 * Handle Result Tab Switching
 */
function initResultTabs() {
    const tabBtns = document.querySelectorAll('.result-tab-btn');
    const panels = document.querySelectorAll('.result-panel');

    if (tabBtns.length === 0 || window.resultTabsInitialized) return;

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const target = this.dataset.resultTab;

            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update panels
            panels.forEach(p => {
                if (p.id === `${target}Panel`) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });

            // Re-render word cloud if switching to charts (sometimes canvas size needs refresh)
            if (target === 'charts') {
                setTimeout(() => {
                    const canvas = document.getElementById('wordCloudCanvas');
                    if (canvas && canvas.width === 0) {
                        window.dispatchEvent(new Event('resize'));
                    }
                }, 100);
            }
        });
    });

    window.resultTabsInitialized = true;
}

/**
 * Optimized Keyword Extraction
 * Ensures keywords with frequency >= 5 are included
 */
function extractKeywords(text) {
    if (!text) return [];

    const stopWords = new Set([
        '的', '了', '和', '是', '就', '都', '而', '及', '與', '著', '或', '之', '在', '為', '到', '從', '以', '於', '對於', '關於',
        '你', '我', '他', '她', '它', '我們', '你們', '他們', '這', '那', '哪', '什麼', '誰', '這裏', '那裏',
        'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at', 'by', 'of', 'for', 'with', 'this'
    ]);

    // Tokenize
    const englishWords = text.match(/[a-zA-Z]{3,}/g) || [];
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

    // ULTIMATE OPTIMIZATION: Include all keywords with frequency >= 5
    const results = Object.entries(freqMap)
        .filter(([token, count]) => count >= 5)
        .sort((a, b) => b[1] - a[1]);

    // If we have very few words with freq >= 5, fallback to standard filtering
    if (results.length < 5) {
        return Object.entries(freqMap)
            .filter(([token, count]) => {
                if (/[a-zA-Z]/.test(token)) return count > 1;
                return count > 2;
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50);
    }

    return results.slice(0, 100);
}

function renderWordCloud(keywords) {
    const canvas = document.getElementById('wordCloudCanvas');
    if (!canvas || !window.WordCloud) return;

    // Weight scaling for better visual density
    const list = keywords.map(([text, weight]) => [text, weight * 4 + 10]);

    setTimeout(() => {
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;

        WordCloud(canvas, {
            list: list,
            gridSize: 8,
            weightFactor: function (size) {
                return (size * canvas.width) / 900;
            },
            fontFamily: 'Inter, sans-serif',
            color: 'random-light',
            backgroundColor: 'transparent',
            rotateRatio: 0.3,
            rotationSteps: 2,
            minRotation: -Math.PI / 6,
            maxRotation: Math.PI / 6,
            shuffle: false,
            clearCanvas: true
        });
    }, 400);
}

function renderKeywordBarChart(keywords, container) {
    const top10 = keywords.slice(0, 10);

    createChartCanvas(container, 'keywordChart', '重要關鍵字統計', 'bar', {
        labels: top10.map(k => k[0]),
        datasets: [{
            label: '提及次數',
            data: top10.map(k => k[1]),
            backgroundColor: 'rgba(255, 159, 64, 0.7)',
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

    const total = data.length;

    createChartCanvas(container, 'statusChart', '狀態分佈 (百分比)', 'pie', {
        labels: Object.keys(statusCounts),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(255, 206, 86, 0.8)'
            ],
            borderWidth: 0
        }]
    }, {
        plugins: {
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const val = context.raw;
                        const percent = ((val / total) * 100).toFixed(1);
                        return `${context.label}: ${val} (${percent}%)`;
                    }
                }
            }
        }
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

    createChartCanvas(container, 'categoryChart', '分析領域分佈', 'doughnut', {
        labels: Object.keys(categoryCounts),
        datasets: [{
            data: Object.values(categoryCounts),
            backgroundColor: [
                'rgba(255, 159, 64, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(201, 203, 207, 0.8)'
            ],
            borderWidth: 0
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
