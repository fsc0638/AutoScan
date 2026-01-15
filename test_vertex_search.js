const { ConversationalSearchServiceClient } = require('@google-cloud/discoveryengine');
const path = require('path');

// Configuration
const CONFIG = {
    projectId: 'sapient-depot-359605',
    location: 'global',
    dataStoreId: 'AQ.Ab8RN6IMCWDEX4-09c0d87GDs9qzIaM_D_Hj5ETU0czyDSJfJw', // Using the ID provided as DataStore/App ID
    keyFile: path.join(__dirname, 'service-account-key.json')
};

async function testDiscoveryEngine() {
    console.log('Testing connection to Vertex AI Agent (Discovery Engine)...');

    try {
        const client = new ConversationalSearchServiceClient({
            keyFilename: CONFIG.keyFile,
            apiEndpoint: `${CONFIG.location}-discoveryengine.googleapis.com`
        });

        // Manually construct the parent path
        // Pattern: projects/{project}/locations/{location}/dataStores/{data_store_id}
        const parent = `projects/${CONFIG.projectId}/locations/${CONFIG.location}/dataStores/${CONFIG.dataStoreId}`;

        console.log('Attempting to create conversation under:', parent);

        // 1. Create Conversation
        const conversationRequest = {
            parent: parent,
            conversation: {
                userPseudoId: 'test-user-123'
            }
        };

        const [conversation] = await client.createConversation(conversationRequest);
        console.log('✅ Conversation Created:', conversation.name);

        // 2. Send Message
        const converseRequest = {
            name: conversation.name,
            query: {
                input: 'Hello, what can you do?'
            }
        };

        const [response] = await client.converseConversation(converseRequest);

        console.log('✅ Converse Response:');
        console.log(JSON.stringify(response.reply, null, 2));

    } catch (error) {
        console.error('❌ Discovery Engine Error:', error);
        if (error.code === 3) {
            console.log('💡 Tip: INVALID_ARGUMENT (3) often means the ID is wrong, or the location is wrong, or it is not a "Data Store" but an "Engine" or "App".');
        }
    }
}

testDiscoveryEngine();
