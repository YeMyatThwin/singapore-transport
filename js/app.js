// Initialize and add the map
let map;
let userLocationMarker;
let accuracyCircle;
let watchId;
let deviceHeading = null; // Store device compass heading
let bottomSheet; // Bottom sheet element
let currentBusStopCode = null; // Store current bus stop being viewed
let refreshInterval = null; // Store auto-refresh interval
let countdownInterval = null; // Store countdown animation interval
let lastUpdateTime = null; // Store last successful update time
let cachedBusData = null; // Store last known bus data
let isOpening = false; // Flag to prevent click-outside from closing when opening
let activeMarker = null; // Store currently active/selected bus stop marker
let activeBusStopCode = null; // Store the bus stop code of the active marker

// Weather System Variables
let weatherMarkers = []; // Store weather markers
let weatherOverlays = []; // Store weather animation overlays
let weatherData = null; // Store current weather data
let weatherRefreshInterval = null; // Weather refresh interval
let currentZoomLevel = 15; // Track current zoom level
const ZOOM_THRESHOLD = 12; // Zoom level threshold for animations
let userWeatherBadge = null; // Weather badge for user's location
let currentUserArea = null; // Current planning area user is in

function initMap() {
    // The map
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
        fullscreenControl: false,
        mapId: "fbef370cf798c9795d634795",
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        colorScheme: google.maps.ColorScheme.LIGHT, // Set the map to dark mode

    });

    // Wait for map to be ready, then add location button
    google.maps.event.addListenerOnce(map, 'idle', () => {
        // Create the location control button
        const locationButton = document.createElement("button");
        locationButton.textContent = "My Location";
        locationButton.classList.add("custom-map-control-button");

        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(locationButton);

        // Add click event listener to start tracking
        locationButton.addEventListener("click", () => {
            console.log("Location button clicked");

            if (!navigator.geolocation) {
                alert("Error: Your browser doesn't support geolocation.");
                return;
            }

            // If already tracking, just re-center the map
            if (userLocationMarker) {
                map.setCenter(userLocationMarker.position);
                map.setZoom(15);
            } else {
                // Not tracking yet - try to start location tracking
                // This allows users to retry if they previously denied permission
                startLocationTracking();
            }

            // Request orientation permission on button click (works on iOS)
            requestOrientationPermission();
        });

        // Load bus stops from local JSON file
        loadBusStopsFromJSON();

        // Initialize weather system
        initWeatherSystem();

        // Check if iOS and show compass prompt
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS: Start location tracking, compass will be requested via button click only
            if (navigator.geolocation) {
                startLocationTracking();
            }
        } else {
            // Non-iOS: start both automatically
            if (navigator.geolocation) {
                startOrientationTracking();
                startLocationTracking();
            }
        }
    });

    // Default center (Singapore)
    const singapore = { lat: 1.3521, lng: 103.8198 };
    map.setCenter(singapore);

    // Initialize bottom sheet
    initBottomSheet();
}

async function requestOrientationPermission() {
    // Check if DeviceOrientationEvent.requestPermission exists (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            console.log('Requesting device orientation permission (iOS)...');
            const permission = await DeviceOrientationEvent.requestPermission();
            console.log('Permission result:', permission);
            if (permission === 'granted') {
                console.log('Device orientation permission granted');
                startOrientationTracking();
                return true;
            } else {
                console.log('Device orientation permission denied');
                alert('Compass permission denied. The direction arrow won\'t work without it.');
                return false;
            }
        } catch (error) {
            console.error('Error requesting orientation permission:', error);
            alert('Error requesting compass permission: ' + error.message);
            return false;
        }
    } else {
        // Non-iOS or older browsers - start tracking directly
        console.log('No permission needed for device orientation (non-iOS)');
        startOrientationTracking();
        return true;
    }
}

function startOrientationTracking() {
    console.log('startOrientationTracking called');
    if (window.DeviceOrientationEvent) {
        console.log('DeviceOrientationEvent supported, adding listener...');
        let eventCount = 0;
        window.addEventListener('deviceorientation', (event) => {
            eventCount++;
            // Log first few events for debugging
            if (eventCount <= 3) {
                console.log(`Orientation event #${eventCount}:`, {
                    alpha: event.alpha,
                    beta: event.beta,
                    gamma: event.gamma,
                    webkitCompassHeading: event.webkitCompassHeading
                });
            }

            // alpha: compass direction (0-360)
            // 0 = North, 90 = East, 180 = South, 270 = West
            if (event.alpha !== null) {
                deviceHeading = event.alpha;
            }

            // Optionally use webkitCompassHeading for iOS (more accurate)
            if (event.webkitCompassHeading !== undefined) {
                deviceHeading = event.webkitCompassHeading;
            }

            // Update the direction wedge in real-time
            updateDirectionWedge();
        }, true);
    } else {
        console.error('DeviceOrientationEvent NOT supported');
    }
}

function updateDirectionWedge() {
    // Only update if we have a marker and a valid heading
    if (userLocationMarker && deviceHeading !== null && !isNaN(deviceHeading)) {
        const blueDot = userLocationMarker.content;
        if (blueDot) {
            // Find or create the direction wedge
            let wedge = blueDot.querySelector('.direction-wedge');
            if (!wedge) {
                wedge = document.createElement('div');
                wedge.className = 'direction-wedge';
                blueDot.appendChild(wedge);
            }
            // Update the rotation
            wedge.style.transform = `rotate(${deviceHeading}deg)`;
        }
    }
}

function startLocationTracking() {
    // First, request permission with getCurrentPosition (triggers browser prompt)
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Permission granted! Now start continuous tracking
            console.log("Permission granted, starting continuous tracking");

            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };

            // Center map on initial location
            map.setCenter(pos);
            map.setZoom(15);

            // Create initial blue dot
            updateUserLocationMarker(position);

            // Now start continuous tracking with watchPosition
            if (!watchId) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        updateUserLocationMarker(position);
                    },
                    (error) => {
                        console.error("Error tracking location:", error);
                        // Don't show alert for timeout during continuous tracking
                        // Just log it and keep trying
                    },
                    {
                        enableHighAccuracy: true,
                        maximumAge: 10000, // Allow cached position up to 10 seconds old
                        timeout: 30000 // Increased to 30 seconds
                    }
                );
            }
        },
        (error) => {
            console.error("Error getting location:", error);

            let errorMsg = "Unable to get your location. ";
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg += "Permission denied. Please enable location access in your browser settings.";
                    alert(errorMsg);
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg += "Location information is unavailable. Make sure GPS is enabled.";
                    alert(errorMsg);
                    break;
                case error.TIMEOUT:
                    // For timeout, just log it - don't show intrusive alert
                    console.warn("Location request timed out. This may happen indoors or with weak GPS signal.");
                    // Optionally show a less intrusive notification
                    break;
                default:
                    errorMsg += "An unknown error occurred.";
                    alert(errorMsg);
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 30000, // Increased to 30 seconds
            maximumAge: 0
        }
    );
}

