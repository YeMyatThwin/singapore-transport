# Weather Badge Debugging Guide

## 🚨 Issue: Weather Badge Not Showing on Blue Dot

If the weather badge (weather icon above your blue dot) is not appearing, follow these debugging steps:

## ✅ Quick Fix Steps

### 1. Open Browser Console (F12)

### 2. Run Debug Command
```javascript
debugWeather()
```

This will show:
- ✅ Whether weather data is loaded
- ✅ Whether user location marker exists  
- ✅ Whether weather badge element exists
- ✅ Your current position
- ✅ Which planning area you're in
- ✅ GeoJSON loading status

### 3. Check Console Output

**Expected Output:**
```
===== WEATHER DEBUG INFO =====
Weather data loaded: true
User location marker: true
User weather badge: true
Current user area: {name: "Kallang", forecast: "Thundery Showers", ...}
User position: {lat: 1.3105, lng: 103.8565}
🔍 Checking location: 1.3105, 103.8565
✓ Found containing area: Kallang (forecast: Thundery Showers)
✅ User location weather updated: Kallang - Thundery Showers
GeoJSON features: 55, with forecast: 45
============================
```

**Problem Indicators:**
- ❌ `Weather data loaded: false` → Weather API not fetched yet
- ❌ `User location marker: false` → GPS not enabled
- ❌ `User weather badge: false` → Badge element not created
- ❌ `Found area: null` → Not in any planning area or GeoJSON not loaded

## 🔧 Common Issues & Fixes

### Issue 1: Weather Data Not Loaded
**Symptoms:**
- `Weather data loaded: false`
- Warning: `⚠️ Weather data not loaded yet`

**Fix:**
```javascript
// Wait a few seconds for weather to load, then retry
setTimeout(() => debugWeather(), 5000);
```

### Issue 2: Badge Element Missing
**Symptoms:**
- `User weather badge: false`
- Badge was `null` in debug output

**Fix:**
```javascript
// Badge will be created automatically on next update
// Force a location update:
if (userLocationMarker) {
    const pos = userLocationMarker.position;
    updateUserLocationWeather(pos);
}
```

### Issue 3: Not in Any Planning Area
**Symptoms:**
- `✗ Not in any area (checked X features)`
- `⚠️ User not in any mapped area`

**Possible Causes:**
1. **You're in the sea/water** - Planning areas only cover land
2. **GeoJSON not loaded** - Check: `GeoJSON features: 0`
3. **Outside Singapore** - Only Singapore planning areas are mapped

**Fix:**
```javascript
// Check if GeoJSON loaded
let count = 0;
map.data.forEach(() => count++);
console.log('Features loaded:', count); // Should be ~55

// If 0, reload:
loadWeatherData();
```

### Issue 4: Badge Exists But Hidden (opacity: 0)
**Symptoms:**
- Badge element exists in DOM
- Opacity is 0

**Fix:**
```javascript
// Make badge visible for testing
if (userWeatherBadge) {
    userWeatherBadge.classList.add('debug-visible');
}
```

## 🎯 Manual Testing

### Test 1: Check Badge Element
```javascript
// Check if badge element exists in DOM
console.log('Badge element:', userWeatherBadge);
console.log('Badge HTML:', userWeatherBadge?.outerHTML);
console.log('Badge opacity:', userWeatherBadge?.style.opacity);
```

### Test 2: Force Badge Creation
```javascript
// If badge doesn't exist, create it manually
if (userLocationMarker && !userWeatherBadge) {
    const blueDot = userLocationMarker.content;
    const badge = document.createElement('div');
    badge.className = 'user-weather-badge';
    blueDot.appendChild(badge);
    userWeatherBadge = badge;
    console.log('✅ Badge created manually');
}
```

### Test 3: Test with Known Coordinates
```javascript
// Test with Kallang coordinates (should have thunderstorm weather)
const testPos = { lat: 1.3105, lng: 103.8565 };
const area = findPlanningAreaForLocation(testPos);
console.log('Test area (Kallang):', area);

// Test with central area coordinates
const centralPos = { lat: 1.2897, lng: 103.8501 };
const central = findPlanningAreaForLocation(centralPos);
console.log('Test area (Central):', central);
```

