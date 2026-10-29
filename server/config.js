const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
            break;
        }
    }

    return keys;
}

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mapboxToken: process.env.MAPBOX_ACCESS_TOKEN || '',
    ltaApiBase: 'https://datamall2.mytransport.sg/ltaodataservice',
    ltaApiKeys: loadLtaApiKeys()
};
