// ─── Global constants & state ────────────────────────────────────────────────
const DEFAULT_CENTER = [103.8198, 1.3521];   // Singapore [lng, lat]
const DEFAULT_ZOOM = 15;

let map;
let geolocateControl;
let bottomSheet;
let currentBusStopCode = null;
let refreshInterval = null;
let countdownInterval = null;
let lastUpdateTime = null;
let cachedBusData = null;
let isOpening = false;
let activeMarkerEl = null;       // DOM element of the active bus stop marker
let activeBusStopCode = null;

// Determine initial center and request permission on startup if not yet determined
async function getInitialLocation() {
    if (!navigator.geolocation) {
        return { coords: DEFAULT_CENTER, autoLocate: false };
    }

    // Fast path: if permission is already explicitly denied, do not prompt or wait
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            if (status.state === 'denied') {
                return { coords: DEFAULT_CENTER, autoLocate: false };
            }
        } catch (e) {
            // Continue to getCurrentPosition if permissions API fails
        }
    }

    // Request location from browser (prompts if state is 'prompt', or returns immediately if 'granted')
    return new Promise((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve({ coords: DEFAULT_CENTER, autoLocate: false });
            }
        }, 8000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    resolve({
                        coords: [pos.coords.longitude, pos.coords.latitude],
                        autoLocate: true
                    });
                }
            },
            (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    console.warn('Geolocation denied or failed on startup:', err);
                    resolve({ coords: DEFAULT_CENTER, autoLocate: false });
                }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    });
}

// ─── Map initialisation ──────────────────────────────────────────────────────
function initMap(accessToken, startCenter = DEFAULT_CENTER, autoLocate = false) {
    mapboxgl.accessToken = accessToken;

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: startCenter,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,    // we'll add a compact one
    });

    // Compact attribution
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    // Built-in Mapbox GeolocateControl (blue dot, accuracy circle, direction heading, follow tracking)
    geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true,
        showUserLocation: true,
        showAccuracyCircle: true,
        fitBoundsOptions: {
            maxZoom: DEFAULT_ZOOM
        }
    });
    map.addControl(geolocateControl, 'top-right');

    // If location permission is denied or fails, fallback to the default location
    geolocateControl.on('error', (err) => {
        console.warn('Geolocation error or permission denied:', err);
        map.flyTo({
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            essential: true
        });
    });

    map.on('load', () => {
        // Load bus stops around current start center
        loadBusStopsFromJSON();

        // If permission was already granted, activate tracking (no transition jump)
        if (autoLocate) {
            geolocateControl.trigger();
        }

        // Listen for runtime permission changes
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then((status) => {
                status.onchange = () => {
                    if (status.state === 'granted') {
                        geolocateControl.trigger();
                    } else if (status.state === 'denied') {
                        map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, essential: true });
                    }
                };
            }).catch(() => {});
        }
    });

    // Update bus stop markers whenever the map moves or goes idle
    map.on('moveend', () => {
        if (window._allBusStops) displayNearbyBusStops(window._allBusStops);
    });
    map.on('idle', () => {
        if (window._allBusStops) displayNearbyBusStops(window._allBusStops);
    });

    // Close bottom sheet on map click (but not on marker clicks)
    map.on('click', (e) => {
        if (isOpening) return;
        if (bottomSheet && bottomSheet.classList.contains('active')) {
            if (!e.originalEvent.target.closest('.bus-stop-marker-wrapper') &&
                !e.originalEvent.target.closest('.bottom-sheet-content')) {
                hideBottomSheet();
            }
        }
    });

    initBottomSheet();
}

// ─── Bus stop markers ─────────────────────────────────────────────────────────
// Map of BusStopCode → { marker: mapboxgl.Marker, el: HTMLElement, stopData, markerSize }
const busStopMarkers = new Map();

