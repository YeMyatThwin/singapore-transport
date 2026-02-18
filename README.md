# Real-Time Location Tracker with Google Maps

A mobile-first web application for real-time location tracking with compass direction indicator and dark mode map.

## Features

- 🗺️ **Dark Mode Map** - Clean, minimal Google Maps with dark theme
- 📍 **Real-time Location Tracking** - Continuous 24/7 GPS tracking
- 🧭 **Compass Direction** - Flashlight-style beam showing direction you're facing
- 📱 **Mobile Optimized** - Fullscreen responsive design for mobile and desktop
- 🚏 **Custom Markers** - Bus stop markers with custom SVG icons
- 🎯 **Auto-center** - Automatically centers on your location on load
- 🔒 **Permission Handling** - Smart iOS and Android permission management

## Setup

1. **Get Google Maps API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select a project
   - Enable **Maps JavaScript API**
   - Create an API Key
   - Add API restrictions (HTTP referrers) for security

2. **Create Map ID** (required for Advanced Markers):
   - Go to [Maps Management](https://console.cloud.google.com/google/maps-apis/studio/maps)
   - Create Map ID (e.g., "Location Tracker")
   - Select "JavaScript" type
   - Copy the Map ID

3. **Configure the project**:
   ```bash
   # Replace API_KEY_PLACEHOLDER in index.html with your API key
   # Replace DEMO_MAP_ID in js/app.js with your Map ID
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Run the server**:
   ```bash
   npm start
   ```
   - Opens at `http://localhost:3000`
   - Uses nodemon for auto-restart during development

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# LTA DataMall API Keys (for Singapore bus data)
# Primary key
LTA_DATAMALL_API_KEY=your_primary_lta_key

# Backup keys (optional, for redundancy)
LTA_DATAMALL_API_KEY_2=your_backup_lta_key_1
LTA_DATAMALL_API_KEY_3=your_backup_lta_key_2
```

### Multiple LTA API Keys

The application supports **multiple LTA DataMall API keys** for redundancy:

- **Primary Key**: Uses `LTA_DATAMALL_API_KEY`
- **Backup Keys**: Can add unlimited backup keys using `LTA_DATAMALL_API_KEY_2`, `LTA_DATAMALL_API_KEY_3`, etc.
- **Auto-fallback**: If the current key fails with HTTP 401 (unauthorized) or 429 (rate limited), the app automatically switches to the next available key
- **Use Case**: Prevents service interruption if a key is banned, revoked, reaches daily limits, or experiences issues

The server logs which key failed and which one it's switching to:
```
LTA API key #1 failed (401), retrying with next key
```

#### Setup for Docker

If using Docker, update `docker-compose.yml` to include all backup keys:

```yaml
environment:
  - LTA_DATAMALL_API_KEY=${LTA_DATAMALL_API_KEY}
  - LTA_DATAMALL_API_KEY_2=${LTA_DATAMALL_API_KEY_2}
  - LTA_DATAMALL_API_KEY_3=${LTA_DATAMALL_API_KEY_3}
```

## Usage

### For Testing
- Open `https://localhost:3000` (HTTPS required for geolocation)
- Allow location and compass permissions when prompted
- Map centers on your location with blue dot
- Direction arrow shows where you're facing

### For Production
- Set up proper API key restrictions (HTTP referrers)
- Use environment variables for API key (not exposed in frontend)
- Deploy with HTTPS (required for geolocation API)

## Technologies

- Google Maps JavaScript API
- Advanced Marker Element for custom markers
- Geolocation API (GPS tracking)
- Device Orientation API (compass)
- Express.js (web server)
- Nodemon (development)

## Browser Compatibility

- ✅ **iOS Safari** - Requires user interaction for compass
- ✅ **Android Chrome** - Full support
- ⚠️ **Desktop** - Location works, compass may not (no sensors)
- ⚠️ **HTTP** - Geolocation requires HTTPS in production

## Security Note

⚠️ **API Key Exposure**: The current build exposes the API key in the frontend. For production:
- Use API key restrictions (HTTP referrers whitelist)
- Consider using a backend proxy to hide the key
- Monitor usage in Google Cloud Console
- Set up usage quotas to prevent abuse

## Project Structure

```
├── index.html          # Main HTML file
├── css/
│   └── style.css      # Styles (dark mode, markers, UI)
├── js/
│   └── app.js         # Map logic, tracking, permissions
├── server.js          # Express server
├── package.json       # Dependencies
└── README.md          # Documentation
```

## Troubleshooting

### Location not working
- Ensure HTTPS is enabled
- Check browser location permissions
- Verify device Location Services are on

### Compass not showing
- iOS: Click "My Location" button to trigger permission
- Android: Move device to activate magnetometer
- Desktop: Compass not available (no sensors)

### Map not loading
- Check API key is valid
- Verify Maps JavaScript API is enabled
- Check browser console for errors
- Ensure billing is set up in Google Cloud

## License

MIT