const app = require('./server/app');
const config = require('./server/config');
const ltaService = require('./server/services/ltaService');

const server = app.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
    console.log(`LTA API Keys configured: ${ltaService.getKeyCount()}`);

    if (ltaService.getKeyCount() === 0) {
        console.warn('WARNING: No LTA API keys found in environment variables');
    }
    if (!config.mapboxToken) {
        console.warn('WARNING: MAPBOX_ACCESS_TOKEN is not set');
    }
});

module.exports = server;
