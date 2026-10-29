const express = require('express');
const config = require('../config');

const router = express.Router();

/**
 * GET /api/config
 * Exposes safe public runtime configuration to client
 */
router.get('/', (req, res) => {
    res.json({
        mapboxToken: config.mapboxToken
    });
});

module.exports = router;
