export const TRAVEL_LOCATION_PROFILE_VERSION = 'travel-location-profile-v1-colombo';

export const TRAVEL_LOCATION_REGISTRY = {
  colombo: {
    key: 'colombo',
    display: 'Colombo',
    countryCode: 'LK',
    countryLabel: 'Sri Lanka',
    regionLabel: 'Western Province',
    icon: '🇱🇰',
    lat: 6.9271,
    lon: 79.8612,
    aliases: [
      'colombo',
      'columbo',
      'kolamba',
      'sri lanka',
      'srilanka',
      'ceylon',
      'western province',
      'lk',
      'sri lanka capital',
    ],
    storyKeywords: [
      'colombo',
      'columbo',
      'sri lanka',
      'srilanka',
      'ceylon',
      'western province',
      'lk',
      'sri lankan',
      'lankan',
    ],
    edition: {
      country: 'LK',
      lang: 'en',
      timeRange: '30d',
    },
  },

  chennai: {
    key: 'chennai',
    display: 'Chennai',
    countryCode: 'IN',
    countryLabel: 'India',
    regionLabel: 'Tamil Nadu',
    icon: '🇮🇳',
    lat: 13.0827,
    lon: 80.2707,
    aliases: ['chennai', 'madras', 'tamil nadu', 'tn'],
    storyKeywords: ['chennai', 'madras', 'tamil nadu', 'tn', 'india'],
    edition: {
      country: 'IN',
      lang: 'en',
      timeRange: '30d',
    },
  },

  trichy: {
    key: 'trichy',
    display: 'Trichy',
    countryCode: 'IN',
    countryLabel: 'India',
    regionLabel: 'Tamil Nadu',
    icon: '🇮🇳',
    lat: 10.7905,
    lon: 78.7047,
    aliases: ['trichy', 'tiruchirappalli', 'tiruchirapalli', 'tiruchi'],
    storyKeywords: ['trichy', 'tiruchirappalli', 'tiruchirapalli', 'tiruchi', 'tamil nadu', 'india'],
    edition: {
      country: 'IN',
      lang: 'en',
      timeRange: '30d',
    },
  },

  muscat: {
    key: 'muscat',
    display: 'Muscat',
    countryCode: 'OM',
    countryLabel: 'Oman',
    regionLabel: 'Muscat Governorate',
    icon: '🇴🇲',
    lat: 23.5859,
    lon: 58.4059,
    aliases: ['muscat', 'masqat', 'maskat', 'oman'],
    storyKeywords: ['muscat', 'masqat', 'oman', 'omani'],
    edition: {
      country: 'OM',
      lang: 'en',
      timeRange: '30d',
    },
  },
};

export const DEFAULT_TRAVEL_LOCATION_KEY = 'chennai';

function safeLocalStorageGet(key) {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function normalizeTravelLocation(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function resolveTravelLocationKey(value) {
  const normalized = normalizeTravelLocation(value);
  if (!normalized) return null;

  if (TRAVEL_LOCATION_REGISTRY[normalized]) return normalized;

  for (const [key, profile] of Object.entries(TRAVEL_LOCATION_REGISTRY)) {
    const aliases = [profile.key, profile.display, profile.countryLabel, ...(profile.aliases || [])]
      .map(normalizeTravelLocation);

    if (aliases.includes(normalized)) return key;
    if (aliases.some(alias => normalized.includes(alias))) return key;
  }

  return null;
}

export function getTravelLocationOptions() {
  return Object.values(TRAVEL_LOCATION_REGISTRY)
    .map(profile => ({
      key: profile.key,
      label: profile.display,
      country: profile.countryLabel,
      region: profile.regionLabel,
      icon: profile.icon,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildTravelLocationSettings(baseSettings = {}, patch = {}) {
  const rawCity = patch.city ?? patch.location ?? baseSettings?.travelLocation?.city;
  const city = resolveTravelLocationKey(rawCity) || DEFAULT_TRAVEL_LOCATION_KEY;

  return {
    ...baseSettings,
    travelLocation: {
      enabled: true,
      prioritizeStories: true,
      ...(baseSettings.travelLocation || {}),
      ...patch,
      city,
      profileVersion: TRAVEL_LOCATION_PROFILE_VERSION,
    },
  };
}

export function getTravelLocationProfile(settings = {}, options = {}) {
  const explicitCity = settings?.travelLocation?.city;
  const weatherActiveCity =
    options.activeWeatherCity ||
    settings?.weather?.activeCity ||
    safeLocalStorageGet('weather_active_city');

  const firstConfiguredWeatherCity = Array.isArray(settings?.weather?.cities)
    ? settings.weather.cities[0]
    : '';

  const key =
    resolveTravelLocationKey(explicitCity) ||
    resolveTravelLocationKey(weatherActiveCity) ||
    resolveTravelLocationKey(firstConfiguredWeatherCity) ||
    DEFAULT_TRAVEL_LOCATION_KEY;

  const registryProfile = TRAVEL_LOCATION_REGISTRY[key] || TRAVEL_LOCATION_REGISTRY[DEFAULT_TRAVEL_LOCATION_KEY];

  const enabled = settings?.travelLocation?.enabled !== false;
  const prioritizeStories = enabled && settings?.travelLocation?.prioritizeStories !== false;

  return {
    ...registryProfile,
    enabled,
    prioritizeStories,
    source: explicitCity
      ? 'manual'
      : weatherActiveCity
        ? 'weather-active-city'
        : firstConfiguredWeatherCity
          ? 'weather-config'
          : 'default',
    profileVersion: TRAVEL_LOCATION_PROFILE_VERSION,
  };
}

export function getTravelEditionOptions(profile) {
  const resolved = profile?.key ? profile : getTravelLocationProfile({});
  return {
    country: resolved.edition?.country || resolved.countryCode || 'IN',
    lang: resolved.edition?.lang || 'en',
    timeRange: resolved.edition?.timeRange || '30d',
  };
}

export function isTravelLocationProfile(value) {
  return Boolean(value?.key && value?.countryCode && Array.isArray(value?.storyKeywords));
}
