/**
 * AutoScan - Charting Component
 * 
 * Handles data visualization for analyzed key points.
 * Specifically designed to process structured data from AutoScan agent.
 */

window.initCharts = function (data) {
    console.log('[Charts] Initializing charts with data:', data);

    const chartsSection = document.getElementById('chartsSection');
    const container = document.getElementById('chartsContainer');

    if (!chartsSection || !container) return;

    // Clear previous charts
    container.innerHTML = '';

    // Determine data type
    const isStructured = data.length > 0 && typeof data[0] === 'object' && data[0].properties;

    if (!isStructured) {
        chartsSection.style.display = 'none';
        return;
    }

    chartsSection.style.display = 'block';

    // 1. Process Status Data
    renderStatusChart(data, container);

    // 2. Process Project Data
    renderProjectChart(data, container);

    // 3. Process Category Data
    renderCategoryChart(data, container);
};

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
