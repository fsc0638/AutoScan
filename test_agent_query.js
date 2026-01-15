/**
 * Test script for Vertex AI Agent Query Endpoint
 * This simulates a frontend query to the agent
 */

const testQuery = `
今天我們開會討論了三個重要項目。
首先是Goonas合作案，凱衛負責在12月18日前完成簽約。
第二個是Q4財報發表會，財務部需要在12月2日前準備好簡報。
最後是台日產業交流活動，Jason要聯絡日方確認議程。
`;

const payload = {
    query: testQuery.trim(),
    projectId: '374299927578',
    location: 'global',
    engineId: 'agent-e7367a0c-99a2-4d87-9398-d535b394532a-search-engine',
    dataStoreId: 'autoscan-docs-store_1768371847989'
};

fetch('http://localhost:3000/api/vertex-agent/query', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
})
.then(response => {
    console.log('Response Status:', response.status);
    return response.json();
})
.then(data => {
    console.log('\n=== Vertex AI Agent Response ===');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.answer) {
        console.log('\n=== Answer Text ===');
        console.log(data.answer);
    }
})
.catch(error => {
    console.error('Error:', error);
});
