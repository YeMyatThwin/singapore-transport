const express = require('express');
const path = require('path');
const arrivalRouter = require('./routes/arrival');
const configRouter = require('./routes/config');

const app = express();

// Middlewares
app.use(express.json());

// API Routes
app.use('/api/config', configRouter);
app.use('/api/bus-arrival', arrivalRouter);

// Safe Static Asset Serving (ONLY public directory is exposed, not root)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Safe Static Data Serving (with backward compatibility for Docker mounts)
const savedDataDir = path.join(__dirname, '..', 'saved-data');
app.use('/data', express.static(savedDataDir));
app.use('/saved-data', express.static(savedDataDir));

// 404 Handler for unmatched routes
app.use((req, res) => {
    res.status(404).send('Not Found');
});

module.exports = app;
