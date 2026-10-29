/**
 * Formatting and HTML utility helpers
 */

export function calculateArrivalTime(estimatedArrival) {
    if (!estimatedArrival) return '--';
    const diffMins = Math.floor((new Date(estimatedArrival) - new Date()) / 60000);
    if (diffMins < 1) return 'Arr';
    if (diffMins === 1) return '1 min';
    return `${diffMins} min`;
}

export function formatTime(date = new Date()) {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export function getLoadColor(load) {
    switch (load) {
        case 'SEA': return '#4CAF50';
        case 'SDA': return '#FF9800';
        case 'LSD': return '#F44336';
        default:    return '#4285F4';
    }
}

export function getLoadText(load) {
    switch (load) {
        case 'SEA': return 'Seats Available';
        case 'SDA': return 'Standing Available';
        case 'LSD': return 'Limited Standing';
        default:    return 'Unknown';
    }
}

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function highlightMatch(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);
    const escapedText = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapedText.replace(regex, '<mark>$1</mark>');
}

export function debounce(func, wait = 150) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
