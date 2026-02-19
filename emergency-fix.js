// ============================================================
// EMERGENCY WEATHER BADGE FIX
// Copy and paste this entire script into browser console (F12)
// ============================================================

console.log('%c🚨 EMERGENCY WEATHER BADGE FIX 🚨', 'background: red; color: white; font-size: 16px; padding: 10px;');

// Step 1: Check what exists
console.log('\n📋 Step 1: Checking current state...');
console.log('✓ User marker exists:', !!userLocationMarker);
console.log('✓ Weather data loaded:', !!weatherData);
console.log('✓ Weather badge exists:', !!userWeatherBadge);

// Step 2: Ensure badge element exists
console.log('\n🔧 Step 2: Ensuring badge exists...');
if (userLocationMarker && userLocationMarker.content && !userWeatherBadge) {
    const blueDot = userLocationMarker.content;
    const badge = document.createElement('div');
    badge.className = 'user-weather-badge';
    badge.style.opacity = '0';
    blueDot.appendChild(badge);
    userWeatherBadge = badge;
    console.log('✅ Badge created!');
} else if (userWeatherBadge) {
    console.log('✅ Badge already exists!');
} else {
    console.log('❌ Cannot create badge - no user marker');
}

// Step 3: Check if in planning area
console.log('\n🗺️  Step 3: Checking planning area...');
if (userLocationMarker && userLocationMarker.position) {
    const pos = userLocationMarker.position;
    const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
    const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
    
    console.log('📍 Your position:', lat.toFixed(4), lng.toFixed(4));
    
    if (weatherData) {
        // Try to find the area
        let foundArea = null;
        let checkedCount = 0;
        
        map.data.forEach(feature => {
            checkedCount++;
            const geometry = feature.getGeometry();
            if (!geometry) return;
            
            // Simplified point-in-polygon check
            const isInside = containsLocation({lat, lng}, geometry);
            if (isInside) {
                foundArea = {
                    name: feature.getProperty('PLN_AREA_N'),
                    forecast: feature.getProperty('forecast')
                };
            }
        });
        
        console.log('🔍 Checked', checkedCount, 'areas');
        
        if (foundArea) {
            console.log('✅ You are in:', foundArea.name);
            console.log('🌤️  Forecast:', foundArea.forecast || 'NOT AVAILABLE');
            
            // Step 4: Force update the badge
            if (foundArea.forecast && userWeatherBadge) {
                console.log('\n🎨 Step 4: Updating badge...');
                
                // Get the weather icon
                const icon = getWeatherIcon(foundArea.forecast);
                icon.setAttribute('width', '24');
                icon.setAttribute('height', '24');
                
                // Clear and add icon
                userWeatherBadge.innerHTML = '';
                userWeatherBadge.appendChild(icon);
                userWeatherBadge.title = `${foundArea.name}: ${foundArea.forecast}`;
                
                // Make visible
                userWeatherBadge.style.opacity = '1';
                
                console.log('✅ Badge updated with', foundArea.forecast, 'icon');
                console.log('👀 Look above your blue dot now!');
                
                // Add debug class for extra visibility
                setTimeout(() => {
                    if (userWeatherBadge.style.opacity === '1') {
                        console.log('✅ Badge is visible!');
                    } else {
                        console.log('⚠️ Badge may be hidden. Adding debug class...');
                        userWeatherBadge.classList.add('debug-visible');
                    }
                }, 500);
            } else if (!foundArea.forecast) {
                console.log('❌ No forecast data for', foundArea.name);
                console.log('   This area may not have weather data yet');
            }
        } else {
            console.log('❌ Not in any planning area');
            console.log('   Possible reasons:');
            console.log('   - You are in the sea/water');
            console.log('   - You are outside Singapore');
            console.log('   - GPS accuracy is low');
            console.log('   - GeoJSON polygons not loaded properly');
        }
    } else {
        console.log('❌ Weather data not loaded');
    }
} else {
    console.log('❌ No user location available');
}

// Step 5: Summary
console.log('\n📊 Summary:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (userWeatherBadge && userWeatherBadge.style.opacity === '1') {
    console.log('%c✅ SUCCESS! Badge should be visible above your blue dot!', 'background: green; color: white; padding: 5px;');
} else if (userWeatherBadge) {
    console.log('%c⚠️ Badge exists but may not be visible', 'background: orange; color: white; padding: 5px;');
    console.log('Try running: userWeatherBadge.classList.add("debug-visible")');
} else {
    console.log('%c❌ Badge could not be created', 'background: red; color: white; padding: 5px;');
    console.log('Check if user location is enabled');
}

// Helpful commands
console.log('\n🛠️  Helpful commands:');
console.log('debugWeather()                              - Full diagnostic');
console.log('updateMyWeather()                           - Force weather update');
console.log('userWeatherBadge.classList.add("debug-visible") - Make badge always visible');
console.log('userWeatherBadge.style.opacity = "1"        - Show badge');

console.log('\n✨ Script completed!');