// Function to smoothly animate marker position and accuracy circle
function animateMarkerTo(marker, targetPos, targetAccuracy, duration = 1000) {
    const startPos = marker.position;
    const startAccuracy = accuracyCircle ? accuracyCircle.getRadius() : targetAccuracy;
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smoother animation (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Interpolate between start and target position
        const lat = startPos.lat + (targetPos.lat - startPos.lat) * easeProgress;
        const lng = startPos.lng + (targetPos.lng - startPos.lng) * easeProgress;
        
        marker.position = { lat, lng };
        
        // Update accuracy circle if it exists
        if (accuracyCircle) {
            accuracyCircle.setCenter({ lat, lng });
            // Also animate the radius
            const radius = startAccuracy + (targetAccuracy - startAccuracy) * easeProgress;
            accuracyCircle.setRadius(radius);
        }
        
        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
    
    // Update weather for new location
    updateUserLocationWeather(targetPos);
}

function updateUserLocationMarker(position) {
    const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
    };
    const accuracy = position.coords.accuracy;
    // Use device orientation heading if available, otherwise fallback to GPS heading
    const heading = deviceHeading !== null ? deviceHeading : position.coords.heading;

    // Create marker on first call, update position on subsequent calls
    if (!userLocationMarker) {
        // First time - create new marker
        const blueDot = document.createElement('div');
        blueDot.className = 'blue-dot';

        // Add direction wedge if heading is available
        if (heading !== null && !isNaN(heading)) {
            const wedge = document.createElement('div');
            wedge.className = 'direction-wedge';
            wedge.style.transform = `rotate(${heading}deg)`;
            blueDot.appendChild(wedge);
        }

        // Create weather badge container (will be populated when weather loads)
        const weatherBadge = document.createElement('div');
        weatherBadge.className = 'user-weather-badge';
        blueDot.appendChild(weatherBadge);
        userWeatherBadge = weatherBadge;

        userLocationMarker = new google.maps.marker.AdvancedMarkerElement({
            position: pos,
            map: map,
            content: blueDot,
            title: "Your Location"
        });

        // Add click listener to blue dot for orientation permission (iOS)
        userLocationMarker.addListener('click', () => {
            console.log("Blue dot clicked");
            // If orientation is not active yet, request permission
            if (deviceHeading === null) {
                console.log("Requesting orientation permission from blue dot click");
                requestOrientationPermission();
            } else {
                // If already have orientation, just recenter map
                map.setCenter(userLocationMarker.position);
                map.setZoom(15);
            }
        });
    } else {
        // Animate marker to new position smoothly
        animateMarkerTo(userLocationMarker, pos, accuracy);
        
        // Update direction wedge if heading changed
        updateDirectionWedge();
    }

    // Update or create accuracy circle
    if (!accuracyCircle) {
        // First time - create new circle
        accuracyCircle = new google.maps.Circle({
            map: map,
            center: pos,
            radius: accuracy,
            fillColor: '#4285F4',
            fillOpacity: 0.1,
            strokeColor: '#4285F4',
            strokeOpacity: 0.3,
            strokeWeight: 1,
        });
    } else {
        // Radius is updated by animation, no need to set it here
    }
}

// Store bus stop markers - using Map for efficient lookup by BusStopCode
const busStopMarkers = new Map();

// Load bus stops from local JSON file
async function loadBusStopsFromJSON() {
    try {
        console.log('Loading bus stops from local JSON...');

        const response = await fetch('saved-data/bus_stops_singapore.json');
        const data = await response.json();

        if (!data || !data.value) {
            console.error('Invalid JSON format');
            return;
        }

        const busStops = data.value;
        console.log(`Total bus stops loaded: ${busStops.length}`);

        // Display bus stops around map center
        displayNearbyBusStops(busStops);

        // Update bus stops when map moves
        map.addListener('idle', () => {
            displayNearbyBusStops(busStops);
        });
    } catch (error) {
        console.error('Error loading bus stops:', error);
    }
}

