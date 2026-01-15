const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const path = require('path');

// Configuration
const AGENT_CONFIG = {
    projectId: 'sapient-depot-359605',
    location: 'global',
    agentId: '61e635b7-f51a-4f90-a604-8c2910a4cda6', // New UUID-style ID
    keyFile: path.join(__dirname, 'service-account-key.json')
};

async function testConnection() {
    console.log('Testing connection to Vertex AI Agent (Dialogflow CX)...');
    console.log('Config:', { ...AGENT_CONFIG, keyFile: AGENT_CONFIG.keyFile ? 'EXISTS' : 'MISSING' });

    try {
        const apiEndpoint = AGENT_CONFIG.location === 'global'
            ? 'dialogflow.googleapis.com'
            : `${AGENT_CONFIG.location}-dialogflow.googleapis.com`;

        const client = new SessionsClient({
            keyFilename: AGENT_CONFIG.keyFile,
            apiEndpoint: apiEndpoint
        });

        const sessionId = Math.random().toString(36).substring(7);
        const sessionPath = client.projectLocationAgentSessionPath(
            AGENT_CONFIG.projectId,
            AGENT_CONFIG.location,
            AGENT_CONFIG.agentId,
            sessionId
        );

        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: '你好', // Simple greeting in Chinese
                },
                languageCode: 'zh-TW',
            },
        };

        console.log(`Sending request to: ${sessionPath}`);
        const [response] = await client.detectIntent(request);

        console.log('--------------------------------------------------');
        console.log('✅ Connection Successful!');

        const responseMessages = response.queryResult?.responseMessages || [];
        responseMessages.forEach(msg => {
            if (msg.text) {
                console.log('Agent Response:', msg.text.text.join(' '));
            }
        });
        console.log('--------------------------------------------------');

    } catch (error) {
        console.error('❌ Connection Failed:', error);
    }
}

testConnection();
