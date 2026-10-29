/**
 * Client Configuration
 * Fetches dynamic environment configuration from server
 */
export async function fetchAppConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.warn('Could not load /api/config, falling back to default:', error);
        return { mapboxToken: '' };
    }
}
