# WI — Agent 02: Market — CORS Proxy Fallbacks + Static Host Fix
**Sequence:** 2 of 10
**Prerequisite:** Agent 01 complete
**Estimated changes:** ~30 lines in 1 file

---

## Objective
The Market page never loads data because:
1. The single CORS proxy (`api.codetabs.com`) is rate-limited
2. On static GitHub Pages, `fetchAllMarketData()` hits the `isStaticHostRuntime()` early return at line 178, skips all Yahoo Finance calls, tries a non-existent `market_snapshot.json` → 404 → returns empty

Fix BOTH issues: add proxy fallbacks AND make the static host path attempt Yahoo via proxies.

---

## Context
- File: `src/services/indianMarketService.js`
- The proxy list is at **line 7**
- `fetchThroughProxies` (lines 29–40) loops through all proxies
- `fetchAllMarketData` (lines 177–212) has two branches: static host (L178) and non-static (L194)
- **CRITICAL:** On GitHub Pages, the static host branch NEVER calls `fetchIndices()` — it goes straight to snapshot/cache which are empty → market is permanently dead

---

## File: `src/services/indianMarketService.js`

### Change 1 of 2: Replace line 7 — add proxy fallbacks

> ⚠️ **Audit v3 Fix:** Do NOT include `thingproxy.freeboard.io` — it wraps JSON in its own envelope, breaking Yahoo Finance response parsing.

**BEFORE (line 7):**
```javascript
const PROXIES = [(url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`];
```

**AFTER:**
```javascript
const PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];
```

### Change 2 of 2: Fix static host branch to attempt live Yahoo (lines 177–192)

> ⚠️ **Audit v3 Critical Fix:** Without this change, the Market page is PERMANENTLY dead on GitHub Pages regardless of how many proxies you add.

**BEFORE (lines 177–192):**
```javascript
export async function fetchAllMarketData() {
    if (isStaticHostRuntime()) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.fetchedAt || 0);
                if (age < CACHE_TTL) return { ...parsed, isStale: true, staleReason: 'Static host cache' };
            }
        } catch {}
        const snapshot = await fetchStaticSnapshot();
        if (snapshot) {
            return { ...snapshot, isSnapshot: true, fetchedAt: snapshot.generatedAt ? new Date(snapshot.generatedAt).getTime() : Date.now() };
        }
        return { indices: [], mutualFunds: [], ipo: { upcoming: [], live: [], recent: [] }, movers: { gainers: [], losers: [] }, sectorals: [], commodities: [], currencies: [], fiidii: { fii: {}, dii: {}, date: '' }, fetchedAt: Date.now(), generatedAt: new Date().toISOString(), sourceHealth: {}, errors: {} };
    }
```

**AFTER (replace the entire static host block):**
```javascript
export async function fetchAllMarketData() {
    if (isStaticHostRuntime()) {
        // 1. Try cache first
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.fetchedAt || 0);
                if (age < CACHE_TTL) return { ...parsed, isStale: true, staleReason: 'Static host cache' };
            }
        } catch {}

        // 2. Try live Yahoo via CORS proxies (NEW — audit v3 fix)
        try {
            const [indices, mutualFunds, commodities, currencies] = await Promise.allSettled([
                fetchIndices(), fetchMutualFunds(), fetchCommodities(), fetchCurrencyRates()
            ]);
            const result = {
                indices: indices.status === 'fulfilled' ? indices.value : [],
                mutualFunds: mutualFunds.status === 'fulfilled' ? mutualFunds.value : [],
                ipo: { upcoming: [], live: [], recent: [] },
                movers: { gainers: [], losers: [] },
                sectorals: [],
                commodities: commodities.status === 'fulfilled' ? commodities.value : [],
                currencies: currencies.status === 'fulfilled' ? currencies.value : [],
                fiidii: { fii: {}, dii: {}, date: '' },
                fetchedAt: Date.now(),
                generatedAt: new Date().toISOString(),
                sourceHealth: {
                    indices: indices.status === 'fulfilled' && indices.value.length > 0 ? 'live' : 'failed',
                    mutualFunds: mutualFunds.status === 'fulfilled' ? 'live' : 'failed',
                },
                errors: {}
            };
            if (result.indices.length > 0) {
                try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch {}
                return result;
            }
        } catch {}

        // 3. Try static snapshot as last resort
        const snapshot = await fetchStaticSnapshot();
        if (snapshot) {
            return { ...snapshot, isSnapshot: true, fetchedAt: snapshot.generatedAt ? new Date(snapshot.generatedAt).getTime() : Date.now() };
        }

        // 4. Absolute last resort — empty
        return { indices: [], mutualFunds: [], ipo: { upcoming: [], live: [], recent: [] }, movers: { gainers: [], losers: [] }, sectorals: [], commodities: [], currencies: [], fiidii: { fii: {}, dii: {}, date: '' }, fetchedAt: Date.now(), generatedAt: new Date().toISOString(), sourceHealth: {}, errors: { indices: 'All proxies failed on static host' } };
    }
```

---

## Deliverable
- `src/services/indianMarketService.js` — line 7 replaced + static host branch rewritten

---

## QC Checklist

- [ ] Run `npm run dev`, open browser dev tools → Network tab
- [ ] Navigate to Market tab (`/markets`)
- [ ] Within 15 seconds, at least one proxy should return a **200 response**
- [ ] NIFTY 50 value appears on screen (any number)
- [ ] SENSEX value appears on screen
- [ ] No infinite loading spinner (resolves within 20 seconds)
- [ ] Console does NOT show `Failed to fetch` for ALL 3 proxies simultaneously
- [ ] If ALL proxies fail, page shows error message, not blank page
- [ ] **Static host test:** Set `localStorage.setItem('force_static_host', 'true')` in console, refresh → market should still attempt live Yahoo, not just show empty

---

## Do NOT change
- Cache TTL or cache logic internals
- `fetchYahooData()`, `extractYahooPrice()`, `parseYahooSeries()`
- `MarketContext.jsx` or `MarketPage.jsx`
