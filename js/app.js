// Initialize and add the map
let map;
let userLocationMarker;
let accuracyCircle;
let watchId;
let deviceHeading = null; // Store device compass heading
let bottomSheet; // Bottom sheet element

function initMap() {
    // The map
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
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

        // Load bus stops from local JSON file
        loadBusStopsFromJSON();

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

// Store bus stop markers
const busStopMarkers = [];

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

    // Clear existing markers
    busStopMarkers.forEach(marker => marker.setMap(null));
    busStopMarkers.length = 0;

    // Don't show bus stops if zoomed out too far
    if (zoomLevel < 14) {
        console.log(`Zoom level ${zoomLevel} - bus stops hidden (need zoom >= 14)`);
        return;
    }

    // Adjust radius and icon size based on zoom level
    let radiusKm, iconSize;
    if (zoomLevel >= 16) {
        radiusKm = 1; // Close up - less stops
        iconSize = 40; // Bigger icons
    } else {
        radiusKm = 2; // Wider view - more stops
        iconSize = 20; // Smaller icons
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

    // Create markers for nearby stops
    nearbyStops.forEach(stop => {
        createBusStopMarker(stop, iconSize);
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

// Create bus stop marker on map
function createBusStopMarker(stop, size = 28) {
    const svgIcon = `
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Uploaded to: SVG Repo, www.svgrepo.com, Transformed by: SVG Repo Mixer Tools -->
<svg fill="#ffffff" height="${size}px" width="${size}px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-39.5 -39.5 474.00 474.00" xml:space="preserve" stroke="#ffffff" transform="matrix(-1, 0, 0, 1, 0, 0)rotate(0)">
<g id="SVGRepo_bgCarrier" stroke-width="0">
<rect x="-39.5" y="-39.5" width="474.00" height="474.00" rx="66.36" fill="#000000" strokewidth="0"/>
</g>
<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="3.16"/>
<g id="SVGRepo_iconCarrier"> <g> <path d="M322.082,139.838h-12.395c-3.145,0-5.693,2.55-5.693,5.694v13.845c-1.627-12.684-3.402-26.597-4.619-36.319 C296.782,104.152,287.384,75,197.501,75c-89.886,0-99.471,29.156-102.066,48.059c-1.478,11.8-2.953,23.6-4.43,35.4v-12.926 c0-3.145-2.549-5.694-5.693-5.694H72.918c-3.143,0-5.693,2.55-5.693,5.694v31.319c0,3.145,2.551,5.694,5.693,5.694h12.395 c1.006,0,1.949-0.263,2.77-0.721c-0.37,2.958-0.74,5.915-1.11,8.873v77.735c-1.989,1.507-3.28,3.887-3.28,6.571v11.882 c0,4.55,3.696,8.247,8.247,8.247h17.183v14.34c0,5.805,4.723,10.527,10.527,10.527h17.676c5.805,0,10.527-4.723,10.527-10.527 v-14.34h99.293v14.34c0,5.805,4.723,10.527,10.527,10.527h17.676c5.807,0,10.531-4.723,10.531-10.527v-14.34h17.184 c4.55,0,8.246-3.697,8.246-8.247v-11.882c0-2.685-1.293-5.066-3.282-6.572v-77.733c0,0-0.445-3.444-1.148-8.898 c0.829,0.472,1.787,0.746,2.81,0.746h12.395c3.143,0,5.693-2.55,5.693-5.694v-31.319 C327.775,142.388,325.225,139.838,322.082,139.838z M161.602,95.499h71.789c2.967,0,5.36,2.403,5.36,5.364 c0,2.957-2.394,5.359-5.36,5.359h-71.789c-2.96,0-5.354-2.402-5.354-5.359C156.248,97.902,158.642,95.499,161.602,95.499z M142.798,254.449c-9.156,0-16.571-7.423-16.571-16.572c0-9.158,7.415-16.575,16.571-16.575c9.154,0,16.57,7.417,16.57,16.575 C159.368,247.026,151.952,254.449,142.798,254.449z M252.203,254.449c-9.158,0-16.573-7.423-16.573-16.572 c0-9.158,7.415-16.575,16.573-16.575c9.148,0,16.571,7.417,16.571,16.575C268.774,247.026,261.352,254.449,252.203,254.449z M268.423,182.545c-36.563,0-105.282-0.002-141.844,0.001c-4.691,0-8.27-3.686-7.984-8.243c0.884-14.199,1.773-28.396,2.664-42.596 c0.281-4.556,4.098-8.25,8.511-8.25c34.431,0,101.026,0,135.459,0c4.413,0,8.229,3.694,8.514,8.25 c0.886,14.199,1.772,28.396,2.655,42.596C276.688,178.859,273.11,182.545,268.423,182.545z"/> <path d="M313.002,0H82C36.785,0,0,36.784,0,81.998v230.993C0,358.211,36.785,395,82,395h231.002 C358.216,395,395,358.211,395,312.991V81.998C395,36.784,358.216,0,313.002,0z M380,312.991C380,349.94,349.944,380,313.002,380H82 c-36.944,0-67-30.06-67-67.009V81.998C15,45.055,45.056,15,82,15h231.002C349.944,15,380,45.055,380,81.998V312.991z"/> </g> </g>
</svg>`;

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgIcon, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: stop.Latitude, lng: stop.Longitude },
        map: map,
        content: svgElement,
        title: `${stop.Description || 'Bus Stop'}\n${stop.RoadName || ''}\nStop: ${stop.BusStopCode || ''}`
    });

    // Add click listener to show bottom sheet
    marker.addListener('click', () => {
        showBottomSheet(stop);
    });

    busStopMarkers.push(marker);
}

// Initialize bottom sheet functionality
function initBottomSheet() {
    bottomSheet = document.getElementById('bottomSheet');
    const closeBtn = document.getElementById('closeBottomSheet');
    const handle = document.querySelector('.bottom-sheet-handle');

    // Close button
    closeBtn.addEventListener('click', hideBottomSheet);

    // Click outside to close
    bottomSheet.addEventListener('click', (e) => {
        if (e.target === bottomSheet) {
            hideBottomSheet();
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
    
    // Set title with bus stop code, description, and road name on new line
    title.innerHTML = `${stop.BusStopCode} - ${stop.Description}<br><span style="font-size: 14px; font-weight: 400; color: #666;">${stop.RoadName}</span>`;
    
    // Add active class to show the sheet
    bottomSheet.classList.add('active');
    
    // Fetch real bus arrival data
    await fetchBusArrivalData(stop.BusStopCode);
}

// Fetch and display bus arrival data from LTA API
async function fetchBusArrivalData(busStopCode) {
    const busServicesContainer = document.getElementById('busServices');
    const incomingBusesContainer = document.getElementById('incomingBuses');
    
    // Show loading state
    busServicesContainer.innerHTML = '<div style="color: #999;">Loading...</div>';
    incomingBusesContainer.innerHTML = '<div style="color: #999;">Loading...</div>';
    
    try {
        const response = await fetch(`/api/bus-arrival?busStopCode=${busStopCode}`);
        const data = await response.json();
        
        if (!data.Services || data.Services.length === 0) {
            busServicesContainer.innerHTML = '<div style="color: #999;">No buses available at this stop</div>';
            incomingBusesContainer.innerHTML = '<div style="color: #999;">No incoming buses</div>';
            return;
        }
        
        // Display available bus services
        displayBusServices(data.Services, busServicesContainer);
        
        // Display incoming buses
        displayIncomingBuses(data.Services, incomingBusesContainer);
        
    } catch (error) {
        console.error('Error fetching bus arrival data:', error);
        busServicesContainer.innerHTML = '<div style="color: #e53935;">Failed to load bus services</div>';
        incomingBusesContainer.innerHTML = '<div style="color: #e53935;">Failed to load arrival times</div>';
    }
}

// Display bus service numbers
function displayBusServices(services, container) {
    container.innerHTML = '';
    services.forEach(service => {
        const serviceElement = document.createElement('div');
        serviceElement.className = 'bus-number';
        serviceElement.textContent = service.ServiceNo;
        container.appendChild(serviceElement);
    });
}

// Display incoming buses with arrival times
function displayIncomingBuses(services, container) {
    container.innerHTML = '';
    
    // Collect all incoming buses from all services
    const allBuses = [];
    services.forEach(service => {
        if (service.NextBus && service.NextBus.EstimatedArrival) {
            allBuses.push({
                serviceNo: service.ServiceNo,
                operator: service.Operator,
                ...service.NextBus
            });
        }
        if (service.NextBus2 && service.NextBus2.EstimatedArrival) {
            allBuses.push({
                serviceNo: service.ServiceNo,
                operator: service.Operator,
                ...service.NextBus2
            });
        }
        if (service.NextBus3 && service.NextBus3.EstimatedArrival) {
            allBuses.push({
                serviceNo: service.ServiceNo,
                operator: service.Operator,
                ...service.NextBus3
            });
        }
    });
    
    // Sort by arrival time
    allBuses.sort((a, b) => new Date(a.EstimatedArrival) - new Date(b.EstimatedArrival));
    
    // Display up to 10 nearest buses
    const displayBuses = allBuses.slice(0, 10);
    
    if (displayBuses.length === 0) {
        container.innerHTML = '<div style="color: #999;">No incoming buses</div>';
        return;
    }
    
    displayBuses.forEach(bus => {
        const busElement = document.createElement('div');
        busElement.className = 'bus-arrival';
        
        const arrivalTime = calculateArrivalTime(bus.EstimatedArrival);
        const loadColor = getLoadColor(bus.Load);
        const loadText = getLoadText(bus.Load);
        
        busElement.innerHTML = `
            <div class="bus-arrival-number" style="background: ${loadColor};">${bus.serviceNo}</div>
            <div class="bus-arrival-info">
                <div class="arrival-time">${arrivalTime}</div>
                <div class="bus-load">${loadText}${bus.Feature === 'WAB' ? ' • ♿' : ''}</div>
            </div>
        `;
        
        container.appendChild(busElement);
    });
}

// Calculate arrival time in minutes
function calculateArrivalTime(estimatedArrival) {
    const now = new Date();
    const arrival = new Date(estimatedArrival);
    const diffMs = arrival - now;
    const diffMins = Math.floor(diffMs / 60000); // Round down to nearest minute
    
    if (diffMins < 1) {
        return 'Arriving';
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
}