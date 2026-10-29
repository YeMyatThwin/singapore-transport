# BusSin - Real-Time Singapore Bus Tracker

A mobile-first web application for real-time Singapore bus tracking, arrival predictions, and interactive bus stop discovery built with **Mapbox GL JS** and **LTA DataMall API**.

![BusSin Logo](public/assets/img/bussin_logo.png)

## Features

- 🗺️ **Interactive Vector Map** - Smooth Mapbox GL JS integration with user geolocation and follow tracking.
- 🚏 **Bus Stop Discovery** - Dynamic nearby bus stop rendering with smooth spring-in animations and adaptive marker scaling based on zoom level.
- 🔍 **Instant Search** - Debounced modal search supporting road names, descriptions, and 5-digit bus stop codes.
- ⏱️ **Live Arrival Timings** - Accurate countdowns for incoming buses, auto-refreshing every 30 seconds with 1-second countdown tickers.
- 🚌 **Bus Capacity & Deck Type** - Real-time seat availability tags (*Seats Available*, *Standing Available*, *Crowded*) and vector icons for Single Deck, Double Deck, and Bendy buses.
- 📱 **Mobile Gesture Bottom Sheet** - Touch & mouse drag-to-dismiss bottom sheet drawer with responsive desktop sidebar view.
- 🔄 **LTA API Key Failover** - Automatic multi-key fallback rotation in the backend proxy when an LTA account key is rate-limited (429) or unauthorized (401/403).

---

## Project Structure

```text
.
├── server/                         # Backend Express application
│   ├── app.js                      # Express configuration & safe static routes
│   ├── config.js                   # Environment & API key loader
│   ├── routes/
│   │   ├── arrival.js              # GET /api/bus-arrival proxy endpoint
│   │   └── config.js               # GET /api/config (safe Mapbox token delivery)
│   └── services/
│       └── ltaService.js           # LTA DataMall client with key rotation fallback
│
├── public/                         # Clean, isolated client-side assets
│   ├── index.html                  # Semantic, minimal HTML (no inline SVGs)
│   ├── assets/
│   │   ├── icons/                  # Extracted SVG icons & SVG sprite sheet
│   │   │   ├── bus-sd.svg          # Single-deck bus icon
│   │   │   ├── bus-dd.svg          # Double-deck bus icon
│   │   │   ├── bus-bd.svg          # Bendy bus icon
│   │   │   ├── marker-normal.svg   # Bus stop pole marker
│   │   │   ├── marker-active.svg   # Selected bus stop pin
│   │   │   ├── search.svg          # Magnifying glass icon
│   │   │   ├── clear.svg           # Clear input icon
│   │   │   ├── refresh.svg         # Animated refresh icon
│   │   │   └── sprite.svg          # Master SVG sprite sheet (<symbol>)
│   │   └── img/
│   │       ├── favicon.png         # Lightweight 32x32 favicon
│   │       ├── bussin_logo.png     # Optimized app logo
│   │       └── Singapore_Bus_logo.svg
│   ├── css/                        # Modular stylesheet system
│   │   ├── variables.css           # Design tokens, colors & typography
│   │   ├── base.css                # Reset and core page styles
│   │   ├── map.css                 # Mapbox container & marker animations
│   │   ├── bottom-sheet.css        # Arrival cards, drawer gestures & icons
│   │   ├── search.css              # Modal overlay, input & autocomplete list
│   │   └── style.css               # Unified style aggregator
│   └── js/                         # Native ES Modules (no bundler required)
│       ├── app.js                  # Main app coordinator
│       ├── config.js               # Runtime configuration fetcher
│       ├── components/
│       │   ├── bottomSheet.js      # Drawer gestures, timers & arrival cards
│       │   ├── icons.js            # Sprite reference helpers
│       │   ├── markers.js          # Mapbox bus stop marker lifecycle
│       │   └── search.js           # Search modal, debounce & arrow navigation
│       ├── services/
│       │   └── busArrival.js       # Client API client
│       └── utils/
│           ├── formatters.js       # Time, html escaping & debounce utils
│           └── geo.js              # Geolocation & Haversine distance calculations
│
├── saved-data/                     # Offline bus stop dataset
│   ├── bus_stops_singapore.json    # Full Singapore bus stops catalog (~5,000 stops)
│   └── fetch_bus_stops.js          # Script to update/fetch bus stops from LTA DataMall
│
├── docs/                           # Deployment & DevOps documentation
│   ├── deployment-guide.md         # Google Cloud VM setup
│   ├── nginx-proxy-setup.md        # Nginx reverse proxy configuration
│   └── docker-clean-restart.md     # Docker maintenance steps
│
├── server.js                       # Root server entry point
├── Dockerfile                      # Production container image definition
├── docker-compose.yml              # Multi-container orchestration
└── package.json
```

---

## Setup & Running Locally

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Mapbox Access Token**: Free token from [Mapbox Console](https://account.mapbox.com/)
- **LTA DataMall API Key**: Free key from [LTA DataMall](https://datamall.lta.gov.sg/)

### 2. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# Mapbox token for map tiles and geolocation
MAPBOX_ACCESS_TOKEN=your_mapbox_public_token

# Primary LTA DataMall Key
LTA_DATAMALL_API_KEY=your_primary_lta_account_key

# Optional: Backup keys for automatic failover
LTA_DATAMALL_API_KEY_2=your_backup_lta_key_2
LTA_DATAMALL_API_KEY_3=your_backup_lta_key_3

PORT=3000
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Server
For development (auto-reload with nodemon):
```bash
npm run dev
```

For production:
```bash
npm start
```
Access the application at `http://localhost:3000`.

### 5. Updating Bus Stops Data
Whenever LTA updates routes or adds new bus stops, refresh the offline catalog by running:
```bash
npm run update:bus-stops
# OR
node saved-data/fetch_bus_stops.js
```
This automatically queries the LTA DataMall API in 500-record batches and updates `saved-data/bus_stops_singapore.json` (while saving a `.bak` backup of the previous version).

---

## Docker Deployment

To build and run the production container:

```bash
docker compose up -d --build
```

View server logs:
```bash
docker compose logs -f
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Returns safe client configuration (`{ mapboxToken }`) |
| `GET` | `/api/bus-arrival?busStopCode=:code` | Proxies request to LTA DataMall `/v3/BusArrival` with key failover |
| `GET` | `/data/bus_stops_singapore.json` | Serves the cached Singapore bus stops dataset |
