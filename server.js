const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

// Enable CORS and JSON parsing with increased limit
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// Serve static files from the project root
app.use(express.static(__dirname));

/**
 * Proxy for OpenAI API
 */
app.post(/^\/api\/openai\/(.*)/, async (req, res) => {
    const targetUrl = `https://api.openai.com/${req.params[0]}`;
    const apiKey = req.headers['authorization'];
    console.log(`[Server] Proxying OpenAI request to: ${targetUrl}`);
    console.log(`[Server] OpenAI-Beta header: ${req.headers['openai-beta']}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json',
                'OpenAI-Beta': req.headers['openai-beta'] || ''
            },
            body: JSON.stringify(req.body)
        });

        console.log(`[Server] OpenAI Response Status: ${response.status}`);

        const contentType = response.headers.get('content-type');
        console.log(`[Server] Response Content-Type: ${contentType}`);

        const data = await response.json();

        if (!response.ok) {
            console.error('[Server] OpenAI API Error:', JSON.stringify(data, null, 2));
        }

        res.status(response.status).json(data);
    } catch (error) {
        console.error('[Server] OpenAI Proxy Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

/**
 * Proxy for OpenAI API - GET requests
 */
app.get(/^\/api\/openai\/(.*)/, async (req, res) => {
    const targetUrl = `https://api.openai.com/${req.params[0]}`;
    const apiKey = req.headers['authorization'];
    console.log(`[Server] Proxying OpenAI GET request to: ${targetUrl}`);
    console.log(`[Server] OpenAI-Beta header: ${req.headers['openai-beta']}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Authorization': apiKey,
                'OpenAI-Beta': req.headers['openai-beta'] || ''
            }
        });

        console.log(`[Server] OpenAI Response Status: ${response.status}`);

        const contentType = response.headers.get('content-type');
        console.log(`[Server] Response Content-Type: ${contentType}`);

        const data = await response.json();

        if (!response.ok) {
            console.error('[Server] OpenAI API Error:', JSON.stringify(data, null, 2));
        }

        res.status(response.status).json(data);
    } catch (error) {
        console.error('[Server] OpenAI GET Proxy Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});


/**
 * Proxy for Gemini API
 */
app.post(/^\/api\/gemini\/(.*)/, async (req, res) => {
    const targetUrl = `https://generativelanguage.googleapis.com/${req.params[0]}?key=${req.query.key}`;
    console.log(`[Server] Proxying Gemini request to: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * Proxy for Notion DataBase Info
 */
app.get('/api/notion/database/:id', async (req, res) => {
    const databaseId = req.params.id;
    const token = req.headers['authorization'];

    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Notion-Version': '2022-06-28'
            }
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * Proxy for Notion API to bypass CORS
 */
app.post('/api/notion', async (req, res) => {
    const { token, databaseId, title, children, propertyName = 'Name' } = req.body;

    if (!token || !databaseId) {
        return res.status(400).json({ message: 'Missing Notion token or databaseId' });
    }

    try {
        console.log(`[Server] Proxying Notion upload for: ${title} (Property: ${propertyName})`);

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties: {
                    [propertyName]: {
                        title: [
                            { text: { content: title } }
                        ]
                    }
                },
                children: children
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Server] Notion API Error:', data);
            return res.status(response.status).json(data);
        }

        console.log('[Server] Notion Upload Success!');
        res.json(data);
    } catch (error) {
        console.error('[Server] Internal Error:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * Proxy for structured Notion data upload (multi-field support)
 */
/**
 * Calculate Levenshtein Distance between two strings
 */
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0 to 1)
 */
function calculateSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const longer = s1.length > s2.length ? s1 : s2;
    if (longer.length === 0) return 1.0;
    return (longer.length - levenshteinDistance(s1, s2)) / longer.length;
}

/**
 * Proxy for structured Notion data upload (multi-field support) with Upsert Logic
 */
app.post('/api/notion/structured', async (req, res) => {
    const { token, databaseId, properties } = req.body;

    if (!token || !databaseId || !properties) {
        return res.status(400).json({ message: 'Missing required fields: token, databaseId, or properties' });
    }

    try {
        console.log(`[Server] Processing Notion request with Upsert logic...`);

        // 1. Identify the Title property
        let titleKey = null;
        let titleValue = '';

        for (const [key, value] of Object.entries(properties)) {
            if (value.title) {
                titleKey = key;
                // Extract plain text from title array
                titleValue = value.title.map(t => t.text?.content || '').join('');
                break;
            }
        }

        if (!titleKey || !titleValue) {
            console.log('[Server] No title property found in request, proceeding with standard INSERT.');
        } else {
            console.log(`[Server] Target Title: "${titleValue}"`);

            // 2. Fetch recent pages from Notion DB for fuzzy matching
            console.log('[Server] Querying Notion DB for potential duplicates...');
            const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    page_size: 100, // Check last 100 items
                    sorts: [{ timestamp: 'created_time', direction: 'descending' }]
                })
            });

            if (queryResponse.ok) {
                const queryData = await queryResponse.json();
                let bestMatch = null;
                let maxSimilarity = 0;

                for (const page of queryData.results) {
                    // Extract title from page properties
                    // Note: accessing dynamic title property can be tricky if name differs
                    // We assume the schema matches or we look for type 'title'
                    let pageTitle = '';
                    const pageProps = page.properties;

                    // Find title property in page
                    for (const propVal of Object.values(pageProps)) {
                        if (propVal.type === 'title' && propVal.title) {
                            pageTitle = propVal.title.map(t => t.plain_text).join('');
                            break;
                        }
                    }

                    if (pageTitle) {
                        const similarity = calculateSimilarity(titleValue, pageTitle);
                        if (similarity > maxSimilarity) {
                            maxSimilarity = similarity;
                            bestMatch = page;
                        }
                    }
                }

                console.log(`[Server] Max Similarity found: ${(maxSimilarity * 100).toFixed(1)}%`);

                // 3. Decide: Update or Insert?
                if (bestMatch && maxSimilarity >= 0.5) {
                    console.log(`[Server] Duplicate found! Updating page ID: ${bestMatch.id}`);

                    // Perform UPDATE (PATCH)
                    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${bestMatch.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Notion-Version': '2022-06-28'
                        },
                        body: JSON.stringify({
                            properties: properties // Update all properties
                        })
                    });

                    const updateData = await updateResponse.json();
                    if (!updateResponse.ok) throw new Error(`Notion Update Error: ${JSON.stringify(updateData)}`);

                    console.log('[Server] Notion Update Success!');
                    return res.json({ ...updateData, _action: 'updated', _similarity: maxSimilarity });
                }
            } else {
                console.warn('[Server] Failed to query Notion DB, falling back to INSERT.');
            }
        }

        // 4. Default: Insert new page (POST)
        console.log('[Server] Creating NEW page in Notion...');
        const createResponse = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties: properties
            })
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
            console.error('[Server] Notion API Error:', createData);
            return res.status(createResponse.status).json(createData);
        }

        console.log('[Server] Structured Notion Upload Success (Created)!');
        res.json({ ...createData, _action: 'created' });

    } catch (error) {
        console.error('[Server] Internal Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================
// Vertex AI Agent Integration (Isolated Module)
// ============================================

const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');

// Load Service Account for Vertex AI
let vertexAuth = null;
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account-key.json');

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    vertexAuth = new GoogleAuth({
        keyFilename: SERVICE_ACCOUNT_PATH,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    console.log('[Server] Vertex AI Service Account loaded');
} else {
    console.warn('[Server] No service-account-key.json found, Vertex AI Agent will not work');
}

/**
 * Vertex AI Agent Query Endpoint
 * POST /api/vertex-agent/query
 */
app.post('/api/vertex-agent/query', async (req, res) => {
    console.log('[Server] Vertex Agent query received');

    const { query, projectId, location, engineId, dataStoreId } = req.body;

    if (!query || !projectId || !engineId) {
        return res.status(400).json({ message: 'Missing required fields: query, projectId, engineId' });
    }

    if (!vertexAuth) {
        return res.status(500).json({ message: 'Vertex AI Service Account not configured' });
    }

    try {
        // Get access token
        const client = await vertexAuth.getClient();
        const accessToken = await client.getAccessToken();

        // Vertex AI Agent Builder - Conversational Search API
        // Reference: https://cloud.google.com/generative-ai-app-builder/docs/reference/rest/v1beta/projects.locations.dataStores.conversations/converse
        // Using dataStores endpoint instead of engines
        const apiUrl = `https://discoveryengine.googleapis.com/v1beta/projects/${projectId}/locations/${location}/collections/default_collection/dataStores/${dataStoreId}/conversations/-:converse`;

        console.log('[Server] Calling Vertex Agent API:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: {
                    input: query
                },
                // Request structured output if possible
                summarySpec: {
                    summaryResultCount: 5,
                    includeCitations: false
                },
                // Use the agent's grounding capability
                safeSearch: false
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Server] Vertex Agent API Error:', JSON.stringify(data, null, 2));
            return res.status(response.status).json(data);
        }

        console.log('[Server] Vertex Agent API Success');
        console.log('[Server] Response:', JSON.stringify(data, null, 2));

        // Extract reply from conversational response
        const reply = data.reply?.reply || data.reply?.summary?.summaryText || data.reply || '';

        res.json({
            answer: reply,
            conversationId: data.conversation?.name,
            raw: data
        });

    } catch (error) {
        console.error('[Server] Vertex Agent Error:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * Vertex AI Agent Health Check
 * GET /api/vertex-agent/health
 */
app.get('/api/vertex-agent/health', async (req, res) => {
    if (!vertexAuth) {
        return res.status(503).json({ status: 'unavailable', message: 'Service Account not configured' });
    }

    try {
        const client = await vertexAuth.getClient();
        await client.getAccessToken();
        res.json({ status: 'ok', message: 'Vertex AI Agent is available' });
    } catch (error) {
        res.status(503).json({ status: 'error', message: error.message });
    }
});

/**
 * Cloud Storage Upload Endpoint (Placeholder)
 * POST /api/gcs/upload
 */
app.post('/api/gcs/upload', async (req, res) => {
    // TODO: Implement Cloud Storage upload
    // This requires user to provide bucket name
    res.status(501).json({
        message: 'Cloud Storage upload not yet configured. Please provide bucket name.',
        status: 'not_implemented'
    });
});

app.listen(PORT, () => {
    console.log(`
🚀 AutoScan Server is running!
----------------------------------
🔗 URL: http://localhost:${PORT}
📁 Dir: ${__dirname}
----------------------------------
Waiting for connections...
    `);
});
