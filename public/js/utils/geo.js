export const DEFAULT_CENTER = [103.8198, 1.3521]; // Singapore [lng, lat]
export const DEFAULT_ZOOM = 15;

/**
 * Determine initial user coordinates or fallback to Singapore center
 */
export async function getInitialLocation() {
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

/**
 * Haversine formula to calculate geodesic distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let isOrientationActive = false;

// Passive listener to detect if orientation events are already streaming with valid data
if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
    window.addEventListener('deviceorientation', (event) => {
        if (event.webkitCompassHeading != null || event.alpha != null) {
            isOrientationActive = true;
        }
    }, { passive: true });
}

/**
 * Check if compass / device orientation permission has already been given
 */
export function isOrientationPermissionGiven() {
    // 1. Actively streaming heading values
    if (isOrientationActive) return true;

    // 2. Previously recorded as granted in localStorage
    if (localStorage.getItem('compass_permission_granted') === 'true') {
        return true;
    }

    // 3. Mapbox user location heading cone is active in the DOM
    const headingEl = document.querySelector('.mapboxgl-user-location-heading');
    if (headingEl && headingEl.style.transform && headingEl.style.transform !== 'none') {
        return true;
    }

    return false;
}

/**
 * Request device orientation permission (iOS 13+) and reload ONLY on grant
 * to initialize heading flashlight beam without requiring another button tap.
 * If permission is already given, the click is ignored.
 */
export function requestOrientationAndReload() {
    // If permission is already given, ignore
    if (isOrientationPermissionGiven()) {
        console.log('Compass/Orientation permission already given. Ignoring click.');
        return;
    }

    // If permission is NOT given, ask permission
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then((permission) => {
                console.log('Orientation permission result:', permission);
                // ONLY by then refresh the page
                if (permission === 'granted') {
                    localStorage.setItem('compass_permission_granted', 'true');
                    sessionStorage.setItem('auto_geolocate', 'true');
                    window.location.reload();
                } else {
                    alert("Compass permission was denied. The direction arrow won't work without it.");
                }
            })
            .catch((error) => {
                console.error('Error requesting orientation permission:', error);
                alert('Error requesting compass permission: ' + error.message);
            });
    } else {
        // Fallback for non-iOS devices or desktop testing
        const allowed = confirm('Allow BusSin to access compass direction and calibrate heading?');
        if (allowed) {
            localStorage.setItem('compass_permission_granted', 'true');
            sessionStorage.setItem('auto_geolocate', 'true');
            window.location.reload();
        }
    }
}

