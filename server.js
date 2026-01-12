const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(bodyParser.json());

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
app.post('/api/notion/structured', async (req, res) => {
    const { token, databaseId, properties } = req.body;

    if (!token || !databaseId || !properties) {
        return res.status(400).json({ message: 'Missing required fields: token, databaseId, or properties' });
    }

    try {
        console.log(`[Server] Proxying structured Notion upload`);

        const response = await fetch('https://api.notion.com/v1/pages', {
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

        const data = await response.json();

        if (!response.ok) {
            console.error('[Server] Notion API Error:', data);
            return res.status(response.status).json(data);
        }

        console.log('[Server] Structured Notion Upload Success!');
        res.json(data);
    } catch (error) {
        console.error('[Server] Internal Error:', error);
        res.status(500).json({ message: error.message });
    }
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
