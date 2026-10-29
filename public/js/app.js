import { fetchAppConfig } from './config.js';
import { DEFAULT_CENTER, DEFAULT_ZOOM, getInitialLocation } from './utils/geo.js';
import { MarkerManager } from './components/markers.js';
import { BottomSheet } from './components/bottomSheet.js';
import { BusStopSearchControl, SearchModal } from './components/search.js';

class App {
    constructor() {
        this.map = null;
        this.geolocateControl = null;
        this.markerManager = null;
        this.bottomSheet = null;
        this.searchModal = null;
        this.allBusStops = [];
    }

    async init() {
        const config = await fetchAppConfig();
        const { coords, autoLocate } = await getInitialLocation();
        this.initMap(config.mapboxToken, coords, autoLocate);
    }

    initMap(accessToken, startCenter, autoLocate) {
        if (!accessToken) {
            console.warn('Mapbox access token is missing. Configure MAPBOX_ACCESS_TOKEN in .env');
        }

        window.mapboxgl.accessToken = accessToken;

        this.map = new window.mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: startCenter || DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            attributionControl: false
        });

        // Compact attribution control
        this.map.addControl(new window.mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

        // Geolocate control
        this.geolocateControl = new window.mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true,
            showUserLocation: true,
            showAccuracyCircle: true,
            fitBoundsOptions: { maxZoom: DEFAULT_ZOOM }
        });
        this.map.addControl(this.geolocateControl, 'top-right');

        // Initialise Bottom Sheet
        this.bottomSheet = new BottomSheet(this.map, () => {
            if (this.markerManager) {
                this.markerManager.resetActiveMarker();
            }
        });

        // Initialise Marker Manager
        this.markerManager = new MarkerManager(this.map);
        this.markerManager.setOnStopSelect((stop) => {
            this.bottomSheet.show(stop);
        });

        // Initialise Search UI
        this.searchModal = new SearchModal((selectedStop) => {
            this.handleStopSelection(selectedStop);
        });

        const searchControl = new BusStopSearchControl(() => {
            this.searchModal.open();
        });
        this.map.addControl(searchControl, 'top-right');

        // Fallback on geolocation error
        this.geolocateControl.on('error', (err) => {
            console.warn('Geolocation error or permission denied:', err);
            this.map.flyTo({
                center: DEFAULT_CENTER,
                zoom: DEFAULT_ZOOM,
                essential: true
            });
        });

        // Map load lifecycle
        this.map.on('load', async () => {
            await this.loadBusStops();

            if (autoLocate) {
                this.geolocateControl.trigger();
            }

            // Listen for runtime permission changes
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'geolocation' }).then((status) => {
                    status.onchange = () => {
                        if (status.state === 'granted') {
                            this.geolocateControl.trigger();
                        } else if (status.state === 'denied') {
                            this.map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, essential: true });
                        }
                    };
                }).catch(() => {});
            }
        });

        // Update markers on viewport movements
        this.map.on('moveend', () => {
            if (this.allBusStops.length) this.markerManager.displayNearbyStops(this.allBusStops);
        });

        this.map.on('idle', () => {
            if (this.allBusStops.length) this.markerManager.displayNearbyStops(this.allBusStops);
        });

        // Close bottom sheet when clicking anywhere on the map except markers/sheet
        this.map.on('click', (e) => {
            if (this.bottomSheet.isOpening) return;
            if (this.bottomSheet.isActive()) {
                if (!e.originalEvent.target.closest('.bus-stop-marker-wrapper') &&
                    !e.originalEvent.target.closest('.bottom-sheet-content')) {
                    this.bottomSheet.hide();
                }
            }
        });
    }

    async loadBusStops() {
        try {
            // Check both standard data path and legacy path
            let response = await fetch('data/bus_stops_singapore.json');
            if (!response.ok) {
                response = await fetch('saved-data/bus_stops_singapore.json');
            }

            const data = await response.json();
            if (!data || !data.value) {
                console.error('Invalid bus stop JSON format');
                return;
            }

            this.allBusStops = data.value;
            window._allBusStops = data.value; // For debugging convenience
            console.log(`Loaded ${this.allBusStops.length} bus stops`);

            this.searchModal.setBusStops(this.allBusStops);
            this.markerManager.displayNearbyStops(this.allBusStops);
        } catch (error) {
            console.error('Failed to load bus stops:', error);
        }
    }

    handleStopSelection(stop) {
        const targetZoom = Math.max(this.map.getZoom(), 16);
        const isMobile = window.innerWidth < 768;
        const padding = isMobile
            ? { top: 0, bottom: this.bottomSheet.container?.offsetHeight || Math.round(window.innerHeight * 0.6), left: 0, right: 0 }
            : { top: 0, bottom: 0, left: this.bottomSheet.container?.offsetWidth || 375, right: 0 };

        this.map.flyTo({
            center: [stop.Longitude, stop.Latitude],
            zoom: targetZoom,
            padding: padding,
            duration: 600,
            essential: true
        });

        this.markerManager.setActiveStopDirectly(stop, 50);
        this.bottomSheet.show(stop);
    }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
