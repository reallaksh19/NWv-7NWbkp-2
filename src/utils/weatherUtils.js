/* eslint-disable */
/**
 * Weather Utility Functions
 */

/**
 * Determine the display status for rainfall based on probability and amount.
 * @param {number} prob - Rain probability percentage (0-100)
 * @param {string|number} mmStr - Rain amount string (e.g. "2.5mm") or number
 * @returns {Object} { icon, label, className, intensity }
 */
export function getRainStatus(prob, mmStr) {
    let mm = 0;
    if (typeof mmStr === 'string') {
        mm = parseFloat(mmStr.replace('mm', '')) || 0;
    } else {
        mm = mmStr || 0;
    }

    const p = prob || 0;

    // Strict check: if no probability and no mm, return null
    if (p <= 0 && mm <= 0) {
        return null;
    }

    // Intensity calculation
    let intensity = 'light';
    let icon = '🌧️';

    // Logic Refinement:
    // User complaint: "Rainfall icon not appearing" for "50% prob, 0.4mm".
    // 50% prob is significant. 0.4mm is light.

    if (mm >= 10 || (p >= 80 && mm >= 5)) {
        intensity = 'heavy';
        icon = '⛈️';
    } else if (mm >= 2 || p >= 60) {
        intensity = 'moderate';
        icon = '🌧️';
    } else {
        // Light rain
        if (p < 30 && mm < 1) {
             intensity = 'trace';
             icon = '🌦️';
        } else {
             intensity = 'light';
             icon = '🌧️';
        }
    }

    // Label formatting
    let label = '';

    // Always show probability if > 0
    if (p > 0) label += `${p}%`;

    // Show MM logic
    if (mm >= 0.1) {
        if (label) label += ' • ';
        label += `${mm.toFixed(1)}mm`;
    } else if (p >= 20) {
        // High probability but negligible amount -> "Trace"
        // Solves user confusion: "64% when 0mm" -> Now "64% • Trace"
        if (label) label += ' • ';
        label += 'Trace';
    }

    return { icon, label, intensity, mm, prob: p, iconType: intensity };
}

/**
 * Get CSS color style for rain intensity
 * @param {string} intensity - 'light', 'moderate', 'heavy', 'trace'
 * @returns {Object} Style object
 */
export function getRainStyle(intensity) {
    switch (intensity) {
        case 'heavy':
            return { color: '#ef4444', fontWeight: 'bold' }; // Red/Danger
        case 'moderate':
            return { color: '#60a5fa', fontWeight: '600' }; // Blue (lighter than before for contrast)
        case 'trace':
             return { color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9em' }; // Grey/Italic for trace
        case 'light':
        default:
            // Improved visibility for light rain
            return { color: '#e2e8f0', opacity: 0.9 }; // Slate-200
    }
}

// --- Weather Icon Logic (Moved from WeatherIcons.jsx) ---

/**
 * Maps WMO weather code + hour + temp to an icon ID.
 *
 * @param {number} code  - WMO weather code (0–99)
 * @param {number} hour  - 0–23
 * @param {number} [temp]  - temperature in °C (unused for now, reserved)
 * @param {number} [wind]  - wind speed km/h (unused for now, reserved)
 * @returns {string} icon ID like "day_clear"
 */
export function getWeatherIconId(code, hour, temp, wind) {
    const period = getPeriod(hour);
    const condition = codeToCondition(code);
    const id = `${period}_${condition}`;

    // Check aliases (defined here instead of relying on JSX file)
    const aliases = {
        night_cloudy: 'day_overcast',
        night_overcast: 'day_overcast',
        night_fog: 'day_fog',
        night_drizzle: 'day_drizzle',
        night_lightRain: 'day_lightRain',
        night_rain: 'day_rain',
        night_heavyRain: 'day_heavyRain',
        night_storm: 'day_storm',
        night_snow: 'day_snow',
        night_wind: 'day_wind',
        dawn_partlyCloudy: 'day_partlyCloudy',
        dawn_cloudy: 'day_cloudy',
        dawn_rain: 'day_rain',
        dusk_partlyCloudy: 'day_partlyCloudy',
        dusk_cloudy: 'day_cloudy',
        dusk_rain: 'day_rain',
    };

    if (aliases[id]) return aliases[id];

    // Fallback logic handled by the component usually, but here we return the ID.
    // If the ID isn't in the component map, it defaults.
    // We should return a "safe" ID if we know it won't match, or just return constructed ID.
    return id;
}

export function getPeriod(hour) {
    if (hour >= 6 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 17) return 'day';
    if (hour >= 17 && hour < 19) return 'dusk';
    return 'night';
}

export function codeToCondition(code) {
    if (code === 0) return 'clear';
    if (code <= 1) return 'clear';
    if (code === 2) return 'partlyCloudy';
    if (code === 3) return 'overcast';
    if (code >= 45 && code <= 48) return 'fog';
    if (code >= 51 && code <= 55) return 'drizzle';
    if (code >= 56 && code <= 57) return 'drizzle'; // freezing drizzle
    if (code === 61) return 'lightRain';
    if (code === 63) return 'rain';
    if (code === 65) return 'heavyRain';
    if (code >= 66 && code <= 67) return 'rain'; // freezing rain
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain'; // rain showers
    if (code === 85 || code === 86) return 'snow'; // snow showers
    if (code >= 95 && code <= 99) return 'storm';
    return 'cloudy';
}