async function loadBusStopsFromJSON() {
    try {
        const response = await fetch('saved-data/bus_stops_singapore.json');
        const data = await response.json();
        if (!data || !data.value) { console.error('Invalid JSON format'); return; }
        window._allBusStops = data.value;
        console.log(`Total bus stops loaded: ${data.value.length}`);
        displayNearbyBusStops(data.value);
    } catch (error) {
        console.error('Error loading bus stops:', error);
    }
}

function displayNearbyBusStops(allBusStops) {
    const zoom = map.getZoom();
    const center = map.getCenter();

    if (zoom < 14) {
        busStopMarkers.forEach(({ marker, iconEl }) => fadeOutAndRemoveMarker(marker, iconEl));
        busStopMarkers.clear();
        return;
    }

    let radiusKm, iconSize;
    if (zoom >= 16) { radiusKm = 1; iconSize = 50; }
    else            { radiusKm = 2; iconSize = 30; }

    const nearbyStops = allBusStops.filter(stop =>
        calculateDistance(center.lat, center.lng, stop.Latitude, stop.Longitude) <= radiusKm * 1000
    );

    const visibleCodes = new Set(nearbyStops.map(s => s.BusStopCode));

    // Remove out-of-range markers
    busStopMarkers.forEach((entry, code) => {
        if (!visibleCodes.has(code)) {
            fadeOutAndRemoveMarker(entry.marker, entry.iconEl);
            busStopMarkers.delete(code);
        }
    });

    // Add / update markers
    nearbyStops.forEach(stop => {
        const existing = busStopMarkers.get(stop.BusStopCode);
        if (existing) {
            if (existing.markerSize !== iconSize) {
                const isActive = activeBusStopCode === stop.BusStopCode;
                updateMarkerIcon(existing.iconEl, stop, iconSize, isActive);
                existing.markerSize = iconSize;
            }
        } else {
            const isActive = activeBusStopCode === stop.BusStopCode;
            createBusStopMarker(stop, iconSize, isActive);
        }
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

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

function getActiveBusStopSVG(stop, width) {
    const biggerWidth = width + 20;
    const height = Math.round(biggerWidth * 279 / 220);
    return `
<svg width="${biggerWidth}" height="${height}" viewBox="0 0 220 279" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M110.002 0.550781C170.452 0.550996 219.452 49.3136 219.449 109.456C219.449 136.307 209.64 160.849 193.448 179.836L110.001 277.634L26.5518 179.839H26.5508C10.3598 160.849 0.550781 136.31 0.550781 109.459C0.550827 49.3133 49.5515 0.550781 110.002 0.550781Z" fill="#007F95" stroke="#007F95" stroke-width="1.10116"/>
<ellipse cx="109.555" cy="105.711" rx="90.7423" ry="90.2948" fill="white"/>
<path d="M163.829 54.5073C161.627 44.707 152.608 38.5405 142.516 38.5405H75.7979C65.7056 38.5405 56.6867 44.707 54.4845 54.5073C48.9625 79.1512 44.8127 118.121 45.4324 143.723C45.6206 151.277 52.0279 156.871 59.6192 156.871H59.7631V167.409C59.7631 170.624 62.5075 173.212 65.7388 173.212H70.6411C74.0163 173.212 76.639 170.624 76.639 167.409V156.871H141.675V167.409C141.675 170.624 144.419 173.212 147.65 173.212H152.553C155.928 173.212 158.551 170.624 158.551 167.409V156.871H158.694C166.297 156.871 172.704 151.277 172.881 143.723C173.501 118.11 169.351 79.1512 163.829 54.5073ZM87.5834 47.3498C87.5834 45.5219 89.0662 44.0463 90.9032 44.0463H127.421C129.247 44.0463 130.741 45.5219 130.741 47.3498V51.7544C130.741 53.5713 129.247 55.0579 127.421 55.0579H90.9032C89.0662 55.0579 87.5834 53.5713 87.5834 51.7544V47.3498ZM59.9844 100.293L65.097 67.2587C65.595 64.0433 68.3836 61.6648 71.6592 61.6648H146.654C149.941 61.6648 152.719 64.0433 153.217 67.2587L158.329 100.293C158.949 104.302 155.839 107.913 151.767 107.913H66.5466C62.4743 107.913 59.3647 104.302 59.9844 100.293ZM85.5472 133.053C85.5472 136.411 82.9467 139.021 79.5715 139.021H65.5949C62.3636 139.021 59.7631 136.411 59.7631 133.053V128.175C59.7631 124.959 62.3636 122.228 65.5949 122.228H79.5715C82.9467 122.228 85.5472 124.959 85.5472 128.175V133.053ZM158.551 133.053C158.551 136.411 155.95 139.021 152.575 139.021H138.598C135.367 139.021 132.766 136.411 132.766 133.053V128.175C132.766 124.959 135.367 122.228 138.598 122.228H152.575C155.95 122.228 158.551 124.959 158.551 128.175V133.053Z" fill="#007F95" stroke="white" stroke-width="1.00205"/>
</svg>`;
}

function fadeOutAndRemoveMarker(marker, iconEl) {
    if (iconEl && iconEl.classList) {
        iconEl.classList.remove('spring-in');
        iconEl.classList.add('fade-out');
        setTimeout(() => marker.remove(), 300);
    } else {
        marker.remove();
    }
}

function updateMarkerIcon(iconEl, stop, size, isActive) {
    const width = Math.round(size * 220 / 401);
    const svgString = isActive ? getActiveBusStopSVG(stop, width) : getNormalBusStopSVG(stop, width, size);
    iconEl.innerHTML = svgString;
    // Re-trigger spring animation
    iconEl.classList.remove('spring-in');
    void iconEl.offsetWidth; // reflow
    iconEl.classList.add('spring-in');
}

function createBusStopMarker(stop, size = 28, isActive = false) {
    const width = Math.round(size * 220 / 401);
    const svgString = isActive ? getActiveBusStopSVG(stop, width) : getNormalBusStopSVG(stop, width, size);

    // Outer wrapper: Mapbox controls its transform: translate(...) for positioning
    const wrapper = document.createElement('div');
    wrapper.className = 'bus-stop-marker-wrapper';

    // Inner element: CSS controls its scale & opacity animations
    const iconEl = document.createElement('div');
    iconEl.className = 'bus-stop-marker';
    iconEl.innerHTML = svgString;
    wrapper.appendChild(iconEl);

    wrapper.title = `${stop.Description || 'Bus Stop'}\n${stop.RoadName || ''}\nStop: ${stop.BusStopCode || ''}`;

    // Spring-in animation on inner element
    requestAnimationFrame(() => requestAnimationFrame(() => iconEl.classList.add('spring-in')));

    const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'bottom' })
        .setLngLat([stop.Longitude, stop.Latitude])
        .addTo(map);

    if (isActive) activeMarkerEl = iconEl;

    wrapper.addEventListener('click', (e) => {
        e.stopPropagation();

        // Reset previous active marker
        if (activeMarkerEl && activeMarkerEl !== iconEl) {
            const prevEntry = [...busStopMarkers.values()].find(v => v.iconEl === activeMarkerEl);
            if (prevEntry) updateMarkerIcon(prevEntry.iconEl, prevEntry.stopData, prevEntry.markerSize, false);
        }

        activeMarkerEl = iconEl;
        activeBusStopCode = stop.BusStopCode;
        const entry = busStopMarkers.get(stop.BusStopCode);
        if (entry) updateMarkerIcon(iconEl, stop, entry.markerSize, true);

        showBottomSheet(stop);
    });

    busStopMarkers.set(stop.BusStopCode, { marker, wrapper, iconEl, stopData: stop, markerSize: size });
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────
function initBottomSheet() {
    bottomSheet = document.getElementById('bottomSheet');
    const header = document.querySelector('.bottom-sheet-header');
    const refreshIcon = document.querySelector('.refresh-icon');

    if (refreshIcon) {
        refreshIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentBusStopCode) {
                refreshIcon.classList.add('rotating');
                fetchBusArrivalData(currentBusStopCode);
                setTimeout(() => refreshIcon.classList.remove('rotating'), 600);
            }
        });
    }

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (isOpening) return;
        if (bottomSheet.classList.contains('active')) {
            const content = document.querySelector('.bottom-sheet-content');
            if (content && !content.contains(e.target)) {
                hideBottomSheet();
            }
        }
    });

    // Drag-to-close via bottom-sheet-header
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    if (header) {
        const onDragStart = (clientY, target) => {
            // Don't drag if clicking refresh icon or during desktop panel view
            if (target && target.closest('.refresh-icon')) return false;
            if (window.innerWidth >= 768) return false;

            startY = clientY;
            currentY = clientY;
            isDragging = true;
            bottomSheet.style.transition = 'none';
            header.style.cursor = 'grabbing';
            return true;
        };

        const onDragMove = (clientY) => {
            if (!isDragging) return;
            currentY = clientY;
            const diff = currentY - startY;
            if (diff > 0) {
                bottomSheet.style.transform = `translateY(${diff}px)`;
            } else {
                bottomSheet.style.transform = 'translateY(0)';
            }
        };

        const onDragEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            header.style.cursor = 'grab';

            const diff = currentY - startY;
            const rect = bottomSheet.getBoundingClientRect();

            // Threshold: dragged down > 25% of viewport height OR bottom sheet top reached bottom 25-30% of screen
            const threshold = window.innerHeight * 0.25;
            const reachedBottom = rect.top > (window.innerHeight * 0.75);

            if (diff > threshold || reachedBottom) {
                // Animate smoothly to bottom and close
                bottomSheet.style.transition = 'transform 0.25s ease-out';
                bottomSheet.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    hideBottomSheet();
                }, 250);
            } else {
                // Snap back to open position
                bottomSheet.style.transition = 'transform 0.25s ease-out';
                bottomSheet.style.transform = 'translateY(0)';
            }

            startY = 0;
            currentY = 0;
        };

        // Touch event listeners
        header.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                onDragStart(e.touches[0].clientY, e.target);
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                onDragMove(e.touches[0].clientY);
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            if (isDragging) onDragEnd();
        });

        window.addEventListener('touchcancel', () => {
            if (isDragging) onDragEnd();
        });

        // Mouse event listeners
        header.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                onDragStart(e.clientY, e.target);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                onDragMove(e.clientY);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                onDragEnd();
            }
        });
    }
}

async function showBottomSheet(stop) {
    const title = document.getElementById('busStopTitle');
    isOpening = true;
    title.innerHTML = `${stop.BusStopCode} - ${stop.Description}<br><span class="road-name">${stop.RoadName}</span>`;
    currentBusStopCode = stop.BusStopCode;
    bottomSheet.classList.add('active');
    setTimeout(() => { isOpening = false; }, 300);

    // Center the map view on the clicked bus stop in the remaining visible area (above bottom sheet)
    if (map) {
        const isMobile = window.innerWidth < 768;
        const padding = isMobile
            ? { top: 0, bottom: bottomSheet.offsetHeight || Math.round(window.innerHeight * 0.6), left: 0, right: 0 }
            : { top: 0, bottom: 0, left: bottomSheet.offsetWidth || 375, right: 0 };

        map.easeTo({
            center: [stop.Longitude, stop.Latitude],
            padding: padding,
            duration: 400
        });
    }

    await fetchBusArrivalData(stop.BusStopCode);

    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(updateBusCountdowns, 1000);
    refreshInterval = setInterval(() => {
        if (currentBusStopCode && bottomSheet.classList.contains('active')) {
            fetchBusArrivalData(currentBusStopCode);
        }
    }, 30000);
}

async function fetchBusArrivalData(busStopCode) {
    const servicesContainer = document.getElementById('servicesContainer');
    const lastUpdateElement = document.getElementById('lastUpdate');

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

        cachedBusData = data.Services;
        lastUpdateTime = new Date();

        if (lastUpdateElement) {
            const now = new Date();
            const h = now.getHours(), m = now.getMinutes();
            const ampm = h >= 12 ? 'pm' : 'am';
            lastUpdateElement.textContent = `${h % 12 || 12}:${m.toString().padStart(2, '0')}${ampm}`;
        }

        displayServicesInNewFormat(data.Services, servicesContainer);
    } catch (error) {
        console.error('Error fetching bus arrival data:', error);
        if (cachedBusData && lastUpdateTime) {
            displayServicesInNewFormat(cachedBusData, servicesContainer);
        } else {
            servicesContainer.innerHTML = '<div style="color: #e53935; padding: 24px;">Failed to load bus services</div>';
        }
    }
}

function displayServicesInNewFormat(services, container) {
    container.innerHTML = '';

    const sortedServices = services.sort((a, b) => parseInt(a.ServiceNo) - parseInt(b.ServiceNo));

    sortedServices.forEach(service => {
        const serviceRow = document.createElement('div');
        serviceRow.className = 'service-row';

        const serviceNumber = document.createElement('div');
        serviceNumber.className = 'service-number';
        serviceNumber.innerHTML = `
            <span class="number">${service.ServiceNo}</span>
            <span class="operator">${service.Operator}</span>
        `;

        const arrivalCards = document.createElement('div');
        arrivalCards.className = 'arrival-cards';

        const buses = [service.NextBus, service.NextBus2, service.NextBus3]
            .filter(bus => bus && bus.EstimatedArrival);

        buses.forEach(bus => arrivalCards.appendChild(createArrivalCard(bus)));

        serviceRow.appendChild(serviceNumber);
        serviceRow.appendChild(arrivalCards);
        container.appendChild(serviceRow);
    });
}

function createArrivalCard(bus) {
    const card = document.createElement('div');
    card.className = 'arrival-card';
    card.dataset.estimatedArrival = bus.EstimatedArrival;

    const load = bus.Load;
    const busType = bus.Type;

    let statusClass = 'status-ok';
    let statusText = '';
    if (load === 'SDA') { statusClass = 'status-standing'; statusText = 'standing'; }
    else if (load === 'LSD') { statusClass = 'status-crowded';  statusText = 'crowded'; }

    const timeGroup = document.createElement('div');
    timeGroup.className = 'arrival-time-group';

    const arrivalText = document.createElement('span');
    arrivalText.className = 'arrival-text';
    arrivalText.textContent = calculateArrivalTime(bus.EstimatedArrival);
    timeGroup.appendChild(arrivalText);

    if (statusText) {
        const statusTag = document.createElement('span');
        statusTag.className = `status-tag status-${load === 'SDA' ? 'standing' : 'crowded'}`;
        statusTag.textContent = statusText;
        timeGroup.appendChild(statusTag);
    }

    const busIcon = document.createElement('div');
    busIcon.className = `bus-icon-placeholder ${statusClass}`;
    busIcon.innerHTML = getBusIconSVG(busType);
    busIcon.style.transform = 'scaleX(-1)';

    card.appendChild(timeGroup);
    card.appendChild(busIcon);
    return card;
}

