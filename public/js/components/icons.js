/**
 * Icon helpers for BusSin
 * References external SVG sprite and individual SVG assets
 */

const SPRITE_PATH = 'assets/icons/sprite.svg';
const ICON_NORMAL_MARKER = 'assets/icons/marker-normal.svg';
const ICON_ACTIVE_MARKER = 'assets/icons/marker-active.svg';

/**
 * Returns HTML string referencing the bus type SVG symbol in the sprite
 * Supported types: 'SD' (Single Deck), 'DD' (Double Deck), 'BD' (Bendy)
 */
export function getBusIcon(busType) {
    let symbolId = 'bus-sd';
    if (busType === 'DD') symbolId = 'bus-dd';
    else if (busType === 'BD') symbolId = 'bus-bd';

    return `<svg aria-hidden="true"><use href="${SPRITE_PATH}#${symbolId}"></use></svg>`;
}

/**
 * Returns marker HTML element representation with proper dimensions
 */
export function getMarkerHTML(size, isActive = false) {
    if (isActive) {
        const biggerWidth = size + 20;
        const height = Math.round((biggerWidth * 279) / 220);
        return `<img src="${ICON_ACTIVE_MARKER}" width="${biggerWidth}" height="${height}" alt="Selected Bus Stop" draggable="false" />`;
    }

    const width = Math.round((size * 220) / 401);
    return `<img src="${ICON_NORMAL_MARKER}" width="${width}" height="${size}" alt="Bus Stop" draggable="false" />`;
}
