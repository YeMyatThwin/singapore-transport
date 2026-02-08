const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// LTA DataMall API Configuration
const LTA_API_BASE = 'https://datamall2.mytransport.sg/ltaodataservice';

// Load all available LTA API keys from environment variables
function loadLtaApiKeys() {
    const keys = [];
    
    // Primary key
    if (process.env.LTA_DATAMALL_API_KEY) {
        keys.push(process.env.LTA_DATAMALL_API_KEY);
    }
    
    // Backup keys (LTA_DATAMALL_API_KEY_2, LTA_DATAMALL_API_KEY_3, etc.)
    for (let i = 2; i <= 10; i++) {
        const key = process.env[`LTA_DATAMALL_API_KEY_${i}`];
        if (key) {
            keys.push(key);
        } else {
            break; // Stop if there's a gap in the numbering
        }
    }
    
    return keys;
}

const LTA_API_KEYS = loadLtaApiKeys();
let currentKeyIndex = 0; // Track which key is currently in use

/**
 * Helper function to make LTA API requests using axios with fallback to backup keys
 */
async function ltaApiRequest(endpoint, params = {}, retryCount = 0) {
    if (LTA_API_KEYS.length === 0) {
        throw new Error('No LTA API keys configured');
    }

    const url = `${LTA_API_BASE}${endpoint}`;
    const currentKey = LTA_API_KEYS[currentKeyIndex];
    
    try {
        const response = await axios.get(url, {
            params: params,
            headers: {
                'AccountKey': currentKey,
                'accept': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const isRateLimitError = status === 429;
        const isUnauthorizedError = status === 401 || status === 403;
        const shouldRetryWithNextKey = isRateLimitError || isUnauthorizedError;

        // If current key failed due to rate limit or auth issues, try next key
        if (shouldRetryWithNextKey && currentKeyIndex < LTA_API_KEYS.length - 1) {
            console.warn(`LTA API key #${currentKeyIndex + 1} failed (${status}), retrying with next key`);
            currentKeyIndex++;
            return ltaApiRequest(endpoint, params, retryCount + 1);
        }

        console.error('LTA API Request Error:', error.message);
        throw error;
    }
}

// API Routes

/**
 * Get bus arrival information for a specific bus stop
 * GET /api/bus-arrival?busStopCode=83139&serviceNo=15 (optional)
 */
app.get('/api/bus-arrival', async (req, res) => {
    const { busStopCode, serviceNo } = req.query;

    if (!busStopCode) {
        return res.status(400).json({ error: 'busStopCode parameter is required' });
    }

    try {
        const params = { BusStopCode: busStopCode };
        if (serviceNo) {
            params.ServiceNo = serviceNo;
        }
        
        const data = await ltaApiRequest('/v3/BusArrival', params);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bus arrival data', message: error.message });
    }
});

// Route for index.html with API key injected
app.get('/', (req, res) => {
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error loading page');
            return;
        }
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        const html = data.replace('API_KEY_PLACEHOLDER', apiKey);
        res.send(html);
    });
});

// Also handle /index.html
app.get('/index.html', (req, res) => {
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error loading page');
            return;
        }
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        const html = data.replace('API_KEY_PLACEHOLDER', apiKey);
        res.send(html);
    });
});

// Serve static files
app.use(express.static(path.join(__dirname)));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`LTA API Keys configured: ${LTA_API_KEYS.length}`);
    if (LTA_API_KEYS.length === 0) {
        console.warn('WARNING: No LTA API keys found in environment variables');
    }
});