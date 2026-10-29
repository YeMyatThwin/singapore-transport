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
