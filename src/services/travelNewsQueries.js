import {
  getTravelEditionOptions,
  getTravelLocationProfile,
  resolveTravelLocationKey,
  TRAVEL_LOCATION_REGISTRY,
} from './travelLocationProfile.js';

const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search';

function encodeQuery(value) {
  return encodeURIComponent(String(value || '').trim());
}

function buildGoogleNewsRssUrl(query, options = {}) {
  const country = String(options.country || 'IN').toUpperCase();
  const lang = String(options.lang || 'en').toLowerCase();
  const ceid = `${country}:${lang}`;

  return `${GOOGLE_NEWS_RSS_BASE}?q=${encodeQuery(query)}&hl=${lang}&gl=${country}&ceid=${ceid}`;
}

export function buildTravelNewsQueries(profileInput = null) {
  const profile = profileInput?.key
    ? profileInput
    : getTravelLocationProfile(profileInput || {});

  const edition = getTravelEditionOptions(profile);
  const city = profile.display;
  const country = profile.countryLabel;

  const baseQueries = [
    `${city} news`,
    `${city} local news`,
    `${country} breaking news`,
    `${city} travel advisory`,
    `${city} airport`,
    `${city} weather alert`,
    `${country} tourism`,
    `${country} transport`,
  ];

  const uniqueQueries = [...new Set(baseQueries.map(query => query.trim()).filter(Boolean))];

  return uniqueQueries.map((query, index) => ({
    id: `${profile.key}-travel-${index + 1}`,
    locationKey: profile.key,
    label: query,
    query,
    country: edition.country,
    lang: edition.lang,
    url: buildGoogleNewsRssUrl(query, edition),
    priority: index < 3 ? 'high' : index < 6 ? 'medium' : 'low',
  }));
}

export function buildTravelNewsSourcePolicy(profileInput = null) {
  const profile = profileInput?.key
    ? profileInput
    : getTravelLocationProfile(profileInput || {});
  const edition = getTravelEditionOptions(profile);
  const queries = buildTravelNewsQueries(profile);

  return {
    schemaVersion: 1,
    type: 'travel-location-news-policy',
    generatedFor: {
      key: profile.key,
      display: profile.display,
      countryCode: profile.countryCode,
      countryLabel: profile.countryLabel,
      edition,
    },
    freshness: {
      maxAgeMinutes: 180,
      staleAfterMinutes: 360,
    },
    dedupe: {
      keyFields: ['url', 'title', 'source'],
      titleSimilarityThreshold: 0.84,
    },
    queries,
  };
}

export function buildAllTravelNewsSourcePolicies() {
  return Object.keys(TRAVEL_LOCATION_REGISTRY).map(key =>
    buildTravelNewsSourcePolicy({ travelLocation: { city: key } })
  );
}

export function resolveTravelNewsPolicyKey(value) {
  return resolveTravelLocationKey(value) || 'chennai';
}

export const __travelNewsQueryTestUtils = {
  buildGoogleNewsRssUrl,
};
