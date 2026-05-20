# WAVE 2 — Agent 02: Market Proxy Resilience + Sentiment Overlay
> **Prerequisite:** Wave 1 (Agent 01) must be complete and verified.

# Role
You are a Senior Data Pipeline & Network Resiliency Engineer.

# Context
You are working on NWv-7, a React-based news application that runs entirely on static GitHub Pages. Because there is no backend, all external API calls (like Yahoo Finance) must go through client-side CORS proxies. The existing `src/services/proxyManager.js` has a robust ProxyManager class with cooldowns and caching, but only supports 2 proxies and only handles RSS/XML responses. Yahoo Finance returns JSON.

# Mission
Your task is to implement the exact changes outlined in the Work Instruction (WI) below. You will:
1. Extend the **existing** `proxyManager.js` with a 5-proxy pool and a new `fetchJsonViaProxy` method (with Circuit Breaker + EMA latency sorting + Exponential Backoff)
2. Replace the duplicate proxy logic in `indianMarketService.js` with a thin wrapper around `proxyManager`
3. Fix the static host branch of `fetchAllMarketData()` to attempt live fetches
4. Add a `computeSentiment` helper

# Execution Guidelines
1. **Architecture Rule:** `src/services/proxyManager.js` is the SINGLE proxy system for the entire app. Do NOT create a second proxy array in indianMarketService.js. Delete the existing local PROXIES array and fetchThroughProxies function, and replace with a one-line wrapper.
2. **Static Host Awareness:** The `isStaticHostRuntime()` branch must attempt live Yahoo fetches via proxies, NOT just return empty/cached data.
3. **Do NOT include `thingproxy.freeboard.io`** — it wraps JSON in its own envelope, breaking Yahoo Finance response parsing.
4. **Verification:** Use the QC Checklist in the WI to verify. 100% compliance required.

# Critical Rules
- Search by function/variable name, NEVER by line number
- Do NOT delete any test files (*.test.js, *.spec.js)
- Do NOT modify `parseXML()` or `fetchViaProxy()` in proxyManager.js — only ADD the new `fetchJsonViaProxy` method

---

# Work Instruction

# WI — Agent 02: Market — Proxy Resilience + Sentiment Overlay
**Sequence:** 2 of 10
**Prerequisite:** Agent 01 complete
**Estimated changes:** ~80 lines across 2 files

---

## Objective
1. Extend the **existing** `src/services/proxyManager.js` with Yahoo Finance JSON support, a 5-proxy pool, Circuit Breaker, EMA latency sorting, and Exponential Backoff — rather than duplicating logic inside `indianMarketService.js`
2. Replace the single-proxy `fetchThroughProxies` function in `indianMarketService.js` with a call to the shared `proxyManager`
3. Fix the static host branch of `fetchAllMarketData()` to attempt live Yahoo data via proxies
4. Add a `computeSentiment` export for Bullish/Bearish/Neutral overlay on commodity/currency rows

> ⚠️ **Architecture rule:** `src/services/proxyManager.js` is the SINGLE source of proxy logic for the entire app. Do NOT create a second proxy system. The Indian market service must import and use `proxyManager`.

---

## File 1 of 3: `src/services/proxyManager.js`

### Change 1 of 2: Expand the PROXIES array to 5 entries + add JSON mode

Find the `const PROXIES = [` array (search by that text — do not use line number).

