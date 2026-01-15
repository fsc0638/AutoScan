const { AgentsClient } = require('@google-cloud/dialogflow-cx');
const path = require('path');

const CONFIG = {
    projectId: 'sapient-depot-359605',
    keyFile: path.join(__dirname, 'service-account-key.json')
};

async function listAgents() {
    console.log('Listing Agents for project:', CONFIG.projectId);

    const locations = ['global', 'us-central1'];

    for (const location of locations) {
        console.log(`\nChecking location: ${location}...`);
        try {
            const apiEndpoint = location === 'global'
                ? 'dialogflow.googleapis.com'
                : `${location}-dialogflow.googleapis.com`;

            const client = new AgentsClient({
                keyFilename: CONFIG.keyFile,
                apiEndpoint: apiEndpoint
            });

            const parent = `projects/${CONFIG.projectId}/locations/${location}`;
            const [agents] = await client.listAgents({ parent });

            if (agents.length === 0) {
                console.log(`No agents found in ${location}.`);
            } else {
                console.log(`✅ Found ${agents.length} agents in ${location}:`);
                agents.forEach(agent => {
                    console.log(`- Name: ${agent.displayName}`);
                    console.log(`  ID: ${agent.name}`); // This contains the full path including ID
                });
            }

        } catch (error) {
            console.error(`Error checking ${location}:`, error.message);
        }
    }
}

listAgents();
