const axios = require('axios');
const config = require('../config');

class LtaService {
    constructor() {
        this.apiBase = config.ltaApiBase;
        this.apiKeys = config.ltaApiKeys;
        this.currentKeyIndex = 0;
    }

    getKeyCount() {
        return this.apiKeys.length;
    }

    /**
     * Send request to LTA DataMall with automatic fallback rotation if key is rate-limited or invalid
     */
    async request(endpoint, params = {}, retryCount = 0) {
        if (this.apiKeys.length === 0) {
            throw new Error('No LTA API keys configured');
        }

        const url = `${this.apiBase}${endpoint}`;
        const currentKey = this.apiKeys[this.currentKeyIndex];

        try {
            const response = await axios.get(url, {
                params: params,
                headers: {
                    AccountKey: currentKey,
                    accept: 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const isRateLimitError = status === 429;
            const isUnauthorizedError = status === 401 || status === 403;
            const shouldRetryWithNextKey = isRateLimitError || isUnauthorizedError;

            // If current key failed, rotate to next backup key
            if (shouldRetryWithNextKey && this.currentKeyIndex < this.apiKeys.length - 1) {
                console.warn(
                    `LTA API key #${this.currentKeyIndex + 1} failed (${status}), retrying with next key...`
                );
                this.currentKeyIndex++;
                return this.request(endpoint, params, retryCount + 1);
            }

            console.error('LTA API Request Error:', error.message);
            throw error;
        }
    }

    async getBusArrival(busStopCode, serviceNo) {
        const params = { BusStopCode: busStopCode };
        if (serviceNo) {
            params.ServiceNo = serviceNo;
        }
        return this.request('/v3/BusArrival', params);
    }
}

module.exports = new LtaService();
