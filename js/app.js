// Initialize and add the map
let map;
let userLocationMarker;
let accuracyCircle;
let watchId;
let deviceHeading = null; // Store device compass heading

function initMap() {
    // Bus stop location: 258 Bedok Rd, Singapore
    const busStopLocation = { lat: 1.330009, lng: 103.948087 };
    // The map
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
        center: busStopLocation,
        fullscreenControl: false,
        mapId: "fbef370cf798c9795d634795",
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        colorScheme: google.maps.ColorScheme.DARK, // Set the map to dark mode
        
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
            }
            
            // Request orientation permission on button click (works on iOS)
            requestOrientationPermission();
        });

        // Create bus stop marker near Expo station
        createBusStopMarker();

        // Check if iOS and show compass prompt
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS: Show prompt immediately, then request permissions when user clicks
            if (navigator.geolocation) {
                startLocationTracking();
                // Show compass prompt after a brief delay
                setTimeout(() => {
                    if (confirm('Enable compass to see direction arrow?')) {
                        requestOrientationPermission();
                    }
                }, 1000);
            }
        } else {
            // Non-iOS: start both automatically
            if (navigator.geolocation) {
                startOrientationTracking();
                startLocationTracking();
            }
        }
    });
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

function createBusStopMarker() {
    // Bus stop location: 258 Bedok Rd, Singapore
    const busStopLocation = { lat: 1.330009, lng: 103.948087 };

    // Create bus stop icon
    const busStopIcon = document.createElement('div');
    busStopIcon.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#1976D2"/>
            <rect x="6" y="6" width="12" height="8" fill="white"/>
            <circle cx="9" cy="17" r="1.5" fill="white"/>
            <circle cx="15" cy="17" r="1.5" fill="white"/>
            <line x1="12" y1="6" x2="12" y2="14" stroke="#1976D2" stroke-width="1"/>
        </svg>
    `;
    busStopIcon.className = 'bus-stop-icon';

    // Create the bus stop marker
    new google.maps.marker.AdvancedMarkerElement({
        position: busStopLocation,
        map: map,
        content: busStopIcon,
        title: "Bus Stop - Expo Station"
    });
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
                    },
                    {
                        enableHighAccuracy: true,
                        maximumAge: 0,
                        timeout: 5000
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
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg += "Location information is unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMsg += "Location request timed out.";
                    break;
                default:
                    errorMsg += "An unknown error occurred.";
            }
            alert(errorMsg);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function updateUserLocationMarker(position) {
    const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
    };
    const accuracy = position.coords.accuracy;
    // Use device orientation heading if available, otherwise fallback to GPS heading
    const heading = deviceHeading !== null ? deviceHeading : position.coords.heading;

    // Update or create the blue dot marker
    if (userLocationMarker) {
        userLocationMarker.setMap(null);
    }

    // Create blue dot marker with direction indicator
    const blueDot = document.createElement('div');
    blueDot.className = 'blue-dot';

    // Add direction wedge if heading is available
    if (heading !== null && !isNaN(heading)) {
        const wedge = document.createElement('div');
        wedge.className = 'direction-wedge';
        wedge.style.transform = `rotate(${heading}deg)`;
        blueDot.appendChild(wedge);
    }

    userLocationMarker = new google.maps.marker.AdvancedMarkerElement({
        position: pos,
        map: map,
        content: blueDot,
        title: "Your Location"
    });

    // Update or create accuracy circle
    if (accuracyCircle) {
        accuracyCircle.setMap(null);
    }

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
}