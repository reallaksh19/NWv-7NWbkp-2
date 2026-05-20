import { DEFAULT_LOCATION_LIBRARY, buildLocationAliasIndex, topupLocationLibrary } from '../config/locationLibrary.js';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function isOnlineFriendlyCategory(category) {
  return ['offer', 'airline_offer', 'shopping', 'airlines'].includes(String(category || '').toLowerCase());
}

function isLocalOnlyText(text) {
  return /\b(in store|instore|walk in|walk-in|at venue|at store|local only|in chennai|in muscat|pickup only|branch only)\b/i.test(String(text || ''));
}

function scoreMatch(alias, city, text) {
  const normalizedText = normalizeText(text);
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return 0;
  if (normalizedText === normalizedAlias) return 1;
  if (new RegExp(`(^|\\s)${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(normalizedText)) {
    return alias.toLowerCase() === city.toLowerCase() ? 0.95 : 0.82;
  }
  return 0;
}

export function detectCanonicalLocation(text, options = {}) {
  const library = options.locationLibrary || DEFAULT_LOCATION_LIBRARY;
  const selectedCities = uniq(options.selectedCities || Object.keys(library));
  const mode = options.mode || 'offline';
  const category = options.category || null;
  const allowOnlineBypass = options.allowOnlineBypass !== false;
  const normalizedText = normalizeText(text);
  const decisionTrace = [];

  if (!normalizedText) {
    return {
      locationCanonical: null,
      locationConfidence: 0,
      matchedAlias: null,
      matchedAliases: [],
      decisionTrace: ['empty_location_text'],
      acceptance: mode === 'online' ? 'accept' : 'unknown'
    };
  }

  if (mode === 'online' && allowOnlineBypass && isOnlineFriendlyCategory(category) && !isLocalOnlyText(normalizedText)) {
    return {
      locationCanonical: null,
      locationConfidence: 1,
      matchedAlias: null,
      matchedAliases: [],
      decisionTrace: ['online_location_bypass', `category:${category}`],
      acceptance: 'accept'
    };
  }

  let best = null;
  const matchedAliases = [];
  
  for (const city of selectedCities) {
    const payload = library[city];
    if (!payload) continue;

    const aliases = uniq([city, ...(payload.aliases || [])]);
    for (const alias of aliases) {
      const score = scoreMatch(alias, city, normalizedText);
      if (!score) continue;
      
      matchedAliases.push({ city, alias, score });

      const candidate = {
        locationCanonical: city,
        locationConfidence: score,
        matchedAlias: alias,
        region: payload.region || null,
        country: payload.country || null
      };
      if (!best || candidate.locationConfidence > best.locationConfidence) {
        best = candidate;
      }
    }
  }

  if (!best) {
    return {
      locationCanonical: null,
      locationConfidence: 0,
      matchedAlias: null,
      matchedAliases,
      decisionTrace: ['no_location_match'],
      acceptance: mode === 'online' ? 'accept' : 'reject'
    };
  }

  decisionTrace.push(`matched_alias:${best.matchedAlias}`);
  return {
    ...best,
    matchedAliases,
    decisionTrace,
    acceptance: 'accept'
  };
}

export function evaluateLocationEligibility(item, options = {}) {
  const category = item?.category || options.category || null;
  const mode = options.mode || item?.mode || 'offline';
  const text = [item?.title, item?.summary, item?.description, item?.location].filter(Boolean).join(' • ');
  const match = detectCanonicalLocation(text, {
    ...options,
    category,
    mode
  });

  if (match.acceptance === 'accept') {
    return {
      ...match,
      locationEligible: true,
      dropReason: null
    };
  }

  return {
    ...match,
    locationEligible: false,
    dropReason: 'location_mismatch'
  };
}

export function annotateItemLocation(item, options = {}) {
  const result = evaluateLocationEligibility(item, options);
  return {
    ...item,
    locationCanonical: result.locationCanonical,
    locationConfidence: result.locationConfidence,
    locationEligible: result.locationEligible,
    locationMatchedAlias: result.matchedAlias,
    locationDecisionTrace: result.decisionTrace,
    dropReason: item?.dropReason || result.dropReason
  };
}

export { DEFAULT_LOCATION_LIBRARY, buildLocationAliasIndex, topupLocationLibrary };
