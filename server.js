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
const LTA_API_KEY = process.env.LTA_DATAMALL_API_KEY;

/**
 * Helper function to make LTA API requests using axios
 */
async function ltaApiRequest(endpoint, params = {}) {
    const url = `${LTA_API_BASE}${endpoint}`;
    
    try {
        const response = await axios.get(url, {
            params: params,
            headers: {
                'AccountKey': LTA_API_KEY,
                'accept': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
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
    console.log(`LTA API Key configured: ${!!LTA_API_KEY}`);
});