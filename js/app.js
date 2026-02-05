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
              <svg
                width="22"
                height="15"
                viewBox="0 0 22 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20.0588 2.58824H16.1765V1.94118C16.1765 1.42634 15.972 0.932598 15.6079 0.568557C15.2439 0.204516 14.7501 0 14.2353 0H7.76471C7.24987 0 6.75613 0.204516 6.39209 0.568557C6.02805 0.932598 5.82353 1.42634 5.82353 1.94118V2.58824H1.94118C1.42634 2.58824 0.932599 2.79275 0.568558 3.15679C0.204516 3.52083 0 4.01458 0 4.52941V10.3529C0 10.8678 0.204516 11.3615 0.568558 11.7256C0.932599 12.0896 1.42634 12.2941 1.94118 12.2941H2.67882C2.82783 12.8424 3.15312 13.3264 3.6045 13.6715C4.05589 14.0166 4.60829 14.2036 5.17647 14.2036C5.74466 14.2036 6.29705 14.0166 6.74844 13.6715C7.19982 13.3264 7.52511 12.8424 7.67412 12.2941H14.3259C14.4749 12.8424 14.8002 13.3264 15.2516 13.6715C15.7029 14.0166 16.2553 14.2036 16.8235 14.2036C17.3917 14.2036 17.9441 14.0166 18.3955 13.6715C18.8469 13.3264 19.1722 12.8424 19.3212 12.2941H20.0588C20.5737 12.2941 21.0674 12.0896 21.4314 11.7256C21.7955 11.3615 22 10.8678 22 10.3529V4.52941C22 4.01458 21.7955 3.52083 21.4314 3.15679C21.0674 2.79275 20.5737 2.58824 20.0588 2.58824ZM7.11765 1.94118C7.11765 1.76957 7.18582 1.60498 7.30717 1.48364C7.42851 1.36229 7.5931 1.29412 7.76471 1.29412H14.2353C14.4069 1.29412 14.5715 1.36229 14.6928 1.48364C14.8142 1.60498 14.8824 1.76957 14.8824 1.94118V2.58824H7.11765V1.94118ZM5.17647 12.9412C4.92052 12.9412 4.67031 12.8653 4.4575 12.7231C4.24468 12.5809 4.07881 12.3788 3.98086 12.1423C3.88291 11.9058 3.85729 11.6456 3.90722 11.3946C3.95715 11.1436 4.08041 10.913 4.26139 10.732C4.44238 10.551 4.67297 10.4277 4.924 10.3778C5.17503 10.3279 5.43524 10.3535 5.67171 10.4515C5.90818 10.5494 6.11029 10.7153 6.25249 10.9281C6.39469 11.1409 6.47059 11.3911 6.47059 11.6471C6.47059 11.9903 6.33424 12.3194 6.09155 12.5621C5.84886 12.8048 5.51969 12.9412 5.17647 12.9412ZM16.8235 12.9412C16.5676 12.9412 16.3174 12.8653 16.1046 12.7231C15.8917 12.5809 15.7259 12.3788 15.6279 12.1423C15.53 11.9058 15.5043 11.6456 15.5543 11.3946C15.6042 11.1436 15.7275 10.913 15.9085 10.732C16.0894 10.551 16.32 10.4277 16.5711 10.3778C16.8221 10.3279 17.0823 10.3535 17.3188 10.4515C17.5552 10.5494 17.7574 10.7153 17.8995 10.9281C18.0417 11.1409 18.1176 11.3911 18.1176 11.6471C18.1176 11.9903 17.9813 12.3194 17.7386 12.5621C17.4959 12.8048 17.1668 12.9412 16.8235 12.9412ZM20.7059 10.3529C20.7059 10.5246 20.6377 10.6891 20.5164 10.8105C20.395 10.9318 20.2304 11 20.0588 11H19.3276C19.3276 10.9094 19.2694 10.8318 19.2435 10.7412C19.2176 10.6506 19.2435 10.6571 19.1982 10.6182C19.1352 10.477 19.0617 10.3408 18.9782 10.2106L18.9135 10.1329C18.8432 10.0361 18.7676 9.94319 18.6871 9.85471L18.5641 9.74471C18.4925 9.67312 18.4145 9.60815 18.3312 9.55059L18.1824 9.45353L17.9235 9.31118L17.7618 9.24C17.6625 9.203 17.5609 9.17274 17.4576 9.14941C17.4089 9.13353 17.3592 9.12057 17.3088 9.11059C16.989 9.04166 16.6581 9.04166 16.3382 9.11059C16.2879 9.12057 16.2382 9.13353 16.1894 9.14941C16.0861 9.17274 15.9845 9.203 15.8853 9.24L15.7235 9.31118L15.4647 9.45353L15.3159 9.55059C15.2326 9.60815 15.1546 9.67312 15.0829 9.74471C15.0441 9.78353 14.9988 9.81588 14.9665 9.85471C14.882 9.94147 14.8041 10.0345 14.7335 10.1329L14.6688 10.2106C14.5854 10.3408 14.5118 10.477 14.4488 10.6182C14.4488 10.6571 14.4488 10.7024 14.4035 10.7412C14.3582 10.78 14.3388 10.9094 14.3194 11H7.68059C7.65722 10.9115 7.62693 10.8249 7.59 10.7412L7.55118 10.6182C7.48816 10.477 7.41462 10.3408 7.33118 10.2106L7.26647 10.1329C7.19592 10.0345 7.11805 9.94147 7.03353 9.85471C7.00118 9.81588 6.95588 9.78353 6.91706 9.74471C6.84541 9.67312 6.76745 9.60815 6.68412 9.55059L6.53529 9.45353L6.27647 9.31118L6.11471 9.24C6.01549 9.203 5.91388 9.17274 5.81059 9.14941C5.76179 9.13353 5.7121 9.12057 5.66177 9.11059C5.34191 9.04166 5.01103 9.04166 4.69118 9.11059C4.64084 9.12057 4.59115 9.13353 4.54235 9.14941C4.43906 9.17274 4.33746 9.203 4.23824 9.24L4.07647 9.31118L3.81765 9.45353L3.66882 9.55059C3.58549 9.60815 3.50753 9.67312 3.43588 9.74471C3.39706 9.78353 3.35176 9.81588 3.31941 9.85471C3.23489 9.94147 3.15703 10.0345 3.08647 10.1329L3.02176 10.2106C2.93832 10.3408 2.86478 10.477 2.80176 10.6182L2.76294 10.7412C2.72601 10.8249 2.69572 10.9115 2.67235 11H1.94118C1.76957 11 1.60498 10.9318 1.48364 10.8105C1.36229 10.6891 1.29412 10.5246 1.29412 10.3529V4.52941C1.29412 4.3578 1.36229 4.19322 1.48364 4.07187C1.60498 3.95052 1.76957 3.88235 1.94118 3.88235H20.0588C20.2304 3.88235 20.395 3.95052 20.5164 4.07187C20.6377 4.19322 20.7059 4.3578 20.7059 4.52941V10.3529Z"
                  fill="black"
                />
                <path
                  class="bus-color"
                  d="M20.7059 10.3529C20.7059 10.5246 20.6377 10.6891 20.5164 10.8105C20.395 10.9318 20.2304 11 20.0588 11H19.3276C19.3276 10.9094 19.2694 10.8318 19.2435 10.7412C19.2176 10.6506 19.2435 10.6571 19.1982 10.6182C19.1352 10.477 19.0617 10.3408 18.9782 10.2106L18.9135 10.1329C18.8432 10.0361 18.7676 9.94319 18.6871 9.85471L18.5641 9.74471C18.4925 9.67312 18.4145 9.60815 18.3312 9.55059L18.1824 9.45353L17.9235 9.31118L17.7618 9.24C17.6625 9.203 17.5609 9.17274 17.4576 9.14941C17.4089 9.13353 17.3592 9.12057 17.3088 9.11059C16.989 9.04166 16.6581 9.04166 16.3382 9.11059C16.2879 9.12057 16.2382 9.13353 16.1894 9.14941C16.0861 9.17274 15.9845 9.203 15.8853 9.24L15.7235 9.31118L15.4647 9.45353L15.3159 9.55059C15.2326 9.60815 15.1546 9.67312 15.0829 9.74471C15.0441 9.78353 14.9988 9.81588 14.9665 9.85471C14.882 9.94147 14.8041 10.0345 14.7335 10.1329L14.6688 10.2106C14.5854 10.3408 14.5118 10.477 14.4488 10.6182C14.4488 10.6571 14.4488 10.7024 14.4035 10.7412C14.3582 10.78 14.3388 10.9094 14.3194 11H7.68059C7.65722 10.9115 7.62693 10.8249 7.59 10.7412L7.55118 10.6182C7.48816 10.477 7.41462 10.3408 7.33118 10.2106L7.26647 10.1329C7.19592 10.0345 7.11805 9.94147 7.03353 9.85471C7.00118 9.81588 6.95588 9.78353 6.91706 9.74471C6.84541 9.67312 6.76745 9.60815 6.68412 9.55059L6.53529 9.45353L6.27647 9.31118L6.11471 9.24C6.01549 9.203 5.91388 9.17274 5.81059 9.14941C5.76179 9.13353 5.7121 9.12057 5.66177 9.11059C5.34191 9.04166 5.01103 9.04166 4.69118 9.11059C4.64084 9.12057 4.59115 9.13353 4.54235 9.14941C4.43906 9.17274 4.33746 9.203 4.23824 9.24L4.07647 9.31118L3.81765 9.45353L3.66882 9.55059C3.58549 9.60815 3.50753 9.67312 3.43588 9.74471C3.39706 9.78353 3.35176 9.81588 3.31941 9.85471C3.23489 9.94147 3.15703 10.0345 3.08647 10.1329L3.02176 10.2106C2.93832 10.3408 2.86478 10.477 2.80176 10.6182L2.76294 10.7412C2.72601 10.8249 2.69572 10.9115 2.67235 11H1.94118C1.76957 11 1.60498 10.9318 1.48364 10.8105C1.36229 10.6891 1.29412 10.5246 1.29412 10.3529V4.52941C1.29412 4.3578 1.36229 4.19322 1.48364 4.07187C1.60498 3.95052 1.76957 3.88235 1.94118 3.88235H20.0588C20.2304 3.88235 20.395 3.95052 20.5164 4.07187C20.6377 4.19322 20.7059 4.3578 20.7059 4.52941V10.3529Z"
                  fill="#1AB24D"
                />
                <path
                  d="M5.17647 12.9412C4.92052 12.9412 4.67031 12.8653 4.4575 12.7231C4.24468 12.5809 4.07881 12.3788 3.98086 12.1423C3.88291 11.9058 3.85729 11.6456 3.90722 11.3946C3.95715 11.1436 4.08041 10.913 4.26139 10.732C4.44238 10.551 4.67297 10.4277 4.924 10.3778C5.17503 10.3279 5.43524 10.3535 5.67171 10.4515C5.90818 10.5494 6.11029 10.7153 6.25249 10.9281C6.39469 11.1409 6.47059 11.3911 6.47059 11.6471C6.47059 11.9903 6.33424 12.3194 6.09155 12.5621C5.84886 12.8048 5.51969 12.9412 5.17647 12.9412Z"
                  fill="white"
                />
                <path
                  d="M16.8235 12.9412C16.5676 12.9412 16.3174 12.8653 16.1046 12.7231C15.8917 12.5809 15.7259 12.3788 15.6279 12.1423C15.53 11.9058 15.5043 11.6456 15.5543 11.3946C15.6042 11.1436 15.7275 10.913 15.9085 10.732C16.0894 10.551 16.32 10.4277 16.5711 10.3778C16.8221 10.3279 17.0823 10.3535 17.3188 10.4515C17.5552 10.5494 17.7574 10.7153 17.8995 10.9281C18.0417 11.1409 18.1176 11.3911 18.1176 11.6471C18.1176 11.9903 17.9813 12.3194 17.7386 12.5621C17.4959 12.8048 17.1668 12.9412 16.8235 12.9412Z"
                  fill="white"
                />
                <path
                  d="M7.11765 1.94118C7.11765 1.76957 7.18582 1.60498 7.30717 1.48364C7.42851 1.36229 7.5931 1.29412 7.76471 1.29412H14.2353C14.4069 1.29412 14.5715 1.36229 14.6928 1.48364C14.8142 1.60498 14.8824 1.76957 14.8824 1.94118V2.58824H7.11765V1.94118Z"
                  fill="white"
                />
                <path
                  d="M19.4118 4.5293H2.58826C2.41665 4.5293 2.25206 4.59747 2.13072 4.71882C2.00937 4.84016 1.9412 5.00475 1.9412 5.17636V7.76459C1.9412 7.9362 2.00937 8.10078 2.13072 8.22213C2.25206 8.34348 2.41665 8.41165 2.58826 8.41165H19.4118C19.5834 8.41165 19.748 8.34348 19.8693 8.22213C19.9907 8.10078 20.0588 7.9362 20.0588 7.76459V5.17636C20.0588 5.00475 19.9907 4.84016 19.8693 4.71882C19.748 4.59747 19.5834 4.5293 19.4118 4.5293ZM9.05884 5.82341H10.353V7.11753H9.05884V5.82341ZM7.76473 7.11753H6.47061V5.82341H7.76473V7.11753ZM11.6471 5.82341H12.9412V7.11753H11.6471V5.82341ZM14.2353 5.82341H15.5294V7.11753H14.2353V5.82341ZM3.23532 5.82341H5.17649V7.11753H3.23532V5.82341ZM18.7647 7.11753H16.8236V5.82341H18.7647V7.11753Z"
                  fill="black"
                />
                <path
                  d="M3.23532 5.82341H5.17649V7.11753H3.23532V5.82341Z"
                  fill="white"
                />
                <path
                  d="M7.76473 7.11753H6.47061V5.82341H7.76473V7.11753Z"
                  fill="white"
                />
                <path
                  d="M9.05884 5.82341H10.353V7.11753H9.05884V5.82341Z"
                  fill="white"
                />
                <path
                  d="M11.6471 5.82341H12.9412V7.11753H11.6471V5.82341Z"
                  fill="white"
                />
                <path
                  d="M14.2353 5.82341H15.5294V7.11753H14.2353V5.82341Z"
                  fill="white"
                />
                <path
                  d="M18.7647 7.11753H16.8236V5.82341H18.7647V7.11753Z"
                  fill="white"
                />
              </svg>
        `;
    }
    // Double Deck (DD) icon - taller version
    else if (busType === 'DD') {
        return `
              <svg
                width="22"
                height="17"
                viewBox="0 0 22 17"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20.0588 0H1.94118C1.42635 0 0.932606 0.204516 0.568565 0.568557C0.204524 0.932598 7.62939e-06 1.42634 7.62939e-06 1.94118V12.9412C7.62939e-06 13.456 0.204524 13.9498 0.568565 14.3138C0.932606 14.6778 1.42635 14.8824 1.94118 14.8824H2.67883C2.82784 15.4307 3.15313 15.9147 3.60451 16.2598C4.0559 16.6049 4.60829 16.7918 5.17648 16.7918C5.74466 16.7918 6.29706 16.6049 6.74845 16.2598C7.19983 15.9147 7.52512 15.4307 7.67413 14.8824H14.3259C14.4749 15.4307 14.8002 15.9147 15.2516 16.2598C15.703 16.6049 16.2554 16.7918 16.8235 16.7918C17.3917 16.7918 17.9441 16.6049 18.3955 16.2598C18.8469 15.9147 19.1722 15.4307 19.3212 14.8824H20.0588C20.5737 14.8824 21.0674 14.6778 21.4314 14.3138C21.7955 13.9498 22 13.456 22 12.9412V1.94118C22 1.42634 21.7955 0.932598 21.4314 0.568557C21.0674 0.204516 20.5737 0 20.0588 0ZM5.17648 15.5294C4.92053 15.5294 4.67032 15.4535 4.45751 15.3113C4.24469 15.1691 4.07882 14.967 3.98087 14.7305C3.88292 14.4941 3.85729 14.2339 3.90723 13.9828C3.95716 13.7318 4.08041 13.5012 4.2614 13.3202C4.44238 13.1392 4.67297 13.016 4.92401 12.966C5.17504 12.9161 5.43525 12.9417 5.67172 13.0397C5.90818 13.1376 6.1103 13.3035 6.2525 13.5163C6.3947 13.7291 6.4706 13.9793 6.4706 14.2353C6.4706 14.5785 6.33425 14.9077 6.09156 15.1504C5.84886 15.3931 5.5197 15.5294 5.17648 15.5294ZM16.8235 15.5294C16.5676 15.5294 16.3174 15.4535 16.1046 15.3113C15.8917 15.1691 15.7259 14.967 15.6279 14.7305C15.53 14.4941 15.5044 14.2339 15.5543 13.9828C15.6042 13.7318 15.7275 13.5012 15.9085 13.3202C16.0894 13.1392 16.32 13.016 16.5711 12.966C16.8221 12.9161 17.0823 12.9417 17.3188 13.0397C17.5552 13.1376 17.7574 13.3035 17.8996 13.5163C18.0418 13.7291 18.1177 13.9793 18.1177 14.2353C18.1177 14.5785 17.9813 14.9077 17.7386 15.1504C17.4959 15.3931 17.1668 15.5294 16.8235 15.5294ZM20.7059 12.9412C20.7059 13.1128 20.6377 13.2774 20.5164 13.3987C20.395 13.5201 20.2304 13.5882 20.0588 13.5882H19.3277C19.3277 13.4976 19.2694 13.42 19.2435 13.3294C19.2177 13.2388 19.2435 13.2453 19.1982 13.2065C19.1352 13.0653 19.0617 12.929 18.9782 12.7988L18.9135 12.7212C18.8433 12.6243 18.7676 12.5314 18.6871 12.4429L18.5641 12.3329C18.4925 12.2614 18.4145 12.1964 18.3312 12.1388L18.1824 12.0418L17.9235 11.8994L17.7618 11.8282C17.6626 11.7912 17.5609 11.761 17.4577 11.7376C17.4089 11.7218 17.3592 11.7088 17.3088 11.6988C16.989 11.6299 16.6581 11.6299 16.3382 11.6988C16.2879 11.7088 16.2382 11.7218 16.1894 11.7376C16.0861 11.761 15.9845 11.7912 15.8853 11.8282L15.7235 11.8994L15.4647 12.0418L15.3159 12.1388C15.2326 12.1964 15.1546 12.2614 15.0829 12.3329C15.0441 12.3718 14.9988 12.4041 14.9665 12.4429C14.882 12.5297 14.8041 12.6227 14.7335 12.7212L14.6688 12.7988C14.5854 12.929 14.5118 13.0653 14.4488 13.2065C14.4488 13.2453 14.4488 13.2906 14.4035 13.3294C14.3582 13.3682 14.3388 13.4976 14.3194 13.5882H7.6806C7.65723 13.4997 7.62694 13.4132 7.59001 13.3294L7.55118 13.2065C7.48817 13.0653 7.41462 12.929 7.33118 12.7988L7.26648 12.7212C7.19592 12.6227 7.11806 12.5297 7.03354 12.4429C7.00118 12.4041 6.95589 12.3718 6.91707 12.3329C6.84542 12.2614 6.76746 12.1964 6.68413 12.1388L6.53530 12.0418L6.27648 11.8994L6.11471 11.8282C6.01549 11.7912 5.91389 11.761 5.8106 11.7376C5.7618 11.7218 5.71211 11.7088 5.66177 11.6988C5.34192 11.6299 5.01104 11.6299 4.69118 11.6988C4.64085 11.7088 4.59116 11.7218 4.54236 11.7376C4.43907 11.761 4.33746 11.7912 4.23824 11.8282L4.07648 11.8994L3.81765 12.0418L3.66883 12.1388C3.5855 12.1964 3.50754 12.2614 3.43589 12.3329C3.39707 12.3718 3.35177 12.4041 3.31942 12.4429C3.2349 12.5297 3.15703 12.6227 3.08648 12.7212L3.02177 12.7988C2.93833 12.929 2.86479 13.0653 2.80177 13.2065L2.76295 13.3294C2.72602 13.4132 2.69573 13.4997 2.67236 13.5882H1.94118C1.76957 13.5882 1.60499 13.5201 1.48364 13.3987C1.3623 13.2774 1.29413 13.1128 1.29413 12.9412V1.94118C1.29413 1.76957 1.3623 1.60498 1.48364 1.48364C1.60499 1.36229 1.76957 1.29412 1.94118 1.29412H20.0588C20.2304 1.29412 20.395 1.36229 20.5164 1.48364C20.6377 1.60498 20.7059 1.76957 20.7059 1.94118V12.9412Z"
                  fill="black"
                />
                <path
                  class="bus-color"
                  d="M20.7059 12.9412C20.7059 13.1128 20.6377 13.2774 20.5164 13.3987C20.395 13.5201 20.2304 13.5882 20.0588 13.5882H19.3277C19.3277 13.4976 19.2694 13.42 19.2435 13.3294C19.2177 13.2388 19.2435 13.2453 19.1982 13.2065C19.1352 13.0653 19.0617 12.929 18.9782 12.7988L18.9135 12.7212C18.8433 12.6243 18.7676 12.5314 18.6871 12.4429L18.5641 12.3329C18.4925 12.2614 18.4145 12.1964 18.3312 12.1388L18.1824 12.0418L17.9235 11.8994L17.7618 11.8282C17.6626 11.7912 17.5609 11.761 17.4577 11.7376C17.4089 11.7218 17.3592 11.7088 17.3088 11.6988C16.989 11.6299 16.6581 11.6299 16.3382 11.6988C16.2879 11.7088 16.2382 11.7218 16.1894 11.7376C16.0861 11.761 15.9845 11.7912 15.8853 11.8282L15.7235 11.8994L15.4647 12.0418L15.3159 12.1388C15.2326 12.1964 15.1546 12.2614 15.0829 12.3329C15.0441 12.3718 14.9988 12.4041 14.9665 12.4429C14.882 12.5297 14.8041 12.6227 14.7335 12.7212L14.6688 12.7988C14.5854 12.929 14.5118 13.0653 14.4488 13.2065C14.4488 13.2453 14.4488 13.2906 14.4035 13.3294C14.3582 13.3682 14.3388 13.4976 14.3194 13.5882H7.6806C7.65723 13.4997 7.62694 13.4132 7.59001 13.3294L7.55118 13.2065C7.48817 13.0653 7.41462 12.929 7.33118 12.7988L7.26648 12.7212C7.19592 12.6227 7.11806 12.5297 7.03354 12.4429C7.00118 12.4041 6.95589 12.3718 6.91707 12.3329C6.84542 12.2614 6.76746 12.1964 6.68413 12.1388L6.53530 12.0418L6.27648 11.8994L6.11471 11.8282C6.01549 11.7912 5.91389 11.761 5.8106 11.7376C5.7618 11.7218 5.71211 11.7088 5.66177 11.6988C5.34192 11.6299 5.01104 11.6299 4.69118 11.6988C4.64085 11.7088 4.59116 11.7218 4.54236 11.7376C4.43907 11.761 4.33746 11.7912 4.23824 11.8282L4.07648 11.8994L3.81765 12.0418L3.66883 12.1388C3.5855 12.1964 3.50754 12.2614 3.43589 12.3329C3.39707 12.3718 3.35177 12.4041 3.31942 12.4429C3.2349 12.5297 3.15703 12.6227 3.08648 12.7212L3.02177 12.7988C2.93833 12.929 2.86479 13.0653 2.80177 13.2065L2.76295 13.3294C2.72602 13.4132 2.69573 13.4997 2.67236 13.5882H1.94118C1.76957 13.5882 1.60499 13.5201 1.48364 13.3987C1.3623 13.2774 1.29413 13.1128 1.29413 12.9412V1.94118C1.29413 1.76957 1.3623 1.60498 1.48364 1.48364C1.60499 1.36229 1.76957 1.29412 1.94118 1.29412H20.0588C20.2304 1.29412 20.395 1.36229 20.5164 1.48364C20.6377 1.60498 20.7059 1.76957 20.7059 1.94118V12.9412Z"
                  fill="#1AB24D"
                />
                <path
                  d="M5.17648 15.5294C4.92053 15.5294 4.67032 15.4535 4.45751 15.3113C4.24469 15.1691 4.07882 14.967 3.98087 14.7305C3.88292 14.4941 3.85729 14.2339 3.90723 13.9828C3.95716 13.7318 4.08041 13.5012 4.2614 13.3202C4.44238 13.1392 4.67297 13.016 4.92401 12.966C5.17504 12.9161 5.43525 12.9417 5.67172 13.0397C5.90818 13.1376 6.1103 13.3035 6.2525 13.5163C6.3947 13.7291 6.4706 13.9793 6.4706 14.2353C6.4706 14.5785 6.33425 14.9077 6.09156 15.1504C5.84886 15.3931 5.5197 15.5294 5.17648 15.5294Z"
                  fill="white"
                />
                <path
                  d="M16.8235 15.5294C16.5676 15.5294 16.3174 15.4535 16.1046 15.3113C15.8917 15.1691 15.7259 14.967 15.6279 14.7305C15.53 14.4941 15.5044 14.2339 15.5543 13.9828C15.6042 13.7318 15.7275 13.5012 15.9085 13.3202C16.0894 13.1392 16.32 13.016 16.5711 12.966C16.8221 12.9161 17.0823 12.9417 17.3188 13.0397C17.5552 13.1376 17.7574 13.3035 17.8996 13.5163C18.0418 13.7291 18.1177 13.9793 18.1177 14.2353C18.1177 14.5785 17.9813 14.9077 17.7386 15.1504C17.4959 15.3931 17.1668 15.5294 16.8235 15.5294Z"
                  fill="white"
                />
                <path
                  d="M19.4118 7.11768H2.58826C2.41665 7.11768 2.25207 7.18585 2.13072 7.30719C2.00937 7.42854 1.9412 7.59312 1.9412 7.76473V10.353C1.9412 10.5246 2.00937 10.6892 2.13072 10.8105C2.25207 10.9319 2.41665 11 2.58826 11H19.4118C19.5834 11 19.748 10.9319 19.8693 10.8105C19.9907 10.6892 20.0588 10.5246 20.0588 10.353V7.76473C20.0588 7.59312 19.9907 7.42854 19.8693 7.30719C19.748 7.18585 19.5834 7.11768 19.4118 7.11768ZM9.05885 8.41179H10.353V9.70591H9.05885V8.41179ZM7.76473 9.70591H6.47061V8.41179H7.76473V9.70591ZM11.6471 8.41179H12.9412V9.70591H11.6471V8.41179ZM14.2353 8.41179H15.5294V9.70591H14.2353V8.41179ZM3.23532 8.41179H5.17649V9.70591H3.23532V8.41179ZM18.7647 9.70591H16.8236V8.41179H18.7647V9.70591Z"
                  fill="black"
                />
                <path
                  d="M3.23532 8.41179H5.17649V9.70591H3.23532V8.41179Z"
                  fill="white"
                />
                <path
                  d="M7.76473 9.70591H6.47061V8.41179H7.76473V9.70591Z"
                  fill="white"
                />
                <path
                  d="M9.05885 8.41179H10.353V9.70591H9.05885V8.41179Z"
                  fill="white"
                />
                <path
                  d="M11.6471 8.41179H12.9412V9.70591H11.6471V8.41179Z"
                  fill="white"
                />
                <path
                  d="M14.2353 8.41179H15.5294V9.70591H14.2353V8.41179Z"
                  fill="white"
                />
                <path
                  d="M18.7647 9.70591H16.8236V8.41179H18.7647V9.70591Z"
                  fill="white"
                />
                <path
                  d="M19.4118 1.94116H2.58826C2.41665 1.94116 2.25207 2.00933 2.13072 2.13068C2.00937 2.25203 1.9412 2.41661 1.9412 2.58822V5.17646C1.9412 5.34807 2.00937 5.51265 2.13072 5.634C2.25207 5.75534 2.41665 5.82352 2.58826 5.82352H19.4118C19.5834 5.82352 19.748 5.75534 19.8693 5.634C19.9907 5.51265 20.0588 5.34807 20.0588 5.17646V2.58822C20.0588 2.41661 19.9907 2.25203 19.8693 2.13068C19.748 2.00933 19.5834 1.94116 19.4118 1.94116ZM9.05885 3.23528H10.353V4.5294H9.05885V3.23528ZM7.76473 4.5294H6.47061V3.23528H7.76473V4.5294ZM11.6471 3.23528H12.9412V4.5294H11.6471V3.23528ZM14.2353 3.23528H15.5294V4.5294H14.2353V3.23528ZM3.23532 3.23528H5.17649V4.5294H3.23532V3.23528ZM18.7647 4.5294H16.8236V3.23528H18.7647V4.5294Z"
                  fill="black"
                />
                <path
                  d="M3.23532 3.23528H5.17649V4.5294H3.23532V3.23528Z"
                  fill="white"
                />
                <path
                  d="M7.76473 4.5294H6.47061V3.23528H7.76473V4.5294Z"
                  fill="white"
                />
                <path
                  d="M9.05885 3.23528H10.353V4.5294H9.05885V3.23528Z"
                  fill="white"
                />
                <path
                  d="M11.6471 3.23528H12.9412V4.5294H11.6471V3.23528Z"
                  fill="white"
                />
                <path
                  d="M14.2353 3.23528H15.5294V4.5294H14.2353V3.23528Z"
                  fill="white"
                />
                <path
                  d="M18.7647 4.5294H16.8236V3.23528H18.7647V4.5294Z"
                  fill="white"
                />
              </svg>
        `;
    }
    // Bendy bus (BD) or default - use single deck
    else {
        return `<svg width="22" height="15" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.75 13.125C2.75 13.6082 2.35825 14 1.875 14C1.39175 14 1 13.6082 1 13.125V12.25H0.875C0.391751 12.25 0 11.8582 0 11.375V10.5C0 10.0168 0.391751 9.625 0.875 9.625H1V4.375C1 3.40563 1.78563 2.625 2.75 2.625H19.25C20.2194 2.625 21 3.40563 21 4.375V9.625H21.125C21.6082 9.625 22 10.0168 22 10.5V11.375C22 11.8582 21.6082 12.25 21.125 12.25H21V13.125C21 13.6082 20.6082 14 20.125 14C19.6418 14 19.25 13.6082 19.25 13.125V12.25H2.75V13.125Z" fill="black"/>
            <rect x="2.5" y="3.5" width="17" height="7" rx="1" class="bus-color" fill="#1AB24D"/>
            <rect x="4" y="5" width="2" height="2" fill="white"/>
            <rect x="7" y="5" width="2" height="2" fill="white"/>
            <rect x="10" y="5" width="2" height="2" fill="white"/>
            <path d="M14 6.5C14 6.22386 14.2239 6 14.5 6H17.5C17.7761 6 18 6.22386 18 6.5C18 6.77614 17.7761 7 17.5 7H14.5C14.2239 7 14 6.77614 14 6.5Z" fill="black"/>
            <circle cx="5" cy="11" r="1" fill="white"/>
            <circle cx="17" cy="11" r="1" fill="white"/>
        </svg>`;
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