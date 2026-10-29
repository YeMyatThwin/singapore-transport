/**
 * Bus Arrival Service
 * Fetches real-time arrival timings from the server proxy
 */

export async function fetchBusArrival(busStopCode, serviceNo) {
    if (!busStopCode) {
        throw new Error('busStopCode is required');
    }

    let url = `/api/bus-arrival?busStopCode=${encodeURIComponent(busStopCode)}`;
    if (serviceNo) {
        url += `&serviceNo=${encodeURIComponent(serviceNo)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch bus arrival data (Status ${response.status})`);
    }

    return await response.json();
}
