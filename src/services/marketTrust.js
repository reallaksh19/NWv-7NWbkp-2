// src/services/marketTrust.js

export const MARKET_CACHE_SCHEMA_VERSION = 'market-v3';

export const MARKET_CONTEXT_CACHE_KEY = 'market_cache_v3';
export const MARKET_SERVICE_CACHE_KEY = 'indian_market_stable_data_v3';

export const MARKET_FRESH_CACHE_TTL_MS = 15 * 60 * 1000;
export const MARKET_SERVICE_CACHE_TTL_MS = 30 * 60 * 1000;
export const MARKET_STALE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MARKET_SNAPSHOT_FRESH_MS = 6 * 60 * 60 * 1000;
export const MARKET_EXPIRED_DISPLAY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function parseMarketTimestamp(payload) {
  if (!payload) return null;

  const candidates = [
    payload.fetchedAt,
    payload.generatedAt,
    payload.generated_at,
    payload.asOf,
    payload.timestamp
  ];

  for (const value of candidates) {
    if (!value) continue;

    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function getMarketPayloadAgeMs(payload, nowMs = Date.now()) {
  const ts = parseMarketTimestamp(payload);
  if (!ts) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - ts);
}

export function isMarketPayloadUsable(payload) {
  return Boolean(
    payload &&
    Array.isArray(payload.indices) &&
    payload.indices.some((item) => item?.name && item?.value)
  );
}

export function isMarketPayloadFresh(payload, ttlMs, nowMs = Date.now()) {
  return isMarketPayloadUsable(payload) && getMarketPayloadAgeMs(payload, nowMs) <= ttlMs;
}

export function isMarketPayloadDisplayable(payload, maxAgeMs = MARKET_EXPIRED_DISPLAY_MAX_AGE_MS) {
  if (!isMarketPayloadUsable(payload)) return false;

  const mode = String(payload.sourceMode || '').toLowerCase();

  // Seed is always displayable because it is explicit non-live fallback.
  if (mode === 'seed') return true;

  const ageMs = getMarketPayloadAgeMs(payload);

  // Never show unknown-age live/snapshot/cache data as normal data.
  if (!Number.isFinite(ageMs)) return false;

  // Reject the 900h+ stale case.
  return ageMs <= maxAgeMs;
}

export function markMarketPayload(payload, sourceMode, extra = {}) {
  const timestamp = parseMarketTimestamp(payload) || Date.now();

  return {
    ...payload,
    ...extra,
    schemaVersion: MARKET_CACHE_SCHEMA_VERSION,
    sourceMode,
    fetchedAt: timestamp,
    generatedAt: payload?.generatedAt || payload?.generated_at || new Date(timestamp).toISOString(),
    sourceHealth: normalizeSourceHealth(payload?.sourceHealth || extra.sourceHealth || {}, sourceMode)
  };
}

export function normalizeSourceHealth(rawHealth = {}, fallbackMode = 'unknown') {
  const normalized = {};

  for (const [key, value] of Object.entries(rawHealth || {})) {
    if (typeof value === 'string') {
      normalized[key] = {
        status: normalizeHealthStatus(value),
        provider: key,
        mode: value,
        message: value
      };
      continue;
    }

    if (value && typeof value === 'object') {
      normalized[key] = {
        provider: value.provider || key,
        status: normalizeHealthStatus(value.status || value.mode || fallbackMode),
        mode: value.mode || fallbackMode,
        winner: value.winner || null,
        freshnessMs: Number.isFinite(Number(value.freshnessMs)) ? Number(value.freshnessMs) : null,
        message: value.message || value.reason || ''
      };
      continue;
    }

    normalized[key] = {
      provider: key,
      status: 'unknown',
      mode: fallbackMode,
      message: ''
    };
  }

  if (Object.keys(normalized).length === 0) {
    normalized[fallbackMode] = {
      provider: fallbackMode,
      status: normalizeHealthStatus(fallbackMode),
      mode: fallbackMode,
      message: fallbackMode
    };
  }

  return normalized;
}

export function normalizeHealthStatus(value) {
  const text = String(value || '').toLowerCase();

  if (text.includes('live') || text.includes('ok') || text.includes('success')) return 'live';
  if (text.includes('official')) return 'official';
  if (text.includes('snapshot')) return text.includes('stale') ? 'stale' : 'snapshot';
  if (text.includes('cache')) return text.includes('stale') ? 'stale' : 'cache';
  if (text.includes('seed')) return 'seed';
  if (text.includes('eod')) return 'eod';
  if (text.includes('failed') || text.includes('error')) return 'failed';
  if (text.includes('empty')) return 'empty';

  return 'unknown';
}

export function summarizeMarketSourceHealth(marketData = {}) {
  const sourceMode = String(marketData?.sourceMode || '').toLowerCase();
  const health = normalizeSourceHealth(marketData?.sourceHealth || {}, sourceMode || 'unknown');
  const values = Object.values(health);

  const counts = {
    live: 0,
    official: 0,
    snapshot: 0,
    cache: 0,
    stale: 0,
    seed: 0,
    failed: 0,
    empty: 0,
    unknown: 0
  };

  for (const item of values) {
    const status = normalizeHealthStatus(item.status || item.mode);
    counts[status] = (counts[status] || 0) + 1;
  }

  let modeStr = 'cached';
  let modeLabel = 'Cached';

  if (sourceMode === 'live' || counts.live > 0) {
    modeStr = 'live';
    modeLabel = 'Live';
  } else if (sourceMode === 'official' || counts.official > 0) {
    modeStr = 'live';
    modeLabel = 'Official';
  } else if (sourceMode === 'snapshot' || counts.snapshot > 0) {
    modeStr = 'snapshot';
    modeLabel = 'Snapshot';
  } else if (sourceMode === 'stale-cache' || sourceMode === 'stale-snapshot' || counts.stale > 0) {
    modeStr = 'degraded';
    modeLabel = 'Stale';
  } else if (sourceMode === 'seed' || counts.seed > 0) {
    modeStr = 'degraded';
    modeLabel = 'Seed';
  } else if (counts.failed > 0 || counts.empty > 0) {
    modeStr = 'degraded';
    modeLabel = 'Limited';
  }

  return {
    health,
    counts,
    modeStr,
    modeLabel
  };
}

export function shouldRejectMarketPayload(payload, options = {}) {
  const {
    maxAgeMs = MARKET_EXPIRED_DISPLAY_MAX_AGE_MS,
    allowSeed = true
  } = options;

  if (!isMarketPayloadUsable(payload)) {
    return {
      reject: true,
      reason: 'Market payload has no displayable index rows.'
    };
  }

  const sourceMode = String(payload?.sourceMode || '').toLowerCase();

  if (allowSeed && sourceMode === 'seed') {
    return { reject: false, reason: null };
  }

  const ageMs = getMarketPayloadAgeMs(payload);

  if (!Number.isFinite(ageMs)) {
    return {
      reject: true,
      reason: 'Market payload has no valid freshness timestamp.'
    };
  }

  if (ageMs > maxAgeMs) {
    return {
      reject: true,
      reason: `Market payload expired: ${Math.round(ageMs / 3600000)}h old.`
    };
  }

  return { reject: false, reason: null };
}