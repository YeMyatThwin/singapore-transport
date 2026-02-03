const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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
});