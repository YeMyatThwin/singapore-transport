const express = require('express');
const ltaService = require('../services/ltaService');

const router = express.Router();

/**
 * GET /api/bus-arrival?busStopCode=83139&serviceNo=15
 */
router.get('/', async (req, res) => {
    const { busStopCode, serviceNo } = req.query;

    if (!busStopCode) {
        return res.status(400).json({ error: 'busStopCode parameter is required' });
    }

    try {
        const data = await ltaService.getBusArrival(busStopCode, serviceNo);
        res.json(data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch bus arrival data',
            message: error.message
        });
    }
});

module.exports = router;
