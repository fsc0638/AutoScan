const { DataStoreServiceClient, EngineServiceClient } = require('@google-cloud/discoveryengine');
const path = require('path');

const CONFIG = {
    projectId: 'sapient-depot-359605',
    keyFile: path.join(__dirname, 'service-account-key.json')
};

async function listResources() {
    console.log('Listing Discovery Engine Resources for project:', CONFIG.projectId);

    // Check both global and us-central1
    const locations = ['global', 'us-central1'];

    for (const location of locations) {
        console.log(`\n----------------------------------------`);
        console.log(`Checking location: ${location}...`);
        console.log(`----------------------------------------`);

        const apiEndpoint = `${location}-discoveryengine.googleapis.com`;

        // 1. Check Data Stores (Standard)
        try {
            console.log(`[1] Listing Data Stores (Collection: default_collection)...`);
            const dsClient = new DataStoreServiceClient({ keyFilename: CONFIG.keyFile, apiEndpoint });

            // Manual Path
            const parent = `projects/${CONFIG.projectId}/locations/${location}/collections/default_collection`;
            const [dataStores] = await dsClient.listDataStores({ parent });

            if (dataStores.length === 0) {
                console.log('   No Data Stores found in default_collection.');
            } else {
                console.log(`✅ Found ${dataStores.length} Data Stores:`);
                dataStores.forEach(ds => {
                    console.log(`   - Name: ${ds.displayName}`);
                    console.log(`     ID: ${ds.name.split('/').pop()}`); // Extract the ID
                    console.log(`     Full Path: ${ds.name}`);
                });
            }
        } catch (error) {
            console.log(`   (Skipping DataStores for ${location}: ${error.message})`);
        }

        // 2. Check Engines (Apps)
        try {
            console.log(`\n[2] Listing Engines (Apps)...`);
            const engineClient = new EngineServiceClient({ keyFilename: CONFIG.keyFile, apiEndpoint });

            // Manual Path
            const parent = `projects/${CONFIG.projectId}/locations/${location}/collections/default_collection`;
            const [engines] = await engineClient.listEngines({ parent });

            if (engines.length === 0) {
                console.log('   No Engines found in default_collection.');
            } else {
                console.log(`✅ Found ${engines.length} Engines:`);
                engines.forEach(eng => {
                    console.log(`   - Name: ${eng.displayName}`);
                    console.log(`     ID: ${eng.name.split('/').pop()}`);
                    console.log(`     Full Path: ${eng.name}`);
                });
            }
        } catch (error) {
            console.log(`   (Skipping Engines for ${location}: ${error.message})`);
        }
    }
}

listResources();
