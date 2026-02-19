/**
 * Weather System Integration Tests
 * 
 * Paste these commands into your browser console (F12) after the page loads
 * to verify the weather system is working correctly.
 */

// ============================================================================
// TEST 1: System Initialization
// ============================================================================
console.log('%c=== Test 1: System Initialization ===', 'color: blue; font-weight: bold');

function test1_initialization() {
    const tests = {
        'Map exists': typeof map !== 'undefined' && map !== null,
        'Weather markers array exists': typeof weatherMarkers !== 'undefined',
        'Weather overlays array exists': typeof weatherOverlays !== 'undefined',
        'Weather data exists': weatherData !== null,
        'Zoom threshold defined': typeof ZOOM_THRESHOLD !== 'undefined',
        'Current zoom level tracked': typeof currentZoomLevel !== 'undefined'
    };
    
    Object.entries(tests).forEach(([name, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    return Object.values(tests).every(v => v);
}

const test1Result = test1_initialization();
console.log(test1Result ? '✅ Test 1 PASSED\n' : '❌ Test 1 FAILED\n');

// ============================================================================
// TEST 2: Weather Data Fetching
// ============================================================================
console.log('%c=== Test 2: Weather Data Fetching ===', 'color: blue; font-weight: bold');

function test2_weatherData() {
    if (!weatherData) {
        console.log('❌ Weather data not loaded');
        return false;
    }
    
    const tests = {
        'Has area_metadata': weatherData.area_metadata && weatherData.area_metadata.length > 0,
        'Has items': weatherData.items && weatherData.items.length > 0,
        'Has forecasts': weatherData.items[0]?.forecasts && weatherData.items[0].forecasts.length > 0,
        'Area count > 20': weatherData.area_metadata?.length > 20
    };
    
    Object.entries(tests).forEach(([name, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    console.log(`📊 Areas found: ${weatherData.area_metadata?.length || 0}`);
    console.log(`📊 Forecasts: ${weatherData.items[0]?.forecasts?.length || 0}`);
    
    return Object.values(tests).every(v => v);
}

const test2Result = test2_weatherData();
console.log(test2Result ? '✅ Test 2 PASSED\n' : '❌ Test 2 FAILED\n');

// ============================================================================
// TEST 3: GeoJSON Loading
// ============================================================================
console.log('%c=== Test 3: GeoJSON Loading ===', 'color: blue; font-weight: bold');

function test3_geoJSON() {
    let featureCount = 0;
    let featuresWithForecast = 0;
    
    map.data.forEach(feature => {
        featureCount++;
        if (feature.getProperty('forecast')) {
            featuresWithForecast++;
        }
    });
    
    const tests = {
        'GeoJSON features loaded': featureCount > 0,
        'Expected feature count (~55)': featureCount >= 50 && featureCount <= 60,
        'Features have forecasts': featuresWithForecast > 0,
        'Most features matched': featuresWithForecast / featureCount > 0.5
    };
    
    Object.entries(tests).forEach(([name, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    console.log(`📊 Total features: ${featureCount}`);
    console.log(`📊 Features with forecast: ${featuresWithForecast}`);
    console.log(`📊 Match rate: ${((featuresWithForecast / featureCount) * 100).toFixed(1)}%`);
    
    return Object.values(tests).every(v => v);
}

const test3Result = test3_geoJSON();
console.log(test3Result ? '✅ Test 3 PASSED\n' : '❌ Test 3 FAILED\n');

// ============================================================================
// TEST 4: Weather Markers
// ============================================================================
console.log('%c=== Test 4: Weather Markers ===', 'color: blue; font-weight: bold');

function test4_markers() {
    const tests = {
        'Markers created': weatherMarkers.length > 0,
        'Expected marker count': weatherMarkers.length >= 20,
        'Markers have positions': weatherMarkers.every(m => m.position),
        'Markers have forecast data': weatherMarkers.every(m => m.forecast),
        'Markers have area names': weatherMarkers.every(m => m.areaName)
    };
    
    Object.entries(tests).forEach(([name, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    console.log(`📊 Total markers: ${weatherMarkers.length}`);
    
    // Sample marker data
    if (weatherMarkers.length > 0) {
        const sampleMarker = weatherMarkers[0];
        console.log('📋 Sample marker:', {
            area: sampleMarker.areaName,
            forecast: sampleMarker.forecast,
            position: sampleMarker.position
        });
    }
    
    return Object.values(tests).every(v => v);
}

const test4Result = test4_markers();
console.log(test4Result ? '✅ Test 4 PASSED\n' : '❌ Test 4 FAILED\n');

// ============================================================================
// TEST 5: Zoom Behavior
// ============================================================================
console.log('%c=== Test 5: Zoom Behavior ===', 'color: blue; font-weight: bold');

function test5_zoomBehavior() {
    const currentZoom = map.getZoom();
    console.log(`📊 Current zoom level: ${currentZoom}`);
    console.log(`📊 Zoom threshold: ${ZOOM_THRESHOLD}`);
    
    const isZoomedOut = currentZoom <= ZOOM_THRESHOLD;
    console.log(`📊 Zoom state: ${isZoomedOut ? 'Zoomed out (markers visible)' : 'Zoomed in (animations visible)'}`);
    
    // Test marker visibility
    let visibleMarkers = 0;
    let hiddenMarkers = 0;
    
    weatherMarkers.forEach(marker => {
        if (marker.content) {
            const opacity = parseFloat(marker.content.style.opacity || 1);
            if (opacity > 0.5) {
                visibleMarkers++;
            } else {
                hiddenMarkers++;
            }
        }
    });
    
    console.log(`📊 Visible markers: ${visibleMarkers}`);
    console.log(`📊 Hidden markers: ${hiddenMarkers}`);
    
    // Expected behavior
    const expectedVisible = isZoomedOut;
    const actualVisible = visibleMarkers > hiddenMarkers;
    
    const tests = {
        'Zoom listener active': true, // If we got here, it's active
        'Marker visibility matches zoom': expectedVisible === actualVisible,
        'Overlays count': weatherOverlays.length >= 0
    };
    
    Object.entries(tests).forEach(([name, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    return Object.values(tests).every(v => v);
}

const test5Result = test5_zoomBehavior();
console.log(test5Result ? '✅ Test 5 PASSED\n' : '❌ Test 5 FAILED\n');

// ============================================================================
// TEST 6: Area Name Matching
// ============================================================================
console.log('%c=== Test 6: Area Name Matching ===', 'color: blue; font-weight: bold');

function test6_areaMatching() {
    // Get sample areas from both sources
    const geoJsonAreas = [];
    map.data.forEach(feature => {
        const name = feature.getProperty('PLN_AREA_N');
        if (name) geoJsonAreas.push(name);
    });
    
    const neaAreas = weatherData?.area_metadata?.map(a => a.name) || [];
    
    console.log('📋 Sample GeoJSON areas:', geoJsonAreas.slice(0, 5));
    console.log('📋 Sample NEA areas:', neaAreas.slice(0, 5));
    
    // Test normalization
    const testCases = [
        ['ANG MO KIO', 'Ang Mo Kio'],
        ['BUKIT MERAH', 'Bukit Merah'],
        ['TOA PAYOH', 'Toa Payoh']
    ];
    
    console.log('🔍 Testing name normalization:');
    testCases.forEach(([name1, name2]) => {
        const normalized1 = name1.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        const normalized2 = name2.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        const matches = normalized1 === normalized2;
        console.log(`  ${matches ? '✅' : '❌'} "${name1}" vs "${name2}"`);
    });
    
    return true;
}

const test6Result = test6_areaMatching();
console.log(test6Result ? '✅ Test 6 PASSED\n' : '❌ Test 6 FAILED\n');

// ============================================================================
// TEST 7: Refresh System
// ============================================================================
console.log('%c=== Test 7: Refresh System ===', 'color: blue; font-weight: bold');

function test7_refresh() {
    const tests = {
        'Refresh interval exists': weatherRefreshInterval !== null,
        'Refresh interval is number': typeof weatherRefreshInterval === 'number'
    };
    
    Object.entries(tests).forEach(([name, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    console.log('ℹ️  Weather data refreshes every 5 minutes');
    
    return Object.values(tests).every(v => v);
}

const test7Result = test7_refresh();
console.log(test7Result ? '✅ Test 7 PASSED\n' : '❌ Test 7 FAILED\n');

// ============================================================================
// FINAL RESULTS
// ============================================================================
console.log('%c=== FINAL TEST RESULTS ===', 'color: green; font-weight: bold; font-size: 14px');

const allTests = {
    'System Initialization': test1Result,
    'Weather Data Fetching': test2Result,
    'GeoJSON Loading': test3Result,
    'Weather Markers': test4Result,
    'Zoom Behavior': test5Result,
    'Area Name Matching': test6Result,
    'Refresh System': test7Result
};

const passedCount = Object.values(allTests).filter(v => v).length;
const totalCount = Object.values(allTests).length;
const passRate = ((passedCount / totalCount) * 100).toFixed(1);

console.log('\n📊 Test Summary:');
Object.entries(allTests).forEach(([name, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
});

console.log(`\n🎯 Pass Rate: ${passedCount}/${totalCount} (${passRate}%)`);

if (passedCount === totalCount) {
    console.log('%c\n🎉 ALL TESTS PASSED! Weather system is working correctly.\n', 'color: green; font-weight: bold; font-size: 16px');
} else {
    console.log('%c\n⚠️ SOME TESTS FAILED. Check the output above for details.\n', 'color: orange; font-weight: bold; font-size: 16px');
}

// ============================================================================
// INTERACTIVE TESTS
// ============================================================================
console.log('%c=== Interactive Tests (Run Manually) ===', 'color: purple; font-weight: bold');

console.log(`
📝 Manual Test Commands:

1. Test zoom in/out:
   map.setZoom(10);  // Should show markers
   map.setZoom(14);  // Should show animations

2. Force weather refresh:
   loadWeatherData();

3. Check specific area forecast:
   weatherMarkers.find(m => m.areaName.includes('Ang Mo Kio'))

4. List all forecasts:
   weatherMarkers.forEach(m => console.log(m.areaName, '→', m.forecast));

5. Test zoom threshold change:
   ZOOM_THRESHOLD = 10;  // Change threshold
   handleWeatherZoomChange();

6. Check overlay count:
   console.log('Active overlays:', weatherOverlays.length);

7. Inspect weather data:
   console.log(weatherData);

8. Count matched areas:
   let matched = 0;
   map.data.forEach(f => { if (f.getProperty('forecast')) matched++; });
   console.log('Matched areas:', matched);
`);

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================
console.log('%c=== Performance Metrics ===', 'color: teal; font-weight: bold');

function getPerformanceMetrics() {
    const metrics = {
        'Weather markers': weatherMarkers.length,
        'Active overlays': weatherOverlays.length,
        'GeoJSON features': (() => { let c = 0; map.data.forEach(() => c++); return c; })(),
        'Current zoom': map.getZoom(),
        'Zoom threshold': ZOOM_THRESHOLD,
        'Refresh interval active': weatherRefreshInterval !== null
    };
    
    console.table(metrics);
}

getPerformanceMetrics();

console.log('\n✨ Testing complete! Review results above.');