**Replace the entire PROXIES array** with:
```javascript
const PROXIES = [
    {
        name: 'allorigins',
        format: (feedUrl, raw = false) =>
            raw
                ? `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`
                : `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`,
        parse: async (response, raw = false) => {
            if (raw) {
                const text = await response.text();
                if (!text) throw new Error('Empty response from allorigins');
                return parseXML(text);
            }
            const data = await response.json();
            if (!data?.contents) throw new Error('allorigins: no contents');
            return parseXML(data.contents);
        }
    },
    {
        name: 'corsproxy',
        format: (feedUrl) => `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
        parse: async (response) => {
            const text = await response.text();
            if (!text) throw new Error('Empty response from corsproxy');
            return parseXML(text);
        }
    },
    {
        name: 'codetabs',
        format: (feedUrl) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(feedUrl)}`,
        parse: async (response) => {
            const text = await response.text();
            if (!text) throw new Error('Empty response from codetabs');
            return parseXML(text);
        }
    },
    {
        name: 'crossorigin',
        format: (feedUrl) => `https://crossorigin.me/${feedUrl}`,
        parse: async (response) => {
            const text = await response.text();
            if (!text) throw new Error('Empty response from crossorigin');
            return parseXML(text);
        }
    },
    {
        name: 'rss2json',
        format: (feedUrl) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`,
        parse: async (response) => {
            const data = await response.json();
            if (data.status === 'ok') {
                return { title: data.feed?.title, items: data.items || [] };
            }
            throw new Error('rss2json status not ok');
        }
    }
];
```

> ⚠️ Do NOT include `thingproxy.freeboard.io` — it wraps JSON in its own envelope, breaking Yahoo Finance response parsing.

### Change 2 of 2: Add `fetchJsonViaProxy` method to the `ProxyManager` class

Find the closing brace of the `ProxyManager` class (the line before `export const proxyManager`). Insert this new method **before** the closing brace:

```javascript
    /**
     * Fetch a JSON endpoint (e.g. Yahoo Finance) via CORS proxy with Circuit Breaker + EMA.
     * Unlike fetchViaProxy, this returns the raw parsed JSON (not an RSS object).
     * @param {string} url  The target JSON URL (will be proxy-wrapped)
     * @returns {Promise<Object>} Parsed JSON response
     */
    async fetchJsonViaProxy(url) {
        // EMA-sorted proxy indices, circuit-open proxies excluded
        const indices = PROXIES
            .map((_, i) => i)
            .filter(i => {
                const until = this.cooldownUntil.get(PROXIES[i].name) || 0;
                return until <= Date.now();
            })
            .sort((a, b) => {
                const emaA = this._ema?.get(PROXIES[a].name) || 500;
                const emaB = this._ema?.get(PROXIES[b].name) || 500;
                return emaA - emaB;
            });

        if (!this._ema) this._ema = new Map();
        if (indices.length === 0) throw new Error('All proxies circuit-open');

        const MAX_RETRIES = 2;

        for (const i of indices) {
            const proxy = PROXIES[i];
            const proxyUrl = proxy.format(url, /* raw= */ true);

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                const t0 = Date.now();
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 8000);
                try {
                    const res = await fetch(proxyUrl, {
                        signal: controller.signal,
                        cache: 'no-store'
                    });
                    clearTimeout(tid);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const text = await res.text();
                    const json = JSON.parse(text);
                    // Record EMA latency on success
                    const latency = Date.now() - t0;
                    const alpha = 0.3;
                    const prev = this._ema.get(proxy.name) || 500;
                    this._ema.set(proxy.name, alpha * latency + (1 - alpha) * prev);
                    this.failureCounts.set(proxy.name, 0);
                    this.cooldownUntil.delete(proxy.name);
                    return json;
                } catch (err) {
                    clearTimeout(tid);
                    const isTransient = /429|503|rate/i.test(err.message || '');
                    if (isTransient && attempt < MAX_RETRIES) {
                        // Exponential backoff: 500ms → 1000ms → 2000ms
                        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
                        continue;
                    }
                    // Increment failure, set cooldown
                    const failures = (this.failureCounts.get(proxy.name) || 0) + 1;
                    this.failureCounts.set(proxy.name, failures);
                    if (failures >= 3) {
                        this.cooldownUntil.set(proxy.name, Date.now() + 5 * 60_000);
                    }
                    break; // try next proxy
                }
            }
        }
        throw new Error('fetchJsonViaProxy: all proxies failed');
    }
```

---

## File 2 of 3: `src/services/indianMarketService.js`

### Change 1 of 3: Replace PROXIES array + fetchThroughProxies with proxyManager

At the top of `indianMarketService.js`, **add** this import (if not already present):
```javascript
import { proxyManager } from './proxyManager.js';
```

Find the `const PROXIES = [` array in `indianMarketService.js`. **Delete the entire PROXIES array** and the `fetchThroughProxies` function that follows it.

**Replace both** with a single thin wrapper:
```javascript
// Delegates to the shared proxyManager — single source of proxy logic for the app
async function fetchThroughProxies(url) {
    return proxyManager.fetchJsonViaProxy(url);
}
```

> This ensures all proxy resilience (circuit breaker, EMA sort, backoff) is in one place.

### Change 2 of 3: Fix static host branch in `fetchAllMarketData`

Find the function `fetchAllMarketData` (search by function name, not line number). Find the `isStaticHostRuntime()` branch inside it.

**Replace the entire static host branch** (the `if (isStaticHostRuntime())` block) with:
```javascript
export async function fetchAllMarketData() {
    if (isStaticHostRuntime()) {
        // 1. Try IndexedDB cache first (Agent 09 will wire this — graceful no-op until then)
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.fetchedAt || 0);
                if (age < CACHE_TTL) return { ...parsed, isStale: true, staleReason: 'Static host cache' };
            }
        } catch {}

        // 2. Try live Yahoo via CORS proxies (critical — static host is NOT a dead end)
        try {
            const [indices, mutualFunds, commodities, currencies, ipo] =
                await Promise.allSettled([
                    fetchIndices(),
                    fetchMutualFunds(),
                    fetchCommodities(),
                    fetchCurrencyRates(),
                    fetchIPOData(),
                ]);
            const result = {
                indices      : indices.status      === 'fulfilled' ? indices.value      : [],
                mutualFunds  : mutualFunds.status  === 'fulfilled' ? mutualFunds.value  : [],
                commodities  : commodities.status  === 'fulfilled' ? commodities.value  : [],
                currencies   : currencies.status   === 'fulfilled' ? currencies.value   : [],
                ipo          : ipo.status           === 'fulfilled' ? ipo.value          : { upcoming: [], live: [], recent: [] },
                movers       : { gainers: [], losers: [] },
                sectorals    : [],
                fiidii       : { fii: {}, dii: {}, date: '' },
                fetchedAt    : Date.now(),
                generatedAt  : new Date().toISOString(),
                sourceHealth : {
                    indices     : indices.status === 'fulfilled' && indices.value?.length > 0 ? 'live' : 'failed',
                    commodities : commodities.status === 'fulfilled' ? 'live' : 'failed',
                },
                errors: {}
            };
            if (result.indices.length > 0 || result.commodities.length > 0) {
                try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch {}
                return result;
            }
        } catch {}

        // 3. Static snapshot fallback
        const snapshot = await fetchStaticSnapshot();
        if (snapshot) {
            return { ...snapshot, isSnapshot: true,
                fetchedAt: snapshot.generatedAt ? new Date(snapshot.generatedAt).getTime() : Date.now() };
        }

        // 4. Absolute last resort — typed empty shape (never crash the UI)
        return {
            indices: [], mutualFunds: [], ipo: { upcoming: [], live: [], recent: [] },
            movers: { gainers: [], losers: [] }, sectorals: [], commodities: [], currencies: [],
            fiidii: { fii: {}, dii: {}, date: '' }, fetchedAt: Date.now(),
            generatedAt: new Date().toISOString(), sourceHealth: {}, errors: { all: 'All sources failed on static host' }
        };
    }
    // Non-static host path continues below unchanged...
```

> ⚠️ Do NOT touch the non-static host branch below this block.

### Change 3 of 3: Add `computeSentiment` export

Add this function at the **end** of `indianMarketService.js`, before the final line of the file:

```javascript
/**
 * computeSentiment — keyword-based Bullish/Bearish/Neutral score.
 * @param {string}   assetName  e.g. 'Gold', 'Crude Oil', 'USD/INR'
 * @param {string[]} headlines  Recent news headlines to scan
 * @returns {{ label: 'Bullish'|'Bearish'|'Neutral', score: number }}
 */
export function computeSentiment(assetName, headlines = []) {
    const BULLISH = ['rally', 'surge', 'gain', 'rise', 'jump', 'soar', 'record',
                     'high', 'positive', 'buy', 'upside', 'boom', 'breakout', 'recover'];
    const BEARISH = ['fall', 'drop', 'crash', 'decline', 'plunge', 'slump', 'low',
                     'sell', 'downside', 'bear', 'weak', 'loss', 'correction', 'pressure', 'fear'];
    const kw = assetName.toLowerCase();
    let score = 0;
    for (const h of headlines) {
        const t = h.toLowerCase();
        if (!t.includes(kw)) continue;
        for (const w of BULLISH) if (t.includes(w)) score++;
        for (const w of BEARISH) if (t.includes(w)) score--;
    }
    return { label: score > 0 ? 'Bullish' : score < 0 ? 'Bearish' : 'Neutral', score };
}
```

---

## File 3 of 3: `src/index.css`

Add at the very end of the file (search for end-of-file — do not overwrite existing content):
```css
/* ── Sentiment Badges ── */
.sentiment-badge {
    font-size: 0.65rem; font-weight: 700; padding: 2px 6px;
    border-radius: 999px; letter-spacing: 0.04em; display: inline-block;
}
.sentiment-bullish { background: rgba(34,197,94,0.15);   color: #22c55e; }
.sentiment-bearish  { background: rgba(239,68,68,0.15);  color: #ef4444; }
.sentiment-neutral  { background: rgba(148,163,184,0.15); color: #94a3b8; }
```

**In `MarketPage.jsx`** — for each commodity/currency row, import and use:
```javascript
import { computeSentiment } from '../services/indianMarketService';
// In render, for each item:
const { label } = computeSentiment(item.name, cachedHeadlines || []);
// <span className={`sentiment-badge sentiment-${label.toLowerCase()}`}>{label}</span>
```

---

## Deliverable
- `src/services/proxyManager.js` — 5-proxy pool + `fetchJsonViaProxy` method with Circuit Breaker, EMA, backoff
- `src/services/indianMarketService.js` — import `proxyManager`; remove local PROXIES/fetchThroughProxies; static host branch rewritten; `computeSentiment` added
- `src/index.css` — sentiment badge CSS appended

---

## QC Checklist

- [ ] `npm run dev` — no console errors on startup
- [ ] Market tab — at least one proxy returns 200 within 15 seconds
- [ ] NIFTY 50 and SENSEX values visible
- [ ] Commodities: Gold, Silver, Crude Oil with prices
- [ ] Currencies: USD/INR, EUR/INR, GBP/INR with values
- [ ] No `Failed to fetch` for ALL 5 proxies simultaneously
- [ ] **Static host test:** `localStorage.setItem('force_static_host', 'true')`, refresh — Market still attempts live Yahoo (check Network tab)
- [ ] **Proxy health:** `proxyManager.getProxyHealth()` in console — shows 5 entries
- [ ] **JSON proxy test:** `proxyManager.fetchJsonViaProxy('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d')` — returns Yahoo JSON object
- [ ] **Circuit breaker:** After forcing a proxy failure 3 times, `proxyManager.cooldownUntil` shows a future timestamp for that proxy
- [ ] **Sentiment badge:** Gold, Crude Oil, USD/INR rows show a Bullish/Bearish/Neutral pill
- [ ] No duplicate `import { proxyManager }` lines in `indianMarketService.js`

---

## Do NOT change
- `parseXML()` function in `proxyManager.js`
- `fetchViaProxy()` method — keep intact (used by RSS feeds)
- Cache TTL constants in `indianMarketService.js`
- `fetchYahooData()`, `extractYahooPrice()`, `parseYahooSeries()` — these call `fetchThroughProxies` which now delegates to proxyManager
- `MarketContext.jsx` — scope is Agent 09

## Rollback
If QC fails: `git checkout -- src/services/proxyManager.js src/services/indianMarketService.js src/index.css`
