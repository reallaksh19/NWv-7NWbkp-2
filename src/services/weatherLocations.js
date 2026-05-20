/**
 * Weather location registry – single source of truth for supported static-host cities.
 */

export const WEATHER_LOCATION_CONFIG_VERSION = 'weather-locations-v3-colombo-ux';

export const DEFAULT_WEATHER_CITIES = ['chennai', 'trichy', 'muscat', 'colombo'];

export const WEATHER_LOCATION_REGISTRY = {
    chennai: {
        key: 'chennai',
        lat: 13.0827,
        lon: 80.2707,
        display: 'Chennai',
        country: 'India',
        icon: '🏛️',
        aliases: ['madras'],
    },
    trichy: {
        key: 'trichy',
        lat: 10.7905,
        lon: 78.7047,
        display: 'Trichy',
        country: 'India',
        icon: '🏯',
        aliases: ['tiruchirappalli', 'tiruchirapalli', 'tiruchi'],
    },
    muscat: {
        key: 'muscat',
        lat: 23.5859,
        lon: 58.4059,
        display: 'Muscat',
        country: 'Oman',
        icon: '📍',
        aliases: ['maskad', 'masqat'],
    },
    colombo: {
        key: 'colombo',
        lat: 6.9271,
        lon: 79.8612,
        display: 'Colombo',
        country: 'Sri Lanka',
        icon: '🌴',
        aliases: ['columbo', 'kolamba', 'sri lanka capital'],
    },
};

export function normalizeWeatherCity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

export function resolveRegistryKey(cityName) {
    const key = normalizeWeatherCity(cityName);
    if (WEATHER_LOCATION_REGISTRY[key]) return key;

    for (const [canonical, entry] of Object.entries(WEATHER_LOCATION_REGISTRY)) {
        if ((entry.aliases || []).map(normalizeWeatherCity).includes(key)) return canonical;
    }

    return null;
}

export function getCityWeatherKey(cityName) {
    return resolveRegistryKey(cityName) || normalizeWeatherCity(cityName);
}

export function getWeatherLocation(cityName) {
    const key = resolveRegistryKey(cityName);
    return key ? WEATHER_LOCATION_REGISTRY[key] : null;
}

export function getWeatherLocationLabel(cityName) {
    const location = getWeatherLocation(cityName);
    if (location) return location.display;

    const raw = String(cityName || '').trim();
    if (!raw) return 'Unknown';

    return raw
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

export function getWeatherLocationOptions() {
    return Object.values(WEATHER_LOCATION_REGISTRY)
        .map(location => ({
            key: location.key,
            label: location.display,
            country: location.country,
            icon: location.icon,
            lat: location.lat,
            lon: location.lon,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function uniqueWeatherCities(cities) {
    const result = [];

    for (const city of Array.isArray(cities) ? cities : []) {
        const key = getCityWeatherKey(city);
        if (!key || result.includes(key)) continue;
        if (!WEATHER_LOCATION_REGISTRY[key]) continue;
        result.push(key);
    }

    return result;
}

export function getConfiguredWeatherCities(settings) {
    const raw = settings?.weather?.cities;
    const normalized = uniqueWeatherCities(raw);

    if (normalized.length === 0) return [...DEFAULT_WEATHER_CITIES];

    const alreadyMigrated =
        settings?.weather?.locationConfigVersion === WEATHER_LOCATION_CONFIG_VERSION;

    if (!alreadyMigrated) {
        return uniqueWeatherCities([...normalized, ...DEFAULT_WEATHER_CITIES]);
    }

    return normalized;
}

export function buildWeatherSettingsWithCities(baseSettings, cities) {
    const nextCities = uniqueWeatherCities(cities);

    return {
        ...baseSettings,
        weather: {
            ...(baseSettings?.weather || {}),
            cities: nextCities.length ? nextCities : [...DEFAULT_WEATHER_CITIES],
            locationConfigVersion: WEATHER_LOCATION_CONFIG_VERSION,
        },
    };
}