// Display bus stops within radius of map center (zoom-dependent)
function displayNearbyBusStops(allBusStops) {
    const mapCenter = map.getCenter();

    // Wait for map to be ready
    if (!mapCenter) {
        console.log('Map not ready yet, waiting...');
        return;
    }

    const zoomLevel = map.getZoom();

    // Don't show bus stops if zoomed out too far
    if (zoomLevel < 14) {
        console.log(`Zoom level ${zoomLevel} - bus stops hidden (need zoom >= 14)`);
        // Fade out and remove all markers when zoomed out too far
        busStopMarkers.forEach(marker => {
            fadeOutAndRemoveMarker(marker);
        });
        busStopMarkers.clear();
        return;
    }

    // Adjust radius and icon size based on zoom level
    let radiusKm, iconSize;
    if (zoomLevel >= 16) {
        radiusKm = 1; // Close up - less stops
        iconSize = 50; // Bigger icons
    } else {
        radiusKm = 2; // Wider view - more stops
        iconSize = 30; // Smaller icons
    }

    // Filter nearby stops based on map center
    const nearbyStops = allBusStops.filter(stop => {
        const distance = calculateDistance(
            mapCenter.lat(),
            mapCenter.lng(),
            stop.Latitude,
            stop.Longitude
        );
        return distance <= radiusKm * 1000; // Convert km to meters
    });

    console.log(`Zoom ${zoomLevel}: Found ${nearbyStops.length} bus stops within ${radiusKm}km`);

    // Create a Set of bus stop codes that should be visible
    const visibleStopCodes = new Set(nearbyStops.map(stop => stop.BusStopCode));

    // Remove markers that are no longer in range with fade-out animation
    busStopMarkers.forEach((marker, busStopCode) => {
        if (!visibleStopCodes.has(busStopCode)) {
            fadeOutAndRemoveMarker(marker);
            busStopMarkers.delete(busStopCode);
        }
    });

    // Add or update markers for nearby stops
    nearbyStops.forEach(stop => {
        const existingMarker = busStopMarkers.get(stop.BusStopCode);
        
        if (existingMarker) {
            // Marker already exists - check if size changed (zoom level changed)
            if (existingMarker.markerSize !== iconSize) {
                // Update icon size for existing marker
                const isActive = activeBusStopCode === stop.BusStopCode;
                updateMarkerIcon(existingMarker, stop, iconSize, isActive);
                existingMarker.markerSize = iconSize;
            }
            // Marker exists and size is correct - do nothing (no refresh)
        } else {
            // New marker - create it
            const isActive = activeBusStopCode === stop.BusStopCode;
            createBusStopMarker(stop, iconSize, isActive);
        }
    });
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Generate normal (inactive) bus stop icon SVG
function getNormalBusStopSVG(stop, width, height) {
    return `
<svg width="${width}" height="${height}" viewBox="0 0 220 401" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="81" y="100" width="58" height="301" rx="15" fill="url(#paint0_linear_${stop.BusStopCode})"/>
<g clip-path="url(#clip0_${stop.BusStopCode})">
<path d="M220 157.152H0V251.464H220V157.152Z" fill="#004B50"/>
<path d="M220 0H0V157.156H220V0Z" fill="#007F95"/>
<path d="M159.408 34.5029C157.418 25.6029 149.268 20.0029 140.148 20.0029H79.8582C70.7382 20.0029 62.5882 25.6029 60.5982 34.5029C55.6082 56.8829 51.8582 92.2729 52.4182 115.523C52.5882 122.383 58.3782 127.463 65.2382 127.463H65.3682V137.033C65.3682 139.953 67.8482 142.303 70.7682 142.303H75.1982C78.2482 142.303 80.6182 139.953 80.6182 137.033V127.463H139.388V137.033C139.388 139.953 141.868 142.303 144.788 142.303H149.218C152.268 142.303 154.638 139.953 154.638 137.033V127.463H154.768C161.638 127.463 167.428 122.383 167.588 115.523C168.148 92.2629 164.398 56.8829 159.408 34.5029ZM90.5082 28.0029C90.5082 26.3429 91.8482 25.0029 93.5082 25.0029H126.508C128.158 25.0029 129.508 26.3429 129.508 28.0029V32.0029C129.508 33.6529 128.158 35.0029 126.508 35.0029H93.5082C91.8482 35.0029 90.5082 33.6529 90.5082 32.0029V28.0029ZM65.5682 76.0829L70.1882 46.0829C70.6382 43.1629 73.1582 41.0029 76.1182 41.0029H143.888C146.858 41.0029 149.368 43.1629 149.818 46.0829L154.438 76.0829C154.998 79.7229 152.188 83.0029 148.508 83.0029H71.4982C67.8182 83.0029 65.0082 79.7229 65.5682 76.0829ZM88.6682 105.833C88.6682 108.883 86.3182 111.253 83.2682 111.253H70.6382C67.7182 111.253 65.3682 108.883 65.3682 105.833V101.403C65.3682 98.4829 67.7182 96.0029 70.6382 96.0029H83.2682C86.3182 96.0029 88.6682 98.4829 88.6682 101.403V105.833ZM154.638 105.833C154.638 108.883 152.288 111.253 149.238 111.253H136.608C133.688 111.253 131.338 108.883 131.338 105.833V101.403C131.338 98.4829 133.688 96.0029 136.608 96.0029H149.238C152.288 96.0029 154.638 98.4829 154.638 101.403V105.833Z" fill="white"/>
<path d="M50.115 228V172.727H71.2741C75.2684 172.727 78.588 173.357 81.2329 174.616C83.8958 175.858 85.8839 177.558 87.1974 179.717C88.5288 181.876 89.1945 184.323 89.1945 187.058C89.1945 189.307 88.7627 191.232 87.8991 192.834C87.0354 194.417 85.8749 195.704 84.4175 196.693C82.9602 197.683 81.3318 198.393 79.5326 198.825V199.365C81.4938 199.473 83.374 200.076 85.1732 201.173C86.9905 202.253 88.4748 203.782 89.6264 205.761C90.7779 207.741 91.3536 210.134 91.3536 212.94C91.3536 215.801 90.6609 218.374 89.2755 220.659C87.8901 222.926 85.803 224.716 83.0141 226.03C80.2253 227.343 76.7168 228 72.4886 228H50.115ZM60.1278 219.634H70.8962C74.5307 219.634 77.1486 218.941 78.7499 217.555C80.3693 216.152 81.1789 214.353 81.1789 212.158C81.1789 210.52 80.7741 209.045 79.9644 207.732C79.1548 206.4 78.0032 205.357 76.5099 204.601C75.0165 203.827 73.2353 203.44 71.1661 203.44H60.1278V219.634ZM60.1278 196.234H70.0326C71.7599 196.234 73.3162 195.92 74.7016 195.29C76.0871 194.642 77.1756 193.733 77.9673 192.564C78.7769 191.376 79.1818 189.973 79.1818 188.354C79.1818 186.213 78.4261 184.449 76.9147 183.064C75.4213 181.679 73.1993 180.986 70.2485 180.986H60.1278V196.234ZM122.254 210.565V186.545H132.024V228H122.551V220.632H122.119C121.184 222.953 119.645 224.851 117.504 226.327C115.381 227.802 112.763 228.54 109.651 228.54C106.934 228.54 104.532 227.937 102.445 226.732C100.375 225.508 98.7562 223.736 97.5866 221.415C96.4171 219.076 95.8324 216.251 95.8324 212.94V186.545H105.602V211.429C105.602 214.056 106.322 216.143 107.761 217.69C109.201 219.238 111.09 220.011 113.429 220.011C114.868 220.011 116.263 219.661 117.612 218.959C118.962 218.257 120.068 217.214 120.932 215.828C121.813 214.425 122.254 212.67 122.254 210.565ZM171.035 197.503L162.129 198.474C161.877 197.575 161.436 196.729 160.806 195.938C160.194 195.146 159.367 194.507 158.323 194.021C157.28 193.536 156.002 193.293 154.491 193.293C152.458 193.293 150.748 193.733 149.363 194.615C147.996 195.497 147.321 196.639 147.339 198.043C147.321 199.248 147.762 200.229 148.661 200.984C149.579 201.74 151.09 202.361 153.195 202.847L160.266 204.358C164.189 205.204 167.104 206.544 169.011 208.379C170.936 210.214 171.908 212.616 171.926 215.585C171.908 218.194 171.143 220.497 169.631 222.494C168.138 224.473 166.06 226.021 163.397 227.136C160.734 228.252 157.676 228.81 154.221 228.81C149.147 228.81 145.063 227.748 141.968 225.625C138.873 223.484 137.029 220.506 136.435 216.692L145.962 215.774C146.394 217.645 147.312 219.058 148.715 220.011C150.119 220.965 151.945 221.442 154.194 221.442C156.515 221.442 158.377 220.965 159.781 220.011C161.202 219.058 161.913 217.879 161.913 216.476C161.913 215.288 161.454 214.308 160.536 213.534C159.637 212.76 158.233 212.167 156.326 211.753L149.255 210.268C145.279 209.441 142.337 208.046 140.43 206.085C138.523 204.106 137.578 201.605 137.596 198.582C137.578 196.027 138.271 193.814 139.674 191.943C141.095 190.054 143.066 188.597 145.585 187.571C148.122 186.527 151.045 186.006 154.356 186.006C159.214 186.006 163.037 187.04 165.826 189.109C168.633 191.179 170.369 193.976 171.035 197.503Z" fill="white"/>
</g>
<defs>
<linearGradient id="paint0_linear_${stop.BusStopCode}" x1="81" y1="250.5" x2="139" y2="250.5" gradientUnits="userSpaceOnUse">
<stop stop-color="#CAD7FF"/>
<stop offset="1" stop-color="#3350A8"/>
</linearGradient>
<clipPath id="clip0_${stop.BusStopCode}">
<rect width="220" height="251.468" rx="40" fill="white"/>
</clipPath>
</defs>
</svg>`;
}

// Generate active (selected) bus stop icon SVG
function getActiveBusStopSVG(stop, width) {
    const biggerWidth = width + 20; // Active icon is bigger
    // Active icon has 220:279 ratio, calculate height based on bigger width
    const height = Math.round(biggerWidth * 279 / 220);
    return `
<svg width="${biggerWidth}" height="${height}" viewBox="0 0 220 279" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M110.002 0.550781C170.452 0.550996 219.452 49.3136 219.449 109.456C219.449 136.307 209.64 160.849 193.448 179.836L110.001 277.634L26.5518 179.839H26.5508C10.3598 160.849 0.550781 136.31 0.550781 109.459C0.550827 49.3133 49.5515 0.550781 110.002 0.550781Z" fill="#007F95" stroke="#007F95" stroke-width="1.10116"/>
<ellipse cx="109.555" cy="105.711" rx="90.7423" ry="90.2948" fill="white"/>
<path d="M163.829 54.5073C161.627 44.707 152.608 38.5405 142.516 38.5405H75.7979C65.7056 38.5405 56.6867 44.707 54.4845 54.5073C48.9625 79.1512 44.8127 118.121 45.4324 143.723C45.6206 151.277 52.0279 156.871 59.6192 156.871H59.7631V167.409C59.7631 170.624 62.5075 173.212 65.7388 173.212H70.6411C74.0163 173.212 76.639 170.624 76.639 167.409V156.871H141.675V167.409C141.675 170.624 144.419 173.212 147.65 173.212H152.553C155.928 173.212 158.551 170.624 158.551 167.409V156.871H158.694C166.297 156.871 172.704 151.277 172.881 143.723C173.501 118.11 169.351 79.1512 163.829 54.5073ZM87.5834 47.3498C87.5834 45.5219 89.0662 44.0463 90.9032 44.0463H127.421C129.247 44.0463 130.741 45.5219 130.741 47.3498V51.7544C130.741 53.5713 129.247 55.0579 127.421 55.0579H90.9032C89.0662 55.0579 87.5834 53.5713 87.5834 51.7544V47.3498ZM59.9844 100.293L65.097 67.2587C65.595 64.0433 68.3836 61.6648 71.6592 61.6648H146.654C149.941 61.6648 152.719 64.0433 153.217 67.2587L158.329 100.293C158.949 104.302 155.839 107.913 151.767 107.913H66.5466C62.4743 107.913 59.3647 104.302 59.9844 100.293ZM85.5472 133.053C85.5472 136.411 82.9467 139.021 79.5715 139.021H65.5949C62.3636 139.021 59.7631 136.411 59.7631 133.053V128.175C59.7631 124.959 62.3636 122.228 65.5949 122.228H79.5715C82.9467 122.228 85.5472 124.959 85.5472 128.175V133.053ZM158.551 133.053C158.551 136.411 155.95 139.021 152.575 139.021H138.598C135.367 139.021 132.766 136.411 132.766 133.053V128.175C132.766 124.959 135.367 122.228 138.598 122.228H152.575C155.95 122.228 158.551 124.959 158.551 128.175V133.053Z" fill="#007F95" stroke="white" stroke-width="1.00205"/>
</svg>`;
}

// Fade out marker and remove from map
function fadeOutAndRemoveMarker(marker) {
    const content = marker.content;
    if (content && content.classList) {
        content.classList.remove('spring-in');
        content.classList.add('fade-out');
        // Wait for animation to complete before removing
        setTimeout(() => {
            marker.setMap(null);
        }, 300); // Match CSS transition duration
    } else {
        marker.setMap(null);
    }
}

// Update marker icon to normal or active state
function updateMarkerIcon(marker, stop, size, isActive) {
    const width = Math.round(size * 220 / 401);
    const svgString = isActive 
        ? getActiveBusStopSVG(stop, width)
        : getNormalBusStopSVG(stop, width, size);
    
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    
    // Add animation classes
    svgElement.classList.add('bus-stop-marker', 'spring-in');
    
    marker.content = svgElement;
}

// Create bus stop marker on map
function createBusStopMarker(stop, size = 28, isActive = false) {
    const width = Math.round(size * 220 / 401);
    const svgIcon = isActive 
        ? getActiveBusStopSVG(stop, width)
        : getNormalBusStopSVG(stop, width, size);

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgIcon, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    
    // Add animation classes for spring-in effect
    svgElement.classList.add('bus-stop-marker');

    const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: stop.Latitude, lng: stop.Longitude },
        map: map,
        content: svgElement,
        title: `${stop.Description || 'Bus Stop'}\n${stop.RoadName || ''}\nStop: ${stop.BusStopCode || ''}`
    });
    
    // Force reflow for iOS Safari - read a property to ensure DOM is ready
    void svgElement.offsetWidth;
    
    // Use requestAnimationFrame for better iOS Safari compatibility
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            svgElement.classList.add('spring-in');
        });
    });

    // Store marker size and stop data for later updates
    marker.markerSize = size;
    marker.stopData = stop;

    // If this marker should be active, store it as the active marker
    if (isActive) {
        activeMarker = marker;
    }

    // Add click listener to show bottom sheet and update icon
    marker.addListener('click', () => {
        // Reset previous active marker to normal state
        if (activeMarker && activeMarker !== marker) {
            updateMarkerIcon(activeMarker, activeMarker.stopData, activeMarker.markerSize, false);
        }
        
        // Set this marker as active
        activeMarker = marker;
        activeBusStopCode = stop.BusStopCode;
        updateMarkerIcon(marker, stop, size, true);
        
        // Show bottom sheet
        showBottomSheet(stop);
    });

    // Store marker in Map keyed by BusStopCode
    busStopMarkers.set(stop.BusStopCode, marker);
}

