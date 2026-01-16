/**
 * AutoScan - Charting Component
 * 
 * Handles data visualization for analyzed key points.
 * Specifically designed to process structured data from AutoScan agent.
 */

window.initCharts = function (data, fullText = '') {
    console.log('[Charts] initCharts called:', { dataLength: data?.length, textLength: fullText?.length });

    const container = document.getElementById('chartsContainer');
    if (!container) {
        console.error('[Charts] #chartsContainer not found');
        return;
    }

    // Clear previous charts
    container.innerHTML = '';

    // Initialize tabs if not already done
    try {
        initResultTabs();
    } catch (e) {
        console.warn('[Charts] Result tabs initialization failed:', e);
    }

    // 1. Core Logic: Structured Data Charts
    // Data check: if data[0] is just a string, it's not structured
    const isStructured = Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0].properties;

    console.log('[Charts] Data structure check:', { isStructured });

    if (isStructured) {
        try {
            renderStatusChart(data, container);
            renderCategoryChart(data, container);
        } catch (e) {
            console.error('[Charts] Error rendering structured charts:', e);
        }

        // Check if AI provided translated keywords
        const aiKeywords = [];
        data.forEach(item => {
            if (item.properties && item.properties.關鍵字 && Array.isArray(item.properties.關鍵字)) {
                aiKeywords.push(...item.properties.關鍵字);
            }
        });

        if (aiKeywords.length > 0) {
            console.log(`[Charts] Using ${aiKeywords.length} keywords from AI analysis`);
            // Aggregate weights/frequencies of AI keywords
            const freqMap = {};
            aiKeywords.forEach(kw => {
                // Handle both object {text, weight} and legacy string formats
                const text = typeof kw === 'object' ? (kw.text || kw.關鍵字) : kw.trim();
                const weight = typeof kw === 'object' ? (kw.weight || 1) : 1;

                if (text) {
                    freqMap[text] = (freqMap[text] || 0) + weight;
                }
            });
            const keywordList = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
            window.lastKeywords = keywordList;
            console.log('[Charts] AI Keyword List (weighted):', keywordList);
            renderKeywordBarChart(keywordList, container);
            renderWordCloud(keywordList);
            return; // Skip local extraction since we have AI keywords
        }
    } else {
        console.log('[Charts] Skipping structured charts (data is simple list)');
    }

    // 2. Keyword Analysis (Fallback to local extraction if no AI keywords)
    if (fullText) {
        try {
            const keywords = extractKeywords(fullText, data);
            window.lastKeywords = keywords; // Store for tab switching
            console.log(`[Charts] Extracted ${keywords.length} keywords`);
            if (keywords.length > 0) {
                renderKeywordBarChart(keywords, container);
                renderWordCloud(keywords);
            } else {
                console.log('[Charts] No keywords found (below frequency threshold)');
            }
        } catch (e) {
            console.error('[Charts] Error providing keyword analysis:', e);
        }
    } else {
        console.warn('[Charts] No fullText provided for keyword analysis');
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
                    window.dispatchEvent(new Event('resize'));
                    // Explicitly re-render WordCloud if we have data
                    if (window.lastKeywords && window.lastKeywords.length > 0) {
                        console.log('[Charts] Re-rendering WordCloud on tab switch');
                        renderWordCloud(window.lastKeywords);
                    }
                }, 150);
            }
        });
    });

    window.resultTabsInitialized = true;
}

/**
 * Optimized Keyword Extraction
 * Uses sentence-aware splitting, expanded stopwords, and linguistic filters.
 * Now supports structured data as a high-weight keyword source.
 */
