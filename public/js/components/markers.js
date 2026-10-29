import { calculateDistance } from '../utils/geo.js';
import { getMarkerHTML } from './icons.js';

/**
 * Manages Mapbox bus stop markers on the map
 */
export class MarkerManager {
    constructor(map) {
        this.map = map;
        this.markers = new Map(); // BusStopCode -> { marker, wrapper, iconEl, stopData, markerSize }
        this.activeStopCode = null;
        this.activeMarkerEl = null;
        this.onStopSelectCallback = null;
    }

    setOnStopSelect(callback) {
        this.onStopSelectCallback = callback;
    }

    displayNearbyStops(allBusStops) {
        if (!allBusStops || !this.map) return;

        const zoom = this.map.getZoom();
        const center = this.map.getCenter();

        if (zoom < 14) {
            this.markers.forEach(({ marker, iconEl }) => this.fadeOutAndRemove(marker, iconEl));
            this.markers.clear();
            return;
        }

        let radiusKm, iconSize;
        if (zoom >= 16) {
            radiusKm = 1;
            iconSize = 50;
        } else {
            radiusKm = 2;
            iconSize = 30;
        }

        const nearbyStops = allBusStops.filter((stop) =>
            calculateDistance(center.lat, center.lng, stop.Latitude, stop.Longitude) <= radiusKm * 1000
        );

        const visibleCodes = new Set(nearbyStops.map((s) => s.BusStopCode));

        // Remove out-of-range markers
        this.markers.forEach((entry, code) => {
            if (!visibleCodes.has(code)) {
                this.fadeOutAndRemove(entry.marker, entry.iconEl);
                this.markers.delete(code);
            }
        });

        // Add or update markers
        nearbyStops.forEach((stop) => {
            const existing = this.markers.get(stop.BusStopCode);
            const isActive = this.activeStopCode === stop.BusStopCode;

            if (existing) {
                if (existing.markerSize !== iconSize) {
                    this.updateMarkerIcon(existing.iconEl, iconSize, isActive);
                    existing.markerSize = iconSize;
                }
            } else {
                this.createMarker(stop, iconSize, isActive);
            }
        });
    }

    createMarker(stop, size = 28, isActive = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'bus-stop-marker-wrapper';

        const iconEl = document.createElement('div');
        iconEl.className = 'bus-stop-marker';
        iconEl.innerHTML = getMarkerHTML(size, isActive);
        wrapper.appendChild(iconEl);

        wrapper.title = `${stop.Description || 'Bus Stop'}\n${stop.RoadName || ''}\nStop: ${stop.BusStopCode || ''}`;

        // Trigger spring animation
        requestAnimationFrame(() => requestAnimationFrame(() => iconEl.classList.add('spring-in')));

        const marker = new window.mapboxgl.Marker({ element: wrapper, anchor: 'bottom' })
            .setLngLat([stop.Longitude, stop.Latitude])
            .addTo(this.map);

        if (isActive) {
            this.activeMarkerEl = iconEl;
        }

        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectStop(stop, iconEl);
        });

        this.markers.set(stop.BusStopCode, { marker, wrapper, iconEl, stopData: stop, markerSize: size });
    }

    updateMarkerIcon(iconEl, size, isActive) {
        iconEl.innerHTML = getMarkerHTML(size, isActive);
        iconEl.classList.remove('spring-in');
        void iconEl.offsetWidth; // Force DOM reflow for re-triggering animation
        iconEl.classList.add('spring-in');
    }

    selectStop(stop, iconEl) {
        // Reset previous active marker icon if changed
        if (this.activeMarkerEl && this.activeMarkerEl !== iconEl) {
            const prevEntry = [...this.markers.values()].find((v) => v.iconEl === this.activeMarkerEl);
            if (prevEntry) {
                this.updateMarkerIcon(prevEntry.iconEl, prevEntry.markerSize, false);
            }
        }

        this.activeMarkerEl = iconEl;
        this.activeStopCode = stop.BusStopCode;

        const entry = this.markers.get(stop.BusStopCode);
        if (entry) {
            this.updateMarkerIcon(iconEl, entry.markerSize, true);
        }

        if (this.onStopSelectCallback) {
            this.onStopSelectCallback(stop);
        }
    }

    setActiveStopDirectly(stop, targetSize = 50) {
        if (this.activeMarkerEl) {
            const prevEntry = [...this.markers.values()].find((v) => v.iconEl === this.activeMarkerEl);
            if (prevEntry) {
                this.updateMarkerIcon(prevEntry.iconEl, prevEntry.markerSize, false);
            }
            this.activeMarkerEl = null;
        }

        this.activeStopCode = stop.BusStopCode;

        const entry = this.markers.get(stop.BusStopCode);
        if (entry) {
            this.updateMarkerIcon(entry.iconEl, entry.markerSize, true);
            this.activeMarkerEl = entry.iconEl;
        } else {
            this.createMarker(stop, targetSize, true);
        }
    }

    resetActiveMarker() {
        if (this.activeMarkerEl) {
            const entry = [...this.markers.values()].find((v) => v.iconEl === this.activeMarkerEl);
            if (entry) {
                this.updateMarkerIcon(this.activeMarkerEl, entry.markerSize, false);
            }
            this.activeMarkerEl = null;
        }
        this.activeStopCode = null;
    }

    fadeOutAndRemove(marker, iconEl) {
        if (iconEl && iconEl.classList) {
            iconEl.classList.remove('spring-in');
            iconEl.classList.add('fade-out');
            setTimeout(() => marker.remove(), 300);
        } else {
            marker.remove();
        }
    }
}