// Initialize bottom sheet functionality
function initBottomSheet() {
    bottomSheet = document.getElementById('bottomSheet');
    const handle = document.querySelector('.bottom-sheet-handle');
    const refreshIcon = document.querySelector('.refresh-icon');

    // Refresh icon click
    if (refreshIcon) {
        refreshIcon.addEventListener('click', () => {
            if (currentBusStopCode) {
                refreshIcon.classList.add('rotating');
                fetchBusArrivalData(currentBusStopCode);
                setTimeout(() => {
                    refreshIcon.classList.remove('rotating');
                }, 600);
            }
        });
    }

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (isOpening) {
            return; // Don't close if we're in the process of opening
        }
        if (bottomSheet.classList.contains('active')) {
            const bottomSheetContent = document.querySelector('.bottom-sheet-content');
            if (bottomSheetContent && !bottomSheetContent.contains(e.target) && !e.target.closest('.bottom-sheet-handle')) {
                hideBottomSheet();
            }
        }
    });

    // Drag handle functionality (touch and mouse)
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    // Touch events
    handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
        bottomSheet.style.transition = 'none';
    });

    handle.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        currentY = e.touches[0].clientY;
        const diff = currentY - startY;

        // Only allow dragging downward
        if (diff > 0) {
            bottomSheet.style.transform = `translateY(${diff}px)`;
        }
    });

    handle.addEventListener('touchend', handleDragEnd);

    // Mouse events for desktop
    handle.addEventListener('mousedown', (e) => {
        startY = e.clientY;
        isDragging = true;
        bottomSheet.style.transition = 'none';
        handle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        currentY = e.clientY;
        const diff = currentY - startY;

        // Only allow dragging downward
        if (diff > 0) {
            bottomSheet.style.transform = `translateY(${diff}px)`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        handleDragEnd();
        handle.style.cursor = 'grab';
    });

    function handleDragEnd() {
        const diff = currentY - startY;
        const screenHeight = window.innerHeight;
        const threshold = screenHeight * 0.3; // 30% of screen height

        bottomSheet.style.transition = 'transform 0.3s ease-out';

        // If dragged down more than 30% of screen, close it
        if (diff > threshold) {
            hideBottomSheet();
        } else {
            // Snap back to open position
            bottomSheet.style.transform = 'translateY(0)';
        }

        isDragging = false;
        startY = 0;
        currentY = 0;
    }
}

// Show bottom sheet with bus stop data
async function showBottomSheet(stop) {
    const title = document.getElementById('busStopTitle');

    // Set flag to prevent click-outside from closing immediately
    isOpening = true;

    // Set title with bus stop code, description, and road name on new line
    title.innerHTML = `${stop.BusStopCode} - ${stop.Description}<br><span class="road-name">${stop.RoadName}</span>`;

    // Store current bus stop code for auto-refresh
    currentBusStopCode = stop.BusStopCode;

    // Add active class to show the sheet
    bottomSheet.classList.add('active');

    // Clear opening flag after a short delay
    setTimeout(() => {
        isOpening = false;
    }, 300);

    // Fetch real bus arrival data
    await fetchBusArrivalData(stop.BusStopCode);

    // Clear any existing intervals
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    // Start smooth countdown animation (updates every second)
    countdownInterval = setInterval(() => {
        updateBusCountdowns();
    }, 1000); // Update every second

    // Start auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
        if (currentBusStopCode && bottomSheet.classList.contains('active')) {
            fetchBusArrivalData(currentBusStopCode);
        }
    }, 30000); // 30000ms = 30 seconds
}