function extractKeywords(text, structuredData = []) {
    if (!text && (!structuredData || structuredData.length === 0)) return [];

    const stopWords = new Set([
        // Chinese Particles & Functional Words
        '的', '了', '和', '是', '就', '都', '而', '及', '與', '著', '或', '之', '在', '為', '到', '從', '以', '於', '對於', '關於',
        '個', '吧', '嗎', '呢', '啦', '啊', '呀', '嘿', '唔', '嗯', '其', '此', '這', '那', '哪', '誰', '這裏', '那裏', '什麼', '怎樣',
        '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '個', '隻', '張', '本', '關', '於', '到', '裡', '說', '講',
        '一個', '一些', '一下', '一次', '一種', '一直', '一些', '一點', '有些', '有些', '雖然', '但是', '如果', '所以', '因為', '甚至',
        '你', '我', '他', '她', '它', '我們', '你們', '他們', '您的', '我的', '他的', '這是一個',
        // Common Reporting/Filler Verbs (Fragments)
        '說', '講', '看', '做', '想', '要', '會', '能', '可以', '可能', '應該', '必須', '需要', '進行', '目前', '現在',
        // English Stopwords
        'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at', 'by', 'of', 'for', 'with', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'our', 'your', 'my', 'his', 'her', 'us', 'we', 'you', 'me', 'can', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
    ]);

    const freqMap = {};

    // 1. Process Structured Data (High Weight: x5)
    if (Array.isArray(structuredData)) {
        structuredData.forEach(item => {
            const title = item.properties?.ToDo || '';
            const tokens = title.match(/[\u4E00-\u9FA5]{2,4}|[a-zA-Z]{3,}/g) || [];
            tokens.forEach(token => {
                const t = token.toLowerCase();
                if (!stopWords.has(t)) {
                    freqMap[t] = (freqMap[t] || 0) + 5;
                }
            });
        });
    }

    // 2. Process Raw Text (Sentence-Aware)
    if (text) {
        // Split by punctuation to avoid cross-sentence fragments (like "容說")
        const sentences = text.split(/[,.!?;:，。！？；：\n\s\t]/);

        sentences.forEach(sentence => {
            if (!sentence || sentence.length < 2) return;

            // Extract English words
            const englishWords = sentence.match(/[a-zA-Z]{3,}/g) || [];
            englishWords.forEach(w => {
                const t = w.toLowerCase();
                if (!stopWords.has(t)) {
                    freqMap[t] = (freqMap[t] || 0) + 1;
                }
            });

            // Extract Chinese n-grams (2-3 chars)
            const chars = sentence.replace(/[^\u4E00-\u9FA5]/g, '');
            for (let i = 0; i < chars.length - 1; i++) {
                // Bi-grams
                const bi = chars.substr(i, 2);
                if (!stopWords.has(bi) && !stopWords.has(bi[0]) && !stopWords.has(bi[1])) {
                    // Linguistic heuristic: avoid ending with "說" or "個"
                    if (!['說', '講', '個', '內'].includes(bi[1])) {
                        freqMap[bi] = (freqMap[bi] || 0) + 1;
                    }
                }

                // Tri-grams
                if (i < chars.length - 2) {
                    const tri = chars.substr(i, 3);
                    if (!stopWords.has(tri) && !stopWords.has(tri[0]) && !stopWords.has(tri[tri.length - 1])) {
                        freqMap[tri] = (freqMap[tri] || 0) + 1;
                    }
                }
            }
        });
    }

    // Sort and limit
    const results = Object.entries(freqMap)
        .sort((a, b) => b[1] - a[1]);

    // Cleanup redundancy: if a shorter word is a substring of a more frequent longer word, ignore it
    const finalResults = [];
    results.forEach(([word, freq], idx) => {
        if (finalResults.length >= 80) return;

        // Find if any higher-freq word contains this word
        const isFragment = finalResults.some(([hWord, hFreq]) => hWord.includes(word) && hFreq >= freq);
        if (!isFragment) {
            finalResults.push([word, freq]);
        }
    });

    return finalResults.slice(0, 60);
}