function getBusIconSVG(busType) {
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
</svg>`;
    } else if (busType === 'DD') {
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
</svg>`;
    } else if (busType === 'BD') {
        return `
<svg width="38" height="20" viewBox="0 0 38 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="12" y="1" width="6" height="15" fill="#CFCECE"/>
<path d="M2 0.25H10C11.5188 0.25 12.75 1.48122 12.75 3V14C12.75 15.5188 11.5188 16.75 10 16.75H3C1.48122 16.75 0.25 15.5188 0.25 14V2C0.25 1.0335 1.0335 0.25 2 0.25Z" fill="currentColor" stroke="black" stroke-width="0.5"/>
<path d="M19 0.25H35C36.5188 0.25 37.75 1.48122 37.75 3V14C37.75 15.5188 36.5188 16.75 35 16.75H20C18.4812 16.75 17.25 15.5188 17.25 14V2C17.25 1.0335 18.0335 0.25 19 0.25Z" fill="currentColor" stroke="black" stroke-width="0.5"/>
<circle cx="6.5" cy="16.5" r="3.25" fill="white" stroke="black" stroke-width="0.5"/>
<circle cx="22.5" cy="16.5" r="3.25" fill="white" stroke="black" stroke-width="0.5"/>
<circle cx="31.5" cy="16.5" r="3.25" fill="white" stroke="black" stroke-width="0.5"/>
<rect x="2" y="3" width="4" height="3" fill="white"/>
<rect x="7" y="3" width="4" height="3" fill="white"/>
<rect x="32" y="3" width="4" height="3" fill="white"/>
<rect x="26" y="3" width="4" height="3" fill="white"/>
<rect x="20" y="3" width="4" height="3" fill="white"/>
<path d="M13.7928 1.25V15.75" stroke="#545454" stroke-width="0.5" stroke-linecap="round"/>
<path d="M16.1789 1.25V15.75" stroke="#545454" stroke-width="0.5" stroke-linecap="round"/>
<path d="M15 1.25V15.75" stroke="#545454" stroke-width="0.5" stroke-linecap="round"/>
</svg>`;
    } else {
        // Default: single deck
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
</svg>`;
    }
}

function updateBusCountdowns() {
    document.querySelectorAll('.arrival-card').forEach(el => {
        const est = el.dataset.estimatedArrival;
        if (est) {
            const timeEl = el.querySelector('.arrival-text');
            if (timeEl) timeEl.textContent = calculateArrivalTime(est);
        }
    });
}

function calculateArrivalTime(estimatedArrival) {
    const diffMins = Math.floor((new Date(estimatedArrival) - new Date()) / 60000);
    if (diffMins < 1) return 'Arr';
    if (diffMins === 1) return '1 min';
    return `${diffMins} min`;
}

function getLoadColor(load) {
    switch (load) {
        case 'SEA': return '#4CAF50';
        case 'SDA': return '#FF9800';
        case 'LSD': return '#F44336';
        default:    return '#4285F4';
    }
}

function getLoadText(load) {
    switch (load) {
        case 'SEA': return 'Seats Available';
        case 'SDA': return 'Standing Available';
        case 'LSD': return 'Limited Standing';
        default:    return 'Unknown';
    }
}

function hideBottomSheet() {
    bottomSheet.classList.remove('active');
    bottomSheet.style.transform = '';

    // Reset camera padding so visible viewport returns to full screen
    if (map) {
        map.easeTo({
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
            duration: 300
        });
    }

    if (activeMarkerEl) {
        const entry = [...busStopMarkers.values()].find(v => v.iconEl === activeMarkerEl);
        if (entry) updateMarkerIcon(activeMarkerEl, entry.stopData, entry.markerSize, false);
        activeMarkerEl = null;
    }
    activeBusStopCode = null;

    if (refreshInterval)  { clearInterval(refreshInterval);  refreshInterval  = null; }
    if (countdownInterval){ clearInterval(countdownInterval); countdownInterval = null; }

    currentBusStopCode = null;
    cachedBusData = null;
    lastUpdateTime = null;
}

// ─── Entry point (token injected by server) ───────────────────────────────────
async function initApp(accessToken) {
    const { coords, autoLocate } = await getInitialLocation();
    initMap(accessToken, coords, autoLocate);
}

initApp('MAPBOX_TOKEN_PLACEHOLDER');