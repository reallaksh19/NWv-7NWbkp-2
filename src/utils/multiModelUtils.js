/* eslint-disable */
/**
 * Multi-Model Weather Utilities
 * Handles averaging and consensus calculations from multiple weather models
 */

/**
 * Calculate rainfall consensus from multiple models
 * @param {Array} modelData - Array of model precipitation probability data
 * @returns {Object|null} Consensus object with avg, min, max, range, etc.
 */
export function calculateRainfallConsensus(modelData) {
    const validProbs = modelData.filter(m => m?.precipitation_probability != null);

    if (validProbs.length === 0) return null;

    const values = validProbs.map(m => m.precipitation_probability);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const isWideRange = range > 30;

    return {
        avg,
        min,
        max,
        range,
        isWideRange,
        displayString: `${isWideRange ? '!' : '~'}${avg}% (${min}-${max}%)`,
        symbol: isWideRange ? '!' : '~',
        models: validProbs.length
    };
}

/**
 * Average temperature from multiple models (Weighted)
 * ECMWF: 1.2x, ICON: 1.0x, GFS: 0.8x
 * @param {Array} modelData - Array of objects { temperature_2m, modelName }
 * @returns {number|null} Averaged temperature
 */
export function averageTemperature(modelData) {
    const validTemps = modelData.filter(m => m?.temperature_2m != null);
    if (validTemps.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    const weights = { ecmwf: 1.2, icon: 1.0, gfs: 0.8 };

    validTemps.forEach(m => {
        // Default to 1.0 if model name unknown or missing
        const w = weights[m.modelName] || 1.0;
        weightedSum += m.temperature_2m * w;
        totalWeight += w;
    });

    if (totalWeight === 0) return Math.round(validTemps.reduce((a, b) => a + b.temperature_2m, 0) / validTemps.length);

    return Math.round(weightedSum / totalWeight);
}

/**
 * Average apparent temperature (feels like) from multiple models
 * @param {Array} modelData - Array of model apparent temperature data
 * @returns {number|null} Averaged apparent temperature
 */
export function averageApparentTemperature(modelData) {
    const validTemps = modelData.filter(m => m?.apparent_temperature != null);

    if (validTemps.length === 0) return null;

    const values = validTemps.map(m => m.apparent_temperature);
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Get most common weather code from models
 * @param {Array} modelData - Array of model weather code data
 * @returns {number|null} Most common weather code
 */
export function getMostCommonWeatherCode(modelData) {
    const validCodes = modelData.filter(m => m?.weather_code != null);

    if (validCodes.length === 0) return null;

    const codes = validCodes.map(m => m.weather_code);

    // Count occurrences
    const counts = {};
    codes.forEach(code => {
        counts[code] = (counts[code] || 0) + 1;
    });

    // Find most common
    let maxCount = 0;
    let mostCommon = codes[0];

    for (const [code, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommon = parseInt(code);
        }
    }

    return mostCommon;
}

/**
 * Average precipitation amount from multiple models (Weighted)
 * @param {Array} modelData - Array of objects { precipitation, modelName }
 * @returns {number} Averaged precipitation in mm
 */
export function averagePrecipitation(modelData) {
    const validPrecip = modelData.filter(m => m?.precipitation != null);
    if (validPrecip.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;
    const weights = { ecmwf: 1.2, icon: 1.0, gfs: 0.8 };

    validPrecip.forEach(m => {
        const w = weights[m.modelName] || 1.0;
        weightedSum += m.precipitation * w;
        totalWeight += w;
    });

    if (totalWeight === 0) return 0;

    return parseFloat((weightedSum / totalWeight).toFixed(1));
}

/**
 * Get model names from successful fetches
 * @param {Object} modelResults - Object with model names as keys
 * @returns {Array} Array of successful model names
 */
export function getSuccessfulModels(modelResults) {
    return Object.entries(modelResults)
        .filter(([_, data]) => data !== null)
        .map(([name, _]) => name);
}

/**
 * Format model names for display
 * @param {Array} modelNames - Array of model names
 * @returns {string} Formatted string
 */
export function formatModelNames(modelNames) {
    const displayNames = {
        'ecmwf': 'ECMWF',
        'gfs': 'GFS',
        'icon': 'ICON'
    };

    return modelNames.map(name => displayNames[name] || name).join(', ');
}
