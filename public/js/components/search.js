import { debounce, escapeHtml, highlightMatch } from '../utils/formatters.js';

const BUS_STOP_LOGO_PATH = 'assets/img/Singapore_Bus_logo.svg';
const SPRITE_PATH = 'assets/icons/sprite.svg';

/**
 * Custom Mapbox Search Control Button
 */
export class BusStopSearchControl {
    constructor(onOpenCallback) {
        this.onOpenCallback = onOpenCallback;
        this._container = null;
        this._map = null;
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapboxgl-ctrl-search';
        btn.title = 'Search Bus Stops';
        btn.setAttribute('aria-label', 'Search Bus Stops');
        btn.innerHTML = `
            <svg width="17" height="17" aria-hidden="true">
                <use href="${SPRITE_PATH}#search"></use>
            </svg>
        `;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onOpenCallback) {
                this.onOpenCallback();
            }
        });

        this._container.appendChild(btn);
        return this._container;
    }

    onRemove() {
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = undefined;
    }
}

/**
 * Bus Stop Search Modal & Autocomplete Component
 */
export class SearchModal {
    constructor(onSelectCallback) {
        this.onSelectCallback = onSelectCallback;
        this.allStops = [];
        this.currentFilteredStops = [];
        this.highlightedIndex = -1;

        this.modal = document.getElementById('searchModal');
        this.backdrop = document.getElementById('searchModalBackdrop');
        this.input = document.getElementById('busStopSearchInput');
        this.clearBtn = document.getElementById('searchClearBtn');
        this.closeBtn = document.getElementById('searchCloseBtn');
        this.resultsList = document.getElementById('searchResultsList');

        this.initEvents();
    }

    setBusStops(stops) {
        this.allStops = stops || [];
    }

    initEvents() {
        if (!this.modal || !this.input) return;

        if (this.backdrop) this.backdrop.addEventListener('click', () => this.close());
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                this.input.value = '';
                this.clearBtn.style.display = 'none';
                this.renderResults('');
                this.input.focus();
            });
        }

        // Debounced input search for performance across 5,000 stops
        const handleSearch = debounce(() => {
            const query = this.input.value.trim();
            if (this.clearBtn) {
                this.clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
            }
            this.renderResults(query);
        }, 120);

        this.input.addEventListener('input', handleSearch);

        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateResults(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateResults(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.highlightedIndex >= 0 && this.highlightedIndex < this.currentFilteredStops.length) {
                    this.selectStop(this.currentFilteredStops[this.highlightedIndex]);
                } else if (this.currentFilteredStops.length > 0) {
                    this.selectStop(this.currentFilteredStops[0]);
                }
            }
        });
    }

    open() {
        if (!this.modal) return;
        this.modal.classList.add('active');
        this.modal.setAttribute('aria-hidden', 'false');

        if (this.input) {
            this.input.value = '';
            if (this.clearBtn) this.clearBtn.style.display = 'none';
            this.renderResults('');
            setTimeout(() => this.input.focus(), 60);
        }
    }

    close() {
        if (!this.modal) return;
        this.modal.classList.remove('active');
        this.modal.setAttribute('aria-hidden', 'true');
    }

    renderResults(query) {
        if (!this.resultsList) return;

        if (!query) {
            this.currentFilteredStops = [];
            this.highlightedIndex = -1;
            this.resultsList.innerHTML = `<div class="search-empty-state">Type a road name, bus stop code (e.g. 01012), or description to search.</div>`;
            return;
        }

        const q = query.toLowerCase();
        const matches = this.allStops
            .filter((stop) => {
                const code = (stop.BusStopCode || '').toLowerCase();
                const desc = (stop.Description || '').toLowerCase();
                const road = (stop.RoadName || '').toLowerCase();
                return code.includes(q) || desc.includes(q) || road.includes(q);
            })
            .slice(0, 30); // Top 30 matches

        this.currentFilteredStops = matches;
        this.highlightedIndex = -1;

        if (matches.length === 0) {
            this.resultsList.innerHTML = `<div class="search-empty-state">No bus stops found matching "<strong>${escapeHtml(query)}</strong>".</div>`;
            return;
        }

        this.resultsList.innerHTML = matches
            .map((stop, idx) => `
                <div class="search-item" data-index="${idx}">
                    <div class="search-item-icon">
                        <img src="${BUS_STOP_LOGO_PATH}" alt="Bus Stop" width="22" height="25" />
                    </div>
                    <div class="search-item-info">
                        <div class="search-item-title">${highlightMatch(stop.Description || 'Bus Stop', q)}</div>
                        <div class="search-item-subtitle">
                            <span class="search-item-badge">${highlightMatch(stop.BusStopCode, q)}</span>
                            <span>${highlightMatch(stop.RoadName || '', q)}</span>
                        </div>
                    </div>
                </div>
            `)
            .join('');

        this.resultsList.querySelectorAll('.search-item').forEach((itemEl) => {
            itemEl.addEventListener('click', () => {
                const idx = parseInt(itemEl.dataset.index, 10);
                if (matches[idx]) {
                    this.selectStop(matches[idx]);
                }
            });
        });
    }

    navigateResults(direction) {
        if (!this.resultsList || this.currentFilteredStops.length === 0) return;

        const items = this.resultsList.querySelectorAll('.search-item');
        if (items.length === 0) return;

        this.highlightedIndex += direction;
        if (this.highlightedIndex < 0) this.highlightedIndex = 0;
        if (this.highlightedIndex >= items.length) this.highlightedIndex = items.length - 1;

        items.forEach((el, idx) => {
            if (idx === this.highlightedIndex) {
                el.classList.add('highlighted');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('highlighted');
            }
        });
    }

    selectStop(stop) {
        this.close();
        if (this.onSelectCallback) {
            this.onSelectCallback(stop);
        }
    }
}