// Fetch and display bus arrival data from LTA API
async function fetchBusArrivalData(busStopCode) {
    const servicesContainer = document.getElementById('servicesContainer');
    const lastUpdateElement = document.getElementById('lastUpdate');

    // Only show loading state on first load (when no cached data)
    if (!cachedBusData) {
        servicesContainer.innerHTML = '<div style="color: #999; padding: 24px;">Loading...</div>';
    }

    try {
        const response = await fetch(`/api/bus-arrival?busStopCode=${busStopCode}`);
        const data = await response.json();

        if (!data.Services || data.Services.length === 0) {
            servicesContainer.innerHTML = '<div style="color: #999; padding: 24px;">No buses available at this stop</div>';
            return;
        }

        // Cache successful data
        cachedBusData = data.Services;
        lastUpdateTime = new Date();

        // Update last update time
        if (lastUpdateElement) {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const ampm = hours >= 12 ? 'pm' : 'am';
            const displayHours = hours % 12 || 12;
            const displayMinutes = minutes.toString().padStart(2, '0');
            lastUpdateElement.textContent = `${displayHours}:${displayMinutes}${ampm}`;
        }

        // Display services in new format
        displayServicesInNewFormat(data.Services, servicesContainer);

    } catch (error) {
        console.error('Error fetching bus arrival data:', error);

        // If we have cached data, keep showing it
        if (cachedBusData && lastUpdateTime) {
            displayServicesInNewFormat(cachedBusData, servicesContainer);
        } else {
            // No cached data available, show error
            servicesContainer.innerHTML = '<div style="color: #e53935; padding: 24px;">Failed to load bus services</div>';
        }
    }
}

// Display services in new format with service rows and arrival cards
function displayServicesInNewFormat(services, container) {
    container.innerHTML = '';

    // Sort services by service number (numerically)
    const sortedServices = services.sort((a, b) => {
        const numA = parseInt(a.ServiceNo);
        const numB = parseInt(b.ServiceNo);
        return numA - numB;
    });

    sortedServices.forEach(service => {
        const serviceRow = document.createElement('div');
        serviceRow.className = 'service-row';

        // Service number and operator
        const serviceNumber = document.createElement('div');
        serviceNumber.className = 'service-number';
        serviceNumber.innerHTML = `
            <span class="number">${service.ServiceNo}</span>
            <span class="operator">${service.Operator}</span>
        `;

        // Arrival cards container
        const arrivalCards = document.createElement('div');
        arrivalCards.className = 'arrival-cards';

        // Add cards for each bus (NextBus, NextBus2, NextBus3)
        const buses = [service.NextBus, service.NextBus2, service.NextBus3].filter(bus => bus && bus.EstimatedArrival);

        buses.forEach(bus => {
            const card = createArrivalCard(bus);
            arrivalCards.appendChild(card);
        });

        serviceRow.appendChild(serviceNumber);
        serviceRow.appendChild(arrivalCards);
        container.appendChild(serviceRow);
    });
}

// Create an arrival card with status tag and bus icon
function createArrivalCard(bus) {
    const card = document.createElement('div');
    card.className = 'arrival-card';
    card.dataset.estimatedArrival = bus.EstimatedArrival;

    const arrivalTime = calculateArrivalTime(bus.EstimatedArrival);
    const load = bus.Load; // SEA, SDA, LSD
    const busType = bus.Type; // SD (single deck), DD (double deck), BD (bendy)

    // Determine status class for color
    let statusClass = 'status-ok'; // Green for SEA
    let statusText = ''; // No text for SEA

    if (load === 'SDA') {
        statusClass = 'status-standing'; // Orange
        statusText = 'standing';
    } else if (load === 'LSD') {
        statusClass = 'status-crowded'; // Red
        statusText = 'crowded';
    }

    // Create time group with optional status tag
    const timeGroup = document.createElement('div');
    timeGroup.className = 'arrival-time-group';

    const arrivalText = document.createElement('span');
    arrivalText.className = 'arrival-text';
    arrivalText.textContent = arrivalTime;
    timeGroup.appendChild(arrivalText);

    // Add status tag only for SDA and LSD
    if (statusText) {
        const statusTag = document.createElement('span');
        statusTag.className = `status-tag status-${load === 'SDA' ? 'standing' : 'crowded'}`;
        statusTag.textContent = statusText;
        timeGroup.appendChild(statusTag);
    }

    // Bus icon with proper SVG based on type
    const busIcon = document.createElement('div');
    busIcon.className = `bus-icon-placeholder ${statusClass}`;
    busIcon.innerHTML = getBusIconSVG(busType);

    card.appendChild(timeGroup);
    card.appendChild(busIcon);

    return card;
}

// Get bus icon SVG based on bus type (SD, DD, BD)
function getBusIconSVG(busType) {
    // Single Deck (SD) icon
    if (busType === 'SD') {
        return `
<svg width="23" height="12" viewBox="0 0 23 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 0.25H20C21.5188 0.25 22.75 1.48122 22.75 3V7C22.75 8.51878 21.5188 9.75 20 9.75H3C1.48122 9.75 0.25 8.51878 0.25 7V2C0.25 1.0335 1.0335 0.25 2 0.25Z" fill="currentColor" stroke="black" stroke-width="0.5"/>
<circle cx="5.5" cy="9.5" r="2.25" fill="white" stroke="black" stroke-width="0.5"/>
<circle cx="17.5" cy="9.5" r="2.25" fill="white" stroke="black" stroke-width="0.5"/>
<rect x="2" y="2" width="3" height="2" fill="white"/>
<rect x="18" y="2" width="3" height="2" fill="white"/>
<rect x="14" y="2" width="3" height="2" fill="white"/>
<rect x="10" y="2" width="3" height="2" fill="white"/>
<rect x="6" y="2" width="3" height="2" fill="white"/>
</svg>
        `;
    }
    // Double Deck (DD) icon - taller version
    else if (busType === 'DD') {
        return `
<svg width="23" height="16" viewBox="0 0 23 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 0.25H20C21.5188 0.25 22.75 1.48122 22.75 3V11C22.75 12.5188 21.5188 13.75 20 13.75H3C1.48122 13.75 0.25 12.5188 0.25 11V2C0.25 1.0335 1.0335 0.25 2 0.25Z" fill="currentColor" stroke="black" stroke-width="0.5"/>
<circle cx="5.5" cy="13.5" r="2.25" fill="white" stroke="black" stroke-width="0.5"/>
<circle cx="17.5" cy="13.5" r="2.25" fill="white" stroke="black" stroke-width="0.5"/>
<rect x="2" y="6" width="3" height="2" fill="white"/>
<rect x="18" y="6" width="3" height="4" fill="white"/>
<rect x="14" y="6" width="3" height="2" fill="white"/>
<rect x="10" y="6" width="3" height="2" fill="white"/>
<rect x="6" y="6" width="3" height="2" fill="white"/>
<rect x="2" y="2" width="3" height="2" fill="white"/>
<rect x="18" y="2" width="3" height="2" fill="white"/>
<rect x="14" y="2" width="3" height="2" fill="white"/>
<rect x="10" y="2" width="3" height="2" fill="white"/>
<rect x="6" y="2" width="3" height="2" fill="white"/>
</svg>

        `;
    }
    // Bendy bus (BD) or default - use single deck
    else {
        return `
<svg width="23" height="12" viewBox="0 0 23 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 0.25H20C21.5188 0.25 22.75 1.48122 22.75 3V7C22.75 8.51878 21.5188 9.75 20 9.75H3C1.48122 9.75 0.25 8.51878 0.25 7V2C0.25 1.0335 1.0335 0.25 2 0.25Z" fill="currentColor" stroke="black" stroke-width="0.5"/>
<circle cx="5.5" cy="9.5" r="2.25" fill="white" stroke="black" stroke-width="0.5"/>
<circle cx="17.5" cy="9.5" r="2.25" fill="white" stroke="black" stroke-width="0.5"/>
<rect x="2" y="2" width="3" height="2" fill="white"/>
<rect x="18" y="2" width="3" height="2" fill="white"/>
<rect x="14" y="2" width="3" height="2" fill="white"/>
<rect x="10" y="2" width="3" height="2" fill="white"/>
<rect x="6" y="2" width="3" height="2" fill="white"/>
</svg>

        `;
    }
}

