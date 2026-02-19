# Weather System Setup Guide

## Quick Start

### 1. Prerequisites
- Google Maps API Key with the following APIs enabled:
  - Maps JavaScript API
  - Places API (for marker library)
- Modern web browser (Chrome, Safari, Firefox, Edge)
- Local web server (or use live-server, python http.server, etc.)

### 2. API Key Setup

Replace `API_KEY_PLACEHOLDER` in [index.html](index.html) with your Google Maps API key:

```html
<!-- Before -->
<script
  async
  src="https://maps.googleapis.com/maps/api/js?key=API_KEY_PLACEHOLDER&callback=initMap&libraries=marker"
></script>

<!-- After -->
<script
  async
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY&callback=initMap&libraries=marker"
></script>
```

### 3. Running the Application

#### Option A: Using Python HTTP Server
```bash
cd "/Users/riley/Documents/Portfolio/research/google map sdk test"
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

#### Option B: Using Node.js http-server
```bash
cd "/Users/riley/Documents/Portfolio/research/google map sdk test"
npx http-server -p 8000
# Open http://localhost:8000 in your browser
```

#### Option C: Using VS Code Live Server
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### 4. Verify Weather System

Once the app loads:

1. **Check Console** (F12 → Console tab)
   - Should see: "Initializing weather system..."
   - Should see: "Weather data fetched successfully"
   - Should see: "GeoJSON loaded, features: XX"

2. **Visual Verification**
   - Zoom out (zoom level ≤ 12): See weather icons and colored borders
   - Zoom in (zoom level > 12): Icons fade, animations appear

3. **Test Zoom Interaction**
   - Use mouse wheel or zoom controls
   - Watch the console for: "Zoom changed: X -> Y"
   - Observe smooth transitions

## Troubleshooting

### Weather Icons Not Showing

**Problem**: No weather icons visible on map

**Solutions**:
1. Check browser console for errors
2. Verify GeoJSON file exists: `MasterPlan2019PlanningAreaBoundaryNoSea.geojson`
3. Check NEA API is accessible:
   ```javascript
   // In browser console:
   fetch('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast')
     .then(r => r.json())
     .then(d => console.log(d))
   ```
4. Verify zoom level is ≤ 12

### CORS Errors

**Problem**: "Access to fetch... has been blocked by CORS policy"

**Solutions**:
1. Run through a local web server (not file://)
2. NEA API should allow cross-origin requests
3. Check browser console for specific error details

### GeoJSON Not Loading

**Problem**: Console shows "GeoJSON loaded, features: 0"

**Solutions**:
1. Verify file path in `app.js` line ~1248:
   ```javascript
   map.data.loadGeoJson('MasterPlan2019PlanningAreaBoundaryNoSea.geojson', ...)
   ```
2. Ensure GeoJSON file is in root directory
3. Check file is valid JSON (use JSONLint.com)

### Animations Not Appearing

**Problem**: Rain/cloud animations don't show when zoomed in

**Solutions**:
1. Zoom in past level 12
2. Check console: "Zoom changed: X -> Y"
3. Verify overlays created: "Creating overlay for [area]"
4. Check canvas element exists in DOM inspector

### Area Names Not Matching

**Problem**: Some areas have no weather data

**Solutions**:
1. NEA API may use different naming:
   ```javascript
   // Add logging in matchAreaNames() to debug:
   console.log(`Testing: ${geoJsonName} vs ${neaName}`);
   ```
2. Add custom mappings if needed:
   ```javascript
   const nameOverrides = {
     'WESTERN WATER CATCHMENT': 'Western Water Catchment',
     'CENTRAL WATER CATCHMENT': 'Central Water Catchment'
   };
   ```

## Testing Weather Scenarios

### Test Different Weather Conditions

The NEA API returns live data, so weather varies by time. To test different icons:

1. **Monitor Weather Changes**
   - Wait for actual weather to change
   - Refresh interval: every 5 minutes

2. **Manual Testing** (for development):
   Edit [app.js](js/app.js) `getWeatherIcon()` function temporarily:
   ```javascript
   function getWeatherIcon(forecast) {
       // Force specific icon for testing
       return WeatherIcons.rain();
   }
   ```

3. **Check Icon Types**:
   - ☀️ **Sun**: "Fair", "Fair (Day)", "Fair (Night)"
   - ☁️ **Cloud**: "Cloudy", "Partly Cloudy", "Overcast"
   - 🌧️ **Rain**: "Light Rain", "Moderate Rain", "Light Showers"
   - ⛈️ **Thunderstorm**: "Thundery Showers", "Heavy Thundery Showers"

## Performance Testing

### Check Refresh Rate
```javascript
// In browser console after app loads:
console.log('Weather refresh interval:', weatherRefreshInterval);

// Watch for "Refreshing weather data..." every 5 minutes
```

### Monitor Memory Usage

1. Open Chrome DevTools → Performance Monitor
2. Watch "JS heap size"
3. Should stabilize around 10-15MB for weather system

### Test Zoom Performance

1. Rapidly zoom in and out
2. Should see smooth transitions
3. Check console for any errors

## Advanced Configuration

### Change Zoom Threshold

In [app.js](js/app.js) line ~23:
```javascript
const ZOOM_THRESHOLD = 12;  // Change to 10, 11, 13, 14, etc.
```

### Adjust Refresh Rate

In [app.js](js/app.js) line ~1454:
```javascript
}, 5 * 60 * 1000);  // Change to: 
}, 10 * 60 * 1000); // 10 minutes
}, 2 * 60 * 1000);  // 2 minutes
```

### Customize Rain Density

In [app.js](js/app.js) `WeatherOverlay.animateRain()`:
```javascript
const numDrops = 50;  // Increase for heavier rain, decrease for lighter
```

### Modify Icon Colors

In [app.js](js/app.js) `WeatherIcons` object:
```javascript
sun: () => {
    // Change fill color:
    <circle cx="12" cy="12" r="5" fill="#FF6B00"/>  // Orange sun
}
```

## Development Checklist

Before deployment:

- [ ] Remove `console.log()` statements (or use production build)
- [ ] Replace API_KEY_PLACEHOLDER with actual key
- [ ] Test on multiple browsers
- [ ] Test on mobile devices
- [ ] Verify CORS headers for production domain
- [ ] Consider rate limiting for NEA API
- [ ] Add error boundaries for production
- [ ] Optimize GeoJSON file size if needed
- [ ] Add loading indicators for weather data
- [ ] Test with slow network conditions

## Example API Responses

### Successful Weather Fetch
```json
{
  "area_metadata": [
    {"name": "Ang Mo Kio", "label_location": {"latitude": 1.375, "longitude": 103.839}},
    {"name": "Bedok", "label_location": {"latitude": 1.321, "longitude": 103.924}}
  ],
  "items": [{
    "update_timestamp": "2026-02-19T14:05:12+08:00",
    "timestamp": "2026-02-19T14:00:00+08:00",
    "valid_period": {"start": "2026-02-19T14:00:00+08:00", "end": "2026-02-19T16:00:00+08:00"},
    "forecasts": [
      {"area": "Ang Mo Kio", "forecast": "Partly Cloudy"},
      {"area": "Bedok", "forecast": "Thundery Showers"}
    ]
  }]
}
```

## Browser Console Commands

Useful commands for debugging:

```javascript
// Check current zoom
console.log('Current zoom:', map.getZoom());

// Force zoom threshold check
handleWeatherZoomChange();

// Count weather markers
console.log('Markers:', weatherMarkers.length);

// Check weather data
console.log('Weather data:', weatherData);

// Force refresh
loadWeatherData();

// List all areas
map.data.forEach(f => console.log(f.getProperty('PLN_AREA_N')));
```

## Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| White screen | API key invalid | Check API key and billing |
| No weather icons | GeoJSON not loaded | Verify file path |
| Icons don't hide | Zoom listener not working | Check browser console |
| Slow performance | Too many overlays | Reduce rain density |
| Wrong colors | Forecast not matched | Check `getBorderColor()` |

## Production Deployment

For production environments:

1. **Environment Variables**:
   ```javascript
   const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;
   const NEA_API_URL = process.env.NEA_API_URL || 'https://api.data.gov.sg/...';
   ```

2. **Caching**:
   - Cache API responses using Service Workers
   - Store GeoJSON in LocalStorage
   - Implement offline fallback

3. **Error Tracking**:
   - Add Sentry or similar error tracking
   - Log API failures to analytics
   - Monitor performance metrics

4. **CDN**:
   - Host GeoJSON on CDN
   - Enable gzip compression
   - Use HTTP/2

## Support

If you encounter issues:

1. Check the [WEATHER_SYSTEM_DOCUMENTATION.md](WEATHER_SYSTEM_DOCUMENTATION.md)
2. Review browser console for error messages
3. Test with different browsers
4. Verify all files are in correct locations

---

**Happy Weather Tracking! 🌤️**
