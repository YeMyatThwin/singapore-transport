import { fetchBusArrival } from '../services/busArrival.js';
import { calculateArrivalTime, formatTime } from '../utils/formatters.js';
import { getBusIcon } from './icons.js';

/**
 * Bottom Sheet Component for Bus Arrivals
 */
export class BottomSheet {
    constructor(map, onDismissCallback) {
        this.map = map;
        this.onDismissCallback = onDismissCallback;
        this.container = document.getElementById('bottomSheet');
        this.titleEl = document.getElementById('busStopTitle');
        this.servicesContainer = document.getElementById('servicesContainer');
        this.lastUpdateEl = document.getElementById('lastUpdate');
        this.refreshIcon = document.querySelector('.refresh-icon');
        this.header = document.querySelector('.bottom-sheet-header');

        this.currentStopCode = null;
        this.refreshInterval = null;
        this.countdownInterval = null;
        this.cachedServices = null;
        this.isOpening = false;

        this.initGestures();
        this.initRefresh();
    }

    initRefresh() {
        if (!this.refreshIcon) return;
        this.refreshIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentStopCode) {
                this.refreshIcon.classList.add('rotating');
                this.loadArrivals(this.currentStopCode);
                setTimeout(() => this.refreshIcon.classList.remove('rotating'), 600);
            }
        });
    }

    initGestures() {
        if (!this.header || !this.container) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const onDragStart = (clientY, target) => {
            if (target && target.closest('.refresh-icon')) return false;
            if (window.innerWidth >= 768) return false;

            startY = clientY;
            currentY = clientY;
            isDragging = true;
            this.container.style.transition = 'none';
            this.header.style.cursor = 'grabbing';
            return true;
        };

        const onDragMove = (clientY) => {
            if (!isDragging) return;
            currentY = clientY;
            const diff = currentY - startY;
            if (diff > 0) {
                this.container.style.transform = `translateY(${diff}px)`;
            } else {
                this.container.style.transform = 'translateY(0)';
            }
        };

        const onDragEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            this.header.style.cursor = 'grab';

            const diff = currentY - startY;
            const rect = this.container.getBoundingClientRect();
            const threshold = window.innerHeight * 0.25;
            const reachedBottom = rect.top > window.innerHeight * 0.75;

            if (diff > threshold || reachedBottom) {
                this.container.style.transition = 'transform 0.25s ease-out';
                this.container.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    this.hide();
                }, 250);
            } else {
                this.container.style.transition = 'transform 0.25s ease-out';
                this.container.style.transform = 'translateY(0)';
            }

            startY = 0;
            currentY = 0;
        };

        // Touch event listeners
        this.header.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) onDragStart(e.touches[0].clientY, e.target);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                onDragMove(e.touches[0].clientY);
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener('touchend', () => { if (isDragging) onDragEnd(); });
        window.addEventListener('touchcancel', () => { if (isDragging) onDragEnd(); });

        // Mouse event listeners
        this.header.addEventListener('mousedown', (e) => {
            if (e.button === 0) onDragStart(e.clientY, e.target);
        });
        window.addEventListener('mousemove', (e) => { if (isDragging) onDragMove(e.clientY); });
        window.addEventListener('mouseup', () => { if (isDragging) onDragEnd(); });

        // Document click to dismiss outside
        document.addEventListener('click', (e) => {
            if (this.isOpening) return;
            if (this.isActive()) {
                const content = this.container.querySelector('.bottom-sheet-content');
                if (content && !content.contains(e.target) && !e.target.closest('.bus-stop-marker-wrapper')) {
                    this.hide();
                }
            }
        });
    }

    isActive() {
        return this.container && this.container.classList.contains('active');
    }

    async show(stop) {
        if (!this.container || !this.titleEl) return;

        this.isOpening = true;
        this.titleEl.innerHTML = `${stop.BusStopCode} - ${stop.Description}<br><span class="road-name">${stop.RoadName || ''}</span>`;
        this.currentStopCode = stop.BusStopCode;
        this.container.classList.add('active');

        setTimeout(() => { this.isOpening = false; }, 300);

        // Center map view with padding to keep bus stop above sheet
        if (this.map) {
            const isMobile = window.innerWidth < 768;
            const padding = isMobile
                ? { top: 0, bottom: this.container.offsetHeight || Math.round(window.innerHeight * 0.6), left: 0, right: 0 }
                : { top: 0, bottom: 0, left: this.container.offsetWidth || 375, right: 0 };

            this.map.easeTo({
                center: [stop.Longitude, stop.Latitude],
                padding: padding,
                duration: 400
            });
        }

        await this.loadArrivals(stop.BusStopCode);

        this.startTimers();
    }

    async loadArrivals(busStopCode) {
        if (!this.servicesContainer) return;

        if (!this.cachedServices) {
            this.servicesContainer.innerHTML = '<div style="color: #999; padding: 24px;">Loading...</div>';
        }

        try {
            const data = await fetchBusArrival(busStopCode);
            if (!data.Services || data.Services.length === 0) {
                this.servicesContainer.innerHTML = '<div style="color: #999; padding: 24px;">No buses available at this stop</div>';
                return;
            }

            this.cachedServices = data.Services;
            if (this.lastUpdateEl) {
                this.lastUpdateEl.textContent = formatTime();
            }

            this.renderServices(data.Services);
        } catch (error) {
            console.error('Error fetching arrivals:', error);
            if (this.cachedServices) {
                this.renderServices(this.cachedServices);
            } else {
                this.servicesContainer.innerHTML = '<div style="color: #e53935; padding: 24px;">Failed to load bus services</div>';
            }
        }
    }

    renderServices(services) {
        this.servicesContainer.innerHTML = '';
        const sorted = [...services].sort((a, b) => parseInt(a.ServiceNo, 10) - parseInt(b.ServiceNo, 10));

        sorted.forEach((service) => {
            const row = document.createElement('div');
            row.className = 'service-row';

            const numEl = document.createElement('div');
            numEl.className = 'service-number';
            numEl.innerHTML = `
                <span class="number">${service.ServiceNo}</span>
                <span class="operator">${service.Operator || ''}</span>
            `;

            const cardsEl = document.createElement('div');
            cardsEl.className = 'arrival-cards';

            const buses = [service.NextBus, service.NextBus2, service.NextBus3]
                .filter((b) => b && b.EstimatedArrival);

            buses.forEach((bus) => {
                cardsEl.appendChild(this.createArrivalCard(bus));
            });

            row.appendChild(numEl);
            row.appendChild(cardsEl);
            this.servicesContainer.appendChild(row);
        });
    }

    createArrivalCard(bus) {
        const card = document.createElement('div');
        card.className = 'arrival-card';
        card.dataset.estimatedArrival = bus.EstimatedArrival;

        const load = bus.Load;
        const busType = bus.Type;

        let statusClass = 'status-ok';
        let statusText = '';
        if (load === 'SDA') {
            statusClass = 'status-standing';
            statusText = 'standing';
        } else if (load === 'LSD') {
            statusClass = 'status-crowded';
            statusText = 'crowded';
        }

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
        busIcon.innerHTML = getBusIcon(busType);
        busIcon.style.transform = 'scaleX(-1)';

        card.appendChild(timeGroup);
        card.appendChild(busIcon);
        return card;
    }

    startTimers() {
        this.stopTimers();

        // 1-second countdown ticker
        this.countdownInterval = setInterval(() => {
            if (!this.servicesContainer) return;
            this.servicesContainer.querySelectorAll('.arrival-card').forEach((el) => {
                const est = el.dataset.estimatedArrival;
                if (est) {
                    const timeEl = el.querySelector('.arrival-text');
                    if (timeEl) timeEl.textContent = calculateArrivalTime(est);
                }
            });
        }, 1000);

        // 30-second data polling
        this.refreshInterval = setInterval(() => {
            if (this.currentStopCode && this.isActive()) {
                this.loadArrivals(this.currentStopCode);
            }
        }, 30000);
    }

    stopTimers() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    hide() {
        if (!this.container) return;

        this.container.classList.remove('active');
        this.container.style.transform = '';

        if (this.map) {
            this.map.easeTo({
                padding: { top: 0, bottom: 0, left: 0, right: 0 },
                duration: 300
            });
        }

        this.stopTimers();
        this.currentStopCode = null;
        this.cachedServices = null;

        if (this.onDismissCallback) {
            this.onDismissCallback();
        }
    }
}
