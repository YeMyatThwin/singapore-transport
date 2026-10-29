/**
 * Singapore LTA DataMall Bus Stops Fetcher
 *
 * Fetches all bus stops across Singapore via the LTA DataMall v3 API
 * paginated in chunks of 500, and writes them to bus_stops_singapore.json.
 *
 * Usage:
 *   node saved-data/fetch_bus_stops.js
 *   OR
 *   npm run update:bus-stops
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load environment variables from project root .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LTA_API_URL = 'https://datamall2.mytransport.sg/ltaodataservice/BusStops';
const OUTPUT_FILE = path.join(__dirname, 'bus_stops_singapore.json');
const BACKUP_FILE = path.join(__dirname, 'bus_stops_singapore.json.bak');
const PAGE_SIZE = 500;
const DELAY_BETWEEN_PAGES_MS = 250; // Gentle pacing to respect rate limits

// Collect all configured API keys for fallback rotation
function loadApiKeys() {
    const keys = [];
    if (process.env.LTA_DATAMALL_API_KEY) {
        keys.push(process.env.LTA_DATAMALL_API_KEY);
    }
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

const API_KEYS = loadApiKeys();
let currentKeyIndex = 0;

if (API_KEYS.length === 0) {
    console.error('❌ Error: No LTA_DATAMALL_API_KEY found in .env file.');
    console.error('Please configure your LTA DataMall AccountKey in .env before running this script.');
    process.exit(1);
}

console.log(`🔑 Loaded ${API_KEYS.length} LTA API key(s) from .env`);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(skip) {
    const key = API_KEYS[currentKeyIndex];

    try {
        const response = await axios.get(LTA_API_URL, {
            params: { $skip: skip },
            headers: {
                AccountKey: key,
                accept: 'application/json'
            },
            timeout: 15000
        });

        return response.data?.value || [];
    } catch (error) {
        const status = error.response?.status;
        const isRateLimit = status === 429;
        const isAuthError = status === 401 || status === 403;

        // Try next backup key if available
        if ((isRateLimit || isAuthError) && currentKeyIndex < API_KEYS.length - 1) {
            console.warn(`⚠️ Key #${currentKeyIndex + 1} failed (${status || error.message}), switching to key #${currentKeyIndex + 2}...`);
            currentKeyIndex++;
            return fetchPage(skip);
        }

        throw new Error(`LTA API failed at skip=${skip} (Status ${status || error.message})`);
    }
}

async function main() {
    console.log('🚀 Starting Singapore bus stops extraction from LTA DataMall...\n');
    const startTime = Date.now();
    const allStops = [];
    let skip = 0;
    let page = 1;

    try {
        while (true) {
            process.stdout.write(`Fetching page ${page} (records ${skip} to ${skip + PAGE_SIZE})... `);
            const stops = await fetchPage(skip);

            if (!stops || stops.length === 0) {
                console.log('Done! (No more records)');
                break;
            }

            allStops.push(...stops);
            console.log(`Received ${stops.length} stops (Total so far: ${allStops.length})`);

            // If fewer than PAGE_SIZE records were returned, this was the final page
            if (stops.length < PAGE_SIZE) {
                console.log('Reached end of dataset.');
                break;
            }

            skip += PAGE_SIZE;
            page++;
            await sleep(DELAY_BETWEEN_PAGES_MS);
        }

        console.log(`\n✅ Extraction complete! Total bus stops retrieved: ${allStops.length}`);

        // Format data to match app's expected structure
        const outputData = {
            value: allStops,
            total: allStops.length
        };

        // Create backup of existing file if present
        if (fs.existsSync(OUTPUT_FILE)) {
            fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
            console.log(`📦 Created backup of previous dataset at: ${path.basename(BACKUP_FILE)}`);
        }

        // Write formatted JSON
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), 'utf8');
        const fileStats = fs.statSync(OUTPUT_FILE);
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`💾 Saved to: ${OUTPUT_FILE}`);
        console.log(`📊 File size: ${(fileStats.size / 1024).toFixed(1)} KB`);
        console.log(`⏱️ Completed in ${durationSec}s`);
    } catch (error) {
        console.error(`\n❌ Extraction failed:`, error.message);
        process.exit(1);
    }
}

main();