function renderWordCloud(keywords) {
    const canvas = document.getElementById('wordCloudCanvas');
    if (!canvas) {
        console.error('[Charts] #wordCloudCanvas not found');
        return;
    }
    if (!window.WordCloud) {
        console.error('[Charts] WordCloud2.js library not loaded');
        return;
    }

    // Relative scaling for AI keywords (often have low absolute counts like 1, 2, 3)
    // Find min/max weights
    const weights = keywords.map(kw => kw[1]);
    const maxW = Math.max(...weights);
    const minW = Math.min(...weights);

    // Map weights to a visible range (e.g., 20px to 80px)
    const list = keywords.map(([text, weight]) => {
        let size;
        if (maxW === minW) {
            size = 40; // Default size if all are same
        } else {
            // Linear interpolation: size = minSize + (weight - minW) / (maxW - minW) * (maxSize - minSize)
            size = 20 + ((weight - minW) / (maxW - minW)) * 60;
        }
        return [text, size];
    });

    // Use a short delay to ensure tab-panel is active or has dimensions
    setTimeout(() => {
        const container = canvas.parentElement;
        if (!container) return;

        // Ensure container has default dimensions if it's hidden
        const width = container.offsetWidth || 800;
        const height = container.offsetHeight || 350;

        canvas.width = width;
        canvas.height = height;

        console.log(`[Charts] Rendering WordCloud on ${width}x${height} canvas`);

        try {
            WordCloud(canvas, {
                list: list,
                gridSize: 8,
                weightFactor: function (size) {
                    return (size * canvas.width) / 900;
                },
                fontFamily: 'Inter, sans-serif',
                color: 'random-dark',
                backgroundColor: 'transparent',
                rotateRatio: 0, // Force horizontal only
                minRotation: 0,
                maxRotation: 0,
                shuffle: false,
                clearCanvas: true
            });
        } catch (e) {
            console.error('[Charts] WordCloud rendering error:', e);
        }
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
        scales: {
            x: {
                ticks: { color: '#4B5563' },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            y: {
                ticks: { color: '#4B5563' },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            }
        },
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

    createChartCanvas(container, 'statusChart', '狀態分佈', 'pie', {
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
            legend: {
                labels: { color: '#4B5563' }
            },
            datalabels: {
                color: '#4B5563',
                formatter: (value, ctx) => {
                    let sum = 0;
                    let dataArr = ctx.chart.data.datasets[0].data;
                    dataArr.map(data => {
                        sum += data;
                    });
                    let percentage = (value * 100 / sum).toFixed(1) + "%";
                    return percentage;
                },
                font: {
                    weight: 'bold',
                    size: 14
                }
            },
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
    }, [ChartDataLabels]); // Pass plugin explicitly
}

function renderCategoryChart(data, container) {
    const categoryCounts = {};
    data.forEach(item => {
        const categories = item.properties.歸屬分類 || [];
        categories.forEach(c => {
            categoryCounts[c] = (categoryCounts[c] || 0) + 1;
        });
    });

    const categoryLabels = Object.keys(categoryCounts);
    if (categoryLabels.length === 0) return;

    // Generate unique colors for each category
    const colors = generateUniquePalette(categoryLabels.length);

    createChartCanvas(container, 'categoryChart', '分析領域分佈', 'doughnut', {
        labels: categoryLabels,
        datasets: [{
            data: Object.values(categoryCounts),
            backgroundColor: colors,
            borderWidth: 0
        }]
    }, {
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#4B5563',
                    font: { size: 12 },
                    padding: 15
                }
            }
        }
    });
}

/**
 * Generates a palette of unique HSL colors
 */
function generateUniquePalette(count) {
    const colors = [];
    const hueStep = 360 / Math.max(count, 1);

    for (let i = 0; i < count; i++) {
        const hue = (i * hueStep) % 360;
        // Vary saturation and lightness slightly to avoid looking too uniform
        // but keep them high enough for visibility in dark mode
        const saturation = 70 + (i % 2) * 10; // 70% or 80%
        const lightness = 60 + (i % 3) * 5;   // 60%, 65%, 70%
        colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`);
    }
    return colors;
}

function createChartCanvas(container, id, title, type, chartData, options = {}, plugins = []) {
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
        plugins: plugins, // Support for ChartDataLabels
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#4B5563', font: { size: 10 } }
                }
            },
            ...options
        }
    });
}