### Test 4: Force Weather Update
```javascript
// Force update with current position
if (userLocationMarker && userLocationMarker.position) {
    console.log('Forcing weather update...');
    updateUserLocationWeather(userLocationMarker.position);
    
    // Check result after 1 second
    setTimeout(() => {
        console.log('Badge opacity after update:', userWeatherBadge?.style.opacity);
        console.log('Current area:', currentUserArea);
    }, 1000);
}
```

## 📍 What Should Happen

### When Everything Works:
1. Page loads
2. Blue dot appears at your location
3. Weather system initializes (~2-3 seconds)
4. Console shows: `🌤️ Weather data loaded, updating user location...`
5. Console shows: `📍 User marker exists, updating weather...`
6. Console shows: `✓ Found containing area: [Area Name]`
7. Console shows: `✅ User location weather updated: [Area] - [Forecast]`
8. **Weather badge appears above blue dot with appropriate icon**

### Expected Console Messages:
```
Initializing weather system...
Weather data fetched successfully: {area_metadata: Array(47), items: Array(1)}
GeoJSON loaded, features: 55
🌤️ Weather data loaded, updating user location...
📍 User marker exists, updating weather...
🔍 Checking location: 1.3105, 103.8565
✓ Found containing area: Kallang (forecast: Thundery Showers)
✅ User location weather updated: Kallang - Thundery Showers
```

## 🔄 Force Refresh Everything

If all else fails, run this complete reset:

```javascript
// Complete refresh of weather system
console.log('🔄 Forcing complete refresh...');

// 1. Clear current data
weatherMarkers.forEach(m => m.map = null);
weatherMarkers = [];
weatherOverlays.forEach(o => o.setMap(null));
weatherOverlays = [];
map.data.forEach(f => map.data.remove(f));

// 2. Reset user area
currentUserArea = null;
if (userWeatherBadge) {
    userWeatherBadge.style.opacity = '0';
}

// 3. Reload weather
loadWeatherData();

// 4. Wait and retry user location
setTimeout(() => {
    console.log('Retrying user location weather...');
    if (userLocationMarker && userLocationMarker.position) {
        updateUserLocationWeather(userLocationMarker.position);
    }
}, 3000);
```

## 🎨 Visual Verification

### In Browser DevTools:

1. **Elements Tab**
   - Find: `div.blue-dot`
   - Should contain: `div.user-weather-badge`
   - Badge should have: SVG icon inside

2. **Check Computed Style**
   - Select: `.user-weather-badge`
   - Check: `opacity` should be `1` (not `0`)
   - Check: `visibility` should be `visible`
   - Check: `display` should be `flex`

3. **Check Position**
   - Badge should be: `top: -30px` relative to blue dot
   - Should be centered: `left: 50%, transform: translateX(-50%)`

## 📱 Mobile Testing

On mobile devices:
```javascript
// Check if location permission granted
navigator.permissions.query({name: 'geolocation'}).then(result => {
    console.log('Geolocation permission:', result.state);
});

// Check GPS accuracy
if (userLocationMarker) {
    console.log('Accuracy circle radius:', accuracyCircle?.getRadius());
}
```

## 🆘 Still Not Working?

### Last Resort Checks:

1. **Hard Reload**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Check Files Updated**:
   ```javascript
   // This should log "💡 Tip: Run debugWeather()..."
   // If not, files weren't updated
   ```

3. **Check Browser Console for Errors**:
   - Look for red error messages
   - Especially: CORS errors, 404s, or JavaScript errors

4. **Verify API Response**:
   ```javascript
   fetch('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast')
     .then(r => r.json())
     .then(d => console.log('API Response:', d));
   ```

5. **Check GeoJSON File**:
   ```javascript
   fetch('MasterPlan2019PlanningAreaBoundaryNoSea.geojson')
     .then(r => r.json())
     .then(d => console.log('GeoJSON features:', d.features.length));
   ```

---

## 💡 Pro Tips

- Run `debugWeather()` after every page load to verify system status
- Badge should appear within 5 seconds of page load
- If you move to a new planning area, console will log the update
- Badge only shows when you're inside a mapped planning area (land)
- Sea areas and islands may not have weather data

**Still stuck? Copy and paste the full console output when running `debugWeather()` for further analysis.**
