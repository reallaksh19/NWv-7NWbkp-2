/**
 * feedHealthMonitor.js — Per-source error-rate tracker with auto-demotion.
 *
 * Tracks feed fetch success/failure over a 24-hour rolling window using localStorage.
 * Sources with >50% failure rate over that window are auto-demoted (weight = 0).
 * Auto-recovers: events older than 24h are pruned on each write.
 *
 * IMPORTANT: localStorage reads/writes are synchronous. Keep event arrays small
 * (capped at 50 events per URL) to prevent UI-thread blocking.
 */

const STORAGE_KEY   = 'nwv7_feed_health';
const WINDOW_MS     = 24 * 60 * 60 * 1000;  // 24-hour rolling window
const DEMOTE_THRESH = 0.5;                    // pause if failure rate > 50%
const MIN_SAMPLES   = 3;                      // need ≥3 attempts before judging
const MAX_EVENTS    = 50;                     // cap per URL to prevent localStorage bloat

function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) {
        if (e) { return {}; }
        return {};
    }
}

function saveStore(store) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch (e) {
        if (e) { /* Fail silently */ }
    }
}

/**
 * Record a fetch result for a feed URL.
 * Call this after every RSS fetch attempt — success OR failure.
 * @param {string}  url      Feed URL (used as key)
 * @param {boolean} success  true if fetch returned ≥1 valid items, false otherwise
 */
export function recordFeedResult(url, success) {
    if (!url) return;
    const store = loadStore();
    const now   = Date.now();
    if (!store[url]) store[url] = { events: [] };
    store[url].events.push({ ts: now, ok: Boolean(success) });
    // Prune: keep only recent events within window, cap at MAX_EVENTS
    store[url].events = store[url].events
        .filter(e => now - e.ts < WINDOW_MS)
        .slice(-MAX_EVENTS);
    saveStore(store);
}

/**
 * Get the health weight for a feed URL.
 * @param {string} url  Feed URL
 * @returns {number}    1.0 = fully healthy, 0.0 = paused (>50% fail rate)
 */
export function getFeedWeight(url) {
    if (!url) return 1.0;
    const store  = loadStore();
    const entry  = store[url];
    if (!entry || entry.events.length < MIN_SAMPLES) return 1.0; // insufficient data → assume healthy

    const now    = Date.now();
    const recent = entry.events.filter(e => now - e.ts < WINDOW_MS);
    if (recent.length < MIN_SAMPLES) return 1.0;

    const failed = recent.filter(e => !e.ok).length;
    const rate   = failed / recent.length;

    if (rate > DEMOTE_THRESH) return 0.0;    // paused
    return Math.max(0.1, 1.0 - rate);        // proportional: 0% fail→1.0, 49% fail→0.51
}

/**
 * Debug helper — returns health report for all tracked URLs.
 * @returns {Array<{url, events, failRate, weight}>}
 */
export function getFeedHealthReport() {
    const store = loadStore();
    const now   = Date.now();
    return Object.entries(store).map(([url, entry]) => {
        const recent = entry.events.filter(e => now - e.ts < WINDOW_MS);
        const failed = recent.filter(e => !e.ok).length;
        const rate   = recent.length > 0 ? failed / recent.length : 0;
        return {
            url,
            events   : recent.length,
            failRate : rate.toFixed(2),
            weight   : getFeedWeight(url),
        };
    });
}