// Update countdown timers smoothly (called every second)
function updateBusCountdowns() {
    const arrivalElements = document.querySelectorAll('.arrival-card');
    arrivalElements.forEach(element => {
        const estimatedArrival = element.dataset.estimatedArrival;
        if (estimatedArrival) {
            const timeElement = element.querySelector('.arrival-text');
            if (timeElement) {
                timeElement.textContent = calculateArrivalTime(estimatedArrival);
            }
        }
    });
}

// Format time as HH:MM
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Calculate arrival time in minutes
function calculateArrivalTime(estimatedArrival) {
    const now = new Date();
    const arrival = new Date(estimatedArrival);
    const diffMs = arrival - now;
    const diffMins = Math.floor(diffMs / 60000); // Round down to nearest minute

    if (diffMins < 1) {
        return 'Arr';
    } else if (diffMins === 1) {
        return '1 min';
    } else {
        return `${diffMins} min`;
    }
}

// Get color based on bus load
function getLoadColor(load) {
    switch (load) {
        case 'SEA': return '#4CAF50'; // Green - Seats Available
        case 'SDA': return '#FF9800'; // Amber - Standing Available
        case 'LSD': return '#F44336'; // Red - Limited Standing
        default: return '#4285F4';
    }
}

// Get load text
function getLoadText(load) {
    switch (load) {
        case 'SEA': return 'Seats Available';
        case 'SDA': return 'Standing Available';
        case 'LSD': return 'Limited Standing';
        default: return 'Unknown';
    }
}

// Hide bottom sheet
function hideBottomSheet() {
    bottomSheet.classList.remove('active');
    bottomSheet.style.transform = '';

    // Reset active marker to normal state
    if (activeMarker) {
        updateMarkerIcon(activeMarker, activeMarker.stopData, activeMarker.markerSize, false);
        activeMarker = null;
    }
    activeBusStopCode = null;

    // Clear all intervals
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // Clear state
    currentBusStopCode = null;
    cachedBusData = null;
    lastUpdateTime = null;
}

// ============================================================================
// WEATHER SYSTEM
// ============================================================================

/**
 * Weather icon SVG generators
 */
const WeatherIcons = {
    sun: () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML = `
            <circle cx="12" cy="12" r="5" fill="#FFD700"/>
            <g stroke="#FFD700" stroke-width="2" stroke-linecap="round">
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </g>
        `;
        return svg;
    },
    
    cloud: () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML = `
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" 
                  fill="#B0C4DE" stroke="#778899" stroke-width="1"/>
        `;
        return svg;
    },
    
    rain: () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML = `
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" 
                  fill="#708090" stroke="#4682B4" stroke-width="1"/>
            <g stroke="#4682B4" stroke-width="2" stroke-linecap="round">
                <line x1="8" y1="19" x2="8" y2="21"/>
                <line x1="12" y1="19" x2="12" y2="21"/>
                <line x1="16" y1="19" x2="16" y2="21"/>
            </g>
        `;
        return svg;
    },
    
    thunderstorm: () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML = `
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" 
                  fill="#696969" stroke="#2F4F4F" stroke-width="1"/>
            <path d="M13 11l-3 5h2l-1 4 4-6h-2z" fill="#FFD700" stroke="#FFA500" stroke-width="0.5"/>
        `;
        return svg;
    }
};

/**
 * Get weather icon based on forecast text
 */
function getWeatherIcon(forecast) {
    const forecastLower = forecast.toLowerCase();
    
    if (forecastLower.includes('thunder') || forecastLower.includes('heavy')) {
        return WeatherIcons.thunderstorm();
    } else if (forecastLower.includes('rain') || forecastLower.includes('shower')) {
        return WeatherIcons.rain();
    } else if (forecastLower.includes('cloud') || forecastLower.includes('overcast')) {
        return WeatherIcons.cloud();
    } else {
        return WeatherIcons.sun();
    }
}

/**
 * Find which planning area contains a given coordinate
 */
function findPlanningAreaForLocation(latLng) {
    let containingArea = null;
    let checkedCount = 0;
    
    // Normalize the LatLng to plain object
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
    const normalizedPos = { lat, lng };
    
    console.log('   Searching in', lat.toFixed(4), lng.toFixed(4));
    
    map.data.forEach(feature => {
        checkedCount++;
        const geometry = feature.getGeometry();
        if (!geometry) return;
        
        // Check if point is inside this polygon
        if (containsLocation(normalizedPos, geometry)) {
            const areaName = feature.getProperty('PLN_AREA_N');
            const forecast = feature.getProperty('forecast');
            containingArea = {
                name: areaName,
                forecast: forecast,
                borderColor: feature.getProperty('borderColor')
            };
            console.log(`   ✓ Found: ${areaName} (forecast: ${forecast || 'NONE'})`);
        }
    });
    
    if (!containingArea) {
        console.log(`   ✗ Not in any area (checked ${checkedCount} features)`);
    }
    
    return containingArea;
}

/**
 * Check if a location is inside a geometry (Polygon or MultiPolygon)
 */
function containsLocation(latLng, geometry) {
    // Ensure latLng is a plain object
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
    const point = { lat, lng };
    
    if (geometry.getType() === 'Polygon') {
        return isPointInPolygon(point, geometry.getAt(0));
    } else if (geometry.getType() === 'MultiPolygon') {
        // Check each polygon in the multipolygon
        for (let i = 0; i < geometry.getLength(); i++) {
            const polygon = geometry.getAt(i);
            if (isPointInPolygon(point, polygon.getAt(0))) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Ray casting algorithm to check if point is inside polygon
 */
function isPointInPolygon(point, polygon) {
    const x = point.lng, y = point.lat;
    let inside = false;
    
    for (let i = 0, j = polygon.getLength() - 1; i < polygon.getLength(); j = i++) {
        const xi = polygon.getAt(i).lng(), yi = polygon.getAt(i).lat();
        const xj = polygon.getAt(j).lng(), yj = polygon.getAt(j).lat();
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

/**
 * Update weather information for user's current location
 */
function updateUserLocationWeather(position) {
    console.log('🌤️ updateUserLocationWeather called');
    
    if (!weatherData) {
        console.log('⚠️ Weather data not loaded yet');
        return;
    }
    
    const latLng = position || (userLocationMarker ? userLocationMarker.position : null);
    if (!latLng) {
        console.log('⚠️ No user location available');
        return;
    }
    
    // Normalize position to work with both LatLng objects and plain objects
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
    const normalizedPos = { lat, lng };
    
    console.log('📍 User position:', lat.toFixed(4), lng.toFixed(4));
    
    // Ensure weather badge exists (create it if marker was created before weather system)
    if (!userWeatherBadge && userLocationMarker && userLocationMarker.content) {
        console.log('🔨 Creating weather badge retroactively...');
        const blueDot = userLocationMarker.content;
        const weatherBadge = document.createElement('div');
        weatherBadge.className = 'user-weather-badge';
        blueDot.appendChild(weatherBadge);
        userWeatherBadge = weatherBadge;
        console.log('✅ Weather badge created:', userWeatherBadge);
    }
    
    if (!userWeatherBadge) {
        console.log('❌ Could not create weather badge');
        console.log('   - userLocationMarker:', userLocationMarker);
        console.log('   - userLocationMarker.content:', userLocationMarker?.content);
        return;
    }
    
    // Find which planning area the user is in
    console.log('🔍 Finding planning area for location...');
    const area = findPlanningAreaForLocation(normalizedPos);
    
    if (area && area.forecast) {
        // Only update if area changed
        if (currentUserArea?.name !== area.name) {
            currentUserArea = area;
            
            // Update badge with weather icon
            userWeatherBadge.innerHTML = '';
            const icon = getWeatherIcon(area.forecast);
            icon.setAttribute('width', '24');
            icon.setAttribute('height', '24');
            userWeatherBadge.appendChild(icon);
            
            // Add tooltip
            userWeatherBadge.title = `${area.name}: ${area.forecast}`;
            
            // Show badge
            userWeatherBadge.style.opacity = '1';
            
            console.log(`✅ User location weather updated: ${area.name} - ${area.forecast}`);
        }
    } else {
        // User not in any mapped area or no forecast available
        console.log('⚠️ User not in any mapped area or no forecast available');
        if (currentUserArea !== null) {
            currentUserArea = null;
            userWeatherBadge.style.opacity = '0';
        }
    }
}

/**
 * Get border color based on forecast
 */
function getBorderColor(forecast) {
    const forecastLower = forecast.toLowerCase();
    
    if (forecastLower.includes('thunder') || forecastLower.includes('heavy')) {
        return '#FF4444'; // Red for severe weather
    } else if (forecastLower.includes('rain') || forecastLower.includes('shower')) {
        return '#4682B4'; // Blue for rain
    } else if (forecastLower.includes('cloud') || forecastLower.includes('overcast')) {
        return '#B0C4DE'; // Light blue for cloudy
    } else {
        return '#FFD700'; // Gold for fair weather
    }
}

/**
 * Case-insensitive area name matching
 */
function normalizeAreaName(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchAreaNames(geoJsonName, neaName) {
    return normalizeAreaName(geoJsonName) === normalizeAreaName(neaName);
}

/**
 * Fetch weather data from NEA API
 */
async function fetchWeatherData() {
    try {
        const response = await fetch('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Weather data fetched successfully:', data);
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
}

/**
 * Custom Weather Overlay for animations
 */
class WeatherOverlay extends google.maps.OverlayView {
    constructor(bounds, forecast, map) {
        super();
        this.bounds = bounds;
        this.forecast = forecast.toLowerCase();
        this.div = null;
        this.setMap(map);
    }
    
    onAdd() {
        const div = document.createElement('div');
        div.className = 'weather-overlay';
        div.style.position = 'absolute';
        div.style.pointerEvents = 'none';
        
        // Add animation based on forecast
        if (this.forecast.includes('rain') || this.forecast.includes('shower') || this.forecast.includes('thunder')) {
            // Create rain animation
            const canvas = document.createElement('canvas');
            canvas.className = 'rain-canvas';
            div.appendChild(canvas);
            this.canvas = canvas;
            this.animateRain();
        } else if (this.forecast.includes('cloud')) {
            // Create cloud animation
            div.classList.add('cloud-animation');
        }
        
        this.div = div;
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(div);
    }
    
    draw() {
        const overlayProjection = this.getProjection();
        const sw = overlayProjection.fromLatLngToDivPixel(this.bounds.getSouthWest());
        const ne = overlayProjection.fromLatLngToDivPixel(this.bounds.getNorthEast());
        
        if (this.div) {
            this.div.style.left = sw.x + 'px';
            this.div.style.top = ne.y + 'px';
            this.div.style.width = (ne.x - sw.x) + 'px';
            this.div.style.height = (sw.y - ne.y) + 'px';
            
            // Update canvas size if rain animation
            if (this.canvas) {
                this.canvas.width = ne.x - sw.x;
                this.canvas.height = sw.y - ne.y;
            }
        }
    }
    
    animateRain() {
        if (!this.canvas) return;
        
        const ctx = this.canvas.getContext('2d');
        const raindrops = [];
        const numDrops = 50;
        
        // Initialize raindrops
        for (let i = 0; i < numDrops; i++) {
            raindrops.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                speed: 2 + Math.random() * 3,
                length: 10 + Math.random() * 20
            });
        }
        
        const animate = () => {
            if (!this.div || !this.getMap()) return; // Stop if overlay removed
            
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.strokeStyle = 'rgba(70, 130, 180, 0.3)';
            ctx.lineWidth = 1;
            
            raindrops.forEach(drop => {
                ctx.beginPath();
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x, drop.y + drop.length);
                ctx.stroke();
                
                drop.y += drop.speed;
                
                // Reset raindrop when it goes off screen
                if (drop.y > this.canvas.height) {
                    drop.y = -drop.length;
                    drop.x = Math.random() * this.canvas.width;
                }
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    onRemove() {
        if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
        }
    }
    
    hide() {
        if (this.div) {
            this.div.style.visibility = 'hidden';
        }
    }
    
    show() {
        if (this.div) {
            this.div.style.visibility = 'visible';
        }
    }
}

/**
 * Load and display weather data
 */
async function loadWeatherData() {
    try {
        // Fetch weather data
        weatherData = await fetchWeatherData();
        
        if (!weatherData || !weatherData.area_metadata || !weatherData.items || !weatherData.items[0]) {
            console.error('Invalid weather data structure');
            return;
        }
        
        // Load GeoJSON
        map.data.loadGeoJson('MasterPlan2019PlanningAreaBoundaryNoSea.geojson', null, (features) => {
            console.log('GeoJSON loaded, features:', features.length);
            
            // Get latest forecast
            const latestForecast = weatherData.items[0].forecasts;
            const areaMetadata = weatherData.area_metadata;
            
            // Create a map of area names to forecasts
            const forecastMap = {};
            latestForecast.forEach(item => {
                forecastMap[normalizeAreaName(item.area)] = item.forecast;
            });
            
            // Create a map of area names to coordinates
            const coordsMap = {};
            areaMetadata.forEach(item => {
                coordsMap[normalizeAreaName(item.name)] = {
                    lat: item.label_location.latitude,
                    lng: item.label_location.longitude
                };
            });
            
            // Process each feature
            features.forEach(feature => {
                const areaName = feature.getProperty('PLN_AREA_N');
                if (!areaName) return;
                
                const normalizedName = normalizeAreaName(areaName);
                const forecast = forecastMap[normalizedName];
                
                if (forecast) {
                    // Set border style
                    const borderColor = getBorderColor(forecast);
                    feature.setProperty('forecast', forecast);
                    feature.setProperty('borderColor', borderColor);
                    
                    // Create weather marker
                    const coords = coordsMap[normalizedName];
                    if (coords) {
                        createWeatherMarker(coords, forecast, areaName);
                    }
                }
            });
            
            // Apply styles to borders
            updateWeatherBorderStyles();
            
            // Update weather for user's current location if available
            console.log('🌤️ Weather data loaded, updating user location...');
            if (userLocationMarker && userLocationMarker.position) {
                console.log('📍 User marker exists, updating weather...');
                setTimeout(() => {
                    updateUserLocationWeather(userLocationMarker.position);
                }, 100); // Small delay to ensure GeoJSON is fully processed
            } else {
                console.log('⚠️ User marker not available yet');
            }
        });
        
    } catch (error) {
        console.error('❌ Error loading weather data:', error);
    }
}

/**
 * Manually trigger weather update for user location
 * Call this from console if weather badge doesn't appear
 */
window.updateMyWeather = function() {
    console.log('\n===== MANUAL WEATHER UPDATE =====');
    if (!userLocationMarker) {
        console.log('❌ No user location marker');
        return;
    }
    if (!weatherData) {
        console.log('❌ No weather data loaded');
        return;
    }
    console.log('✅ Forcing weather update...');
    updateUserLocationWeather(userLocationMarker.position);
    console.log('=================================\n');
};

/**
 * Create weather marker
 */
function createWeatherMarker(position, forecast, areaName) {
    const iconElement = document.createElement('div');
    iconElement.className = 'weather-marker';
    iconElement.appendChild(getWeatherIcon(forecast));
    
    // Add area name label
    const label = document.createElement('div');
    label.className = 'weather-label';
    label.textContent = areaName;
    iconElement.appendChild(label);
    
    const marker = new google.maps.marker.AdvancedMarkerElement({
        position: position,
        map: map,
        content: iconElement,
        title: `${areaName}: ${forecast}`
    });
    
    marker.forecast = forecast;
    marker.areaName = areaName;
    weatherMarkers.push(marker);
    
    // Update visibility based on current zoom
    updateWeatherMarkerVisibility();
}

/**
 * Update weather border styles
 */
function updateWeatherBorderStyles() {
    map.data.setStyle((feature) => {
        const forecast = feature.getProperty('forecast');
        const borderColor = feature.getProperty('borderColor');
        
        if (forecast && currentZoomLevel <= ZOOM_THRESHOLD) {
            return {
                strokeColor: borderColor,
                strokeWeight: 2,
                fillColor: borderColor,
                fillOpacity: 0.1,
                visible: true
            };
        } else {
            return {
                visible: false
            };
        }
    });
}

/**
 * Update weather marker visibility based on zoom
 */
function updateWeatherMarkerVisibility() {
    const isZoomedOut = currentZoomLevel <= ZOOM_THRESHOLD;
    
    weatherMarkers.forEach(marker => {
        if (marker.content) {
            if (isZoomedOut) {
                marker.content.style.opacity = '1';
                marker.content.style.transform = 'scale(1)';
                marker.content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            } else {
                marker.content.style.opacity = '0';
                marker.content.style.transform = 'scale(0.5)';
                marker.content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            }
        }
    });
}

/**
 * Create weather overlays for zoomed-in view
 */
function createWeatherOverlays() {
    // Clear existing overlays
    weatherOverlays.forEach(overlay => overlay.setMap(null));
    weatherOverlays = [];
    
    if (currentZoomLevel <= ZOOM_THRESHOLD) return;
    
    // Create overlays for visible regions
    map.data.forEach(feature => {
        const forecast = feature.getProperty('forecast');
        if (!forecast) return;
        
        const geometry = feature.getGeometry();
        if (!geometry) return;
        
        // Get bounds of the geometry
        const bounds = new google.maps.LatLngBounds();
        
        if (geometry.getType() === 'Polygon') {
            geometry.getAt(0).forEach(latLng => {
                bounds.extend(latLng);
            });
        } else if (geometry.getType() === 'MultiPolygon') {
            geometry.forEach(polygon => {
                polygon.getAt(0).forEach(latLng => {
                    bounds.extend(latLng);
                });
            });
        }
        
        // Create overlay
        const overlay = new WeatherOverlay(bounds, forecast, map);
        weatherOverlays.push(overlay);
    });
}

/**
 * Handle zoom changes
 */
function handleWeatherZoomChange() {
    const newZoom = map.getZoom();
    const previousZoom = currentZoomLevel;
    currentZoomLevel = newZoom;
    
    console.log(`Zoom changed: ${previousZoom} -> ${newZoom}`);
    
    // Update marker visibility
    updateWeatherMarkerVisibility();
    
    // Update border styles
    updateWeatherBorderStyles();
    
    // Handle overlays
    if (newZoom > ZOOM_THRESHOLD && previousZoom <= ZOOM_THRESHOLD) {
        // Zoomed in - create overlays
        createWeatherOverlays();
    } else if (newZoom <= ZOOM_THRESHOLD && previousZoom > ZOOM_THRESHOLD) {
        // Zoomed out - remove overlays
        weatherOverlays.forEach(overlay => overlay.setMap(null));
        weatherOverlays = [];
    }
}

/**
 * Initialize weather system
 */
function initWeatherSystem() {
    console.log('Initializing weather system...');
    
    // Load initial weather data
    loadWeatherData();
    
    // Set up zoom listener
    map.addListener('zoom_changed', handleWeatherZoomChange);
    
    // Try to update user location weather after a delay (in case marker exists)
    setTimeout(() => {
        console.log('🔄 Attempting delayed user location weather update...');
        if (userLocationMarker && userLocationMarker.position && weatherData) {
            updateUserLocationWeather(userLocationMarker.position);
        }
    }, 3000); // 3 second delay to ensure everything is loaded
    
    // Refresh weather data every 5 minutes
    weatherRefreshInterval = setInterval(() => {
        console.log('Refreshing weather data...');
        
        // Clear existing markers and overlays
        weatherMarkers.forEach(marker => marker.map = null);
        weatherMarkers = [];
        weatherOverlays.forEach(overlay => overlay.setMap(null));
        weatherOverlays = [];
        
        // Clear GeoJSON layer
        map.data.forEach(feature => {
            map.data.remove(feature);
        });
        
        // Reload weather data
        loadWeatherData();
    }, 5 * 60 * 1000); // 5 minutes
}

// ============================================================================
// END WEATHER SYSTEM
// ============================================================================

// Debug helper function - accessible from console
window.debugWeather = function() {
    console.log('===== WEATHER DEBUG INFO =====');
    console.log('Weather data loaded:', weatherData !== null);
    console.log('User location marker:', userLocationMarker !== null);
    console.log('User weather badge:', userWeatherBadge !== null);
    console.log('Current user area:', currentUserArea);
    
    if (userLocationMarker && userLocationMarker.position) {
        console.log('User position:', {
            lat: userLocationMarker.position.lat,
            lng: userLocationMarker.position.lng
        });
        
        // Try to find the area
        const area = findPlanningAreaForLocation(userLocationMarker.position);
        console.log('Found area:', area);
        
        // Force update
        console.log('Forcing weather update...');
        updateUserLocationWeather(userLocationMarker.position);
    }
    
    let featureCount = 0;
    let featuresWithForecast = 0;
    map.data.forEach(feature => {
        featureCount++;
        if (feature.getProperty('forecast')) {
            featuresWithForecast++;
        }
    });
    console.log(`GeoJSON features: ${featureCount}, with forecast: ${featuresWithForecast}`);
    console.log('============================');
};

console.log('💡 Tip: Run debugWeather() or updateMyWeather() in console');
console.log('   debugWeather()    - Full diagnostic info');
console.log('   updateMyWeather() - Force weather update for your location');