# WAVE 3 — Agent 03: Market — Commodities, Currency, IPO, NFO & Stock Categories
> **Prerequisite:** Agent 02 (Wave 2) must be complete — proxy fallbacks must work first.

# Role
You are a Senior Financial Data Integration Engineer.

# Context
You are working on NWv-7, a React-based news application on static GitHub Pages. The Market page has 5 empty sections: Commodities, Currencies, IPO (missing GMP/subscription data), NFO Watchlist (missing entirely), and Stock Categories (missing entirely). Agent 02 has already upgraded the proxy infrastructure.

# Mission
Implement the exact changes outlined in the WI below. **CRITICAL:** You MUST patch the `fetchAllMarketData()` orchestrator in BOTH static and non-static branches.

# Critical Rules
- **Proxy Path Distinction:** Commodities/Currencies/StockCategories use `fetchThroughProxies()` (JSON via Yahoo). IPO/NFO use `proxyManager.fetchViaProxy()` (XML via RSS). Do NOT mix them up.
- Search by function name, NEVER by line number
- Do NOT delete any test files

---

# Work Instruction

[The full WI content is below]

# WI — Agent 03: Market — Commodities, Currency, IPO, NFO & Stock Categories
**Sequence:** 3 of 10
**Prerequisite:** Agent 02 complete (proxy fallbacks must work first)
**Estimated changes:** ~160 lines in 2 files

---

## Objective
The Commodities and Currency sections are always empty (no live fallback). Additionally, IPO tracking lacks GMP/subscription data, and the NFO Watchlist and Stock Categories sections are entirely missing.

Fix all four data gaps in `indianMarketService.js` **and** patch the `fetchAllMarketData` orchestrator so the static host branch calls every new function.

---

## Context
- File: `src/services/indianMarketService.js`
- `fetchCommodities()` is at **lines 151–155** — currently returns `[]` when snapshot missing
- `fetchCurrencyRates()` is at **lines 157–161** — same problem
- `fetchYahooData()` (line 42) and `extractYahooPrice()` (line 60) already work — just need to call them for commodity/FX symbols
- Yahoo Finance commodity symbols: Gold=`GC=F`, Silver=`SI=F`, Crude=`CL=F`
- Yahoo Finance FX symbols: USD/INR=`USDINR=X`, EUR/INR=`EURINR=X`, GBP/INR=`GBPINR=X`

---

## File: `src/services/indianMarketService.js`

### Change 1 of 2: Replace `fetchCommodities()` (lines 151–155)

**BEFORE:**
```javascript
export async function fetchCommodities() {
    const snapshot = await fetchStaticSnapshot();
    if (snapshot?.commodities?.length) return snapshot.commodities;
    return [];
}
```

**AFTER (replace entirely):**
```javascript
export async function fetchCommodities() {
    const snapshot = await fetchStaticSnapshot();
    if (snapshot?.commodities?.length) return snapshot.commodities;

    // Fallback: fetch from Yahoo Finance via CORS proxy
    const COMMODITY_SYMBOLS = [
        { symbol: 'GC=F',  name: 'Gold',      unit: '$/oz' },
        { symbol: 'SI=F',  name: 'Silver',     unit: '$/oz' },
        { symbol: 'CL=F',  name: 'Crude Oil',  unit: '$/bbl' },
    ];
    const results = await Promise.allSettled(
        COMMODITY_SYMBOLS.map(async (c) => {
            const data = await fetchYahooData(c.symbol, { range: '5d', interval: '1d' });
            const price = extractYahooPrice(data);
            if (!price) return null;
            return {
                name: c.name,
                unit: c.unit,
                value: `$${price.price.toFixed(2)}`,
                changePercent: price.changePercent,
                direction: price.change >= 0 ? 'up' : 'down',
                source: 'yahoo'
            };
        })
    );
    return results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
}
```

---

### Change 2 of 2: Replace `fetchCurrencyRates()` (lines 157–161)

**BEFORE:**
```javascript
export async function fetchCurrencyRates() {
    const snapshot = await fetchStaticSnapshot();
    if (snapshot?.currencies?.length) return snapshot.currencies;
    return [];
}
```

**AFTER (replace entirely):**
```javascript
export async function fetchCurrencyRates() {
    const snapshot = await fetchStaticSnapshot();
    if (snapshot?.currencies?.length) return snapshot.currencies;

    // Fallback: fetch INR pairs from Yahoo Finance via CORS proxy
    const FX_SYMBOLS = [
        { symbol: 'USDINR=X', name: 'USD/INR' },
        { symbol: 'EURINR=X', name: 'EUR/INR' },
        { symbol: 'GBPINR=X', name: 'GBP/INR' },
    ];
    const results = await Promise.allSettled(
        FX_SYMBOLS.map(async (fx) => {
            const data = await fetchYahooData(fx.symbol, { range: '5d', interval: '1d' });
            const price = extractYahooPrice(data);
            if (!price) return null;
            return {
                name: fx.name,
                value: `₹${price.price.toFixed(2)}`,
                changePercent: price.changePercent,
                direction: price.change >= 0 ? 'up' : 'down',
                source: 'yahoo'
            };
        })
    );
    return results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
}
```

---

### Change 3 of 5: Enhanced `fetchIPOData()` with GMP + Subscription Parsing

> ⚠️ **Known failure mode:** A previous agent added UI fields for GMP/subscriptions but forgot to add the parsing logic here. Both the fetch function AND the UI must be updated.

> ⚠️ **Proxy path note:** IPO and NFO functions fetch **RSS XML** (Google News RSS), NOT JSON. You must use `proxyManager.fetchViaProxy(rssUrl)` — the XML-capable path — NOT `fetchThroughProxies()` which delegates to `fetchJsonViaProxy` (JSON-only). Import at the top of `indianMarketService.js` if not already present:
> ```javascript
> import { proxyManager } from './proxyManager.js';
> ```

**AFTER (replace `fetchIPOData` entirely):**
```javascript
export async function fetchIPOData() {
  // Try static snapshot first
  const snapshot = await fetchStaticSnapshot();
  if (snapshot?.ipo?.upcoming?.length || snapshot?.ipo?.live?.length) {
    return snapshot.ipo;
  }

  // Fallback: Google News RSS for IPO headlines
  // NOTE: Use proxyManager.fetchViaProxy (XML path), NOT fetchThroughProxies (JSON path)
  try {
    const rssUrl  = 'https://news.google.com/rss/search?q=India+IPO+GMP+subscription+2025&hl=en-IN&gl=IN&ceid=IN:en';
    const rssResult = await proxyManager.fetchViaProxy(rssUrl);
    const items   = (rssResult?.items || []).slice(0, 10);
    // rssResult.items is already parsed by proxyManager.fetchViaProxy — no XML re-parse needed

    const parseGMP = (title = '') => {
      // Extract GMP pattern: e.g. "GMP ₹45" or "GMP +45"
      const m = title.match(/GMP[:\s]+[₹+]?([\d.]+)/i);
      return m ? `₹${m[1]}` : null;
    };

    const parseSub = (title = '') => {
      // Extract subscription: e.g. "subscribed 12.5x" or "12.5 times"
      const m = title.match(/([\d.]+)\s*[xX×]|([\d.]+)\s*times/i);
      return m ? `${m[1] || m[2]}x subscribed` : null;
    };

    const upcoming = items
      .filter(i => /open|upcoming|launch/i.test(i.title || ''))
      .map(i => ({
        name         : (i.title || '').trim(),
        gmp          : parseGMP(i.title),
        subscription : parseSub(i.title),
        date         : i.pubDate || '',
        url          : i.link || '',
      }));

    const live = items
      .filter(i => /live|close|allotment/i.test(i.title || ''))
      .map(i => ({
        name         : (i.title || '').trim(),
        gmp          : parseGMP(i.title),
        subscription : parseSub(i.title),
        date         : i.pubDate || '',
        url          : i.link || '',
      }));

    return { upcoming, live, recent: [] };
  } catch {
    return { upcoming: [], live: [], recent: [] };
  }
}
```

> **UI note (`IPOCard.jsx`):** Render `gmp` and `subscription` fields if non-null. Add them near the IPO name:
> ```jsx
> {item.gmp && <span className="ipo-badge ipo-gmp">{item.gmp} GMP</span>}
> {item.subscription && <span className="ipo-badge ipo-sub">{item.subscription}</span>}
> ```

---

### Change 4 of 5: New `fetchNFOData()` function

> ✅ **Static-safe:** RSS-based via CORS proxy. No external API.

Add after `fetchIPOData`:
```javascript
/**
 * fetchNFOData — New Fund Offers from Google News RSS.
 * Returns array of { name, fundHouse, openDate, closeDate, category, url }
 * NOTE: Uses proxyManager.fetchViaProxy (XML path), NOT fetchThroughProxies (JSON path)
 */
export async function fetchNFOData() {
  const snapshot = await fetchStaticSnapshot();
  if (snapshot?.nfo?.length) return snapshot.nfo;

  try {
    const rssUrl = 'https://news.google.com/rss/search?q=NFO+new+fund+offer+mutual+fund+India+2025&hl=en-IN&gl=IN&ceid=IN:en';
    const rssResult = await proxyManager.fetchViaProxy(rssUrl);
    const items  = (rssResult?.items || []).slice(0, 8);
    return items.map(i => ({
      name      : (i.title || '').trim(),
      fundHouse : null,   // enrichable from title parsing if needed
      openDate  : i.pubDate || '',
      closeDate : null,
      category  : /equity/i.test(i.title || '') ? 'Equity' : 'Debt',
      url       : i.link || '',
    }));
  } catch {
    return [];
  }
}
```

---

### Change 5 of 5: New `fetchStockCategories()` function

> ✅ **Static-safe:** Uses Yahoo Finance via CORS proxy. No server needed.

Add after `fetchNFOData`:
```javascript
/**
 * fetchStockCategories — 52-week highs/lows for major indices.
 * Returns { highs: [...], lows: [...] }
 */
export async function fetchStockCategories() {
  const snapshot = await fetchStaticSnapshot();
  if (snapshot?.stockCategories) return snapshot.stockCategories;

  // Fetch 52-week data for top indices as a proxy for market themes
  const SYMBOLS = [
    { symbol: '%5ENSEI',  name: 'NIFTY 50' },
    { symbol: '%5EBSESN', name: 'SENSEX' },
    { symbol: '%5ENSEBANK', name: 'BANK NIFTY' },
  ];
  const results = await Promise.allSettled(
    SYMBOLS.map(async ({ symbol, name }) => {
      const data  = await fetchYahooData(symbol, { range: '1y', interval: '1mo' });
      const meta  = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      return {
        name,
        high52w : meta.fiftyTwoWeekHigh?.toFixed(2) || null,
        low52w  : meta.fiftyTwoWeekLow?.toFixed(2)  || null,
        current : meta.regularMarketPrice?.toFixed(2) || null,
        nearHigh: meta.regularMarketPrice >= meta.fiftyTwoWeekHigh * 0.97,
        nearLow : meta.regularMarketPrice <= meta.fiftyTwoWeekLow  * 1.03,
      };
    })
  );
  const valid = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  return {
    highs: valid.filter(v => v.nearHigh),
    lows : valid.filter(v => v.nearLow),
    all  : valid,
  };
}
```

---

### ⚠️ CRITICAL — Patch `fetchAllMarketData()` orchestrator (static host branch)

> **This is the #1 failure mode.** A previous agent added new fetch functions but forgot to call them in the `fetchAllMarketData` static host branch. On GitHub Pages, the orchestrator short-circuits to the cache/snapshot before any new functions are ever called — making all additions permanently dead code.

**You MUST add calls to `fetchNFOData` and `fetchStockCategories` inside the `fetchAllMarketData` static host `Promise.allSettled` block** (the one already patched by Agent 02):

```javascript
// Inside the static host branch of fetchAllMarketData (already has indices, mutualFunds, commodities, currencies)
// ADD nfo and stockCategories to the same allSettled call:
const [indices, mutualFunds, commodities, currencies, ipo, nfo, stockCategories] =
  await Promise.allSettled([
    fetchIndices(),
    fetchMutualFunds(),
    fetchCommodities(),
    fetchCurrencyRates(),
    fetchIPOData(),
    fetchNFOData(),          // ← NEW
    fetchStockCategories(),  // ← NEW
  ]);

// Add to the result object:
nfo             : nfo.status === 'fulfilled'             ? nfo.value             : [],
stockCategories : stockCategories.status === 'fulfilled' ? stockCategories.value : { highs: [], lows: [], all: [] },
```

> Also patch the non-static host branch (`fetchAllMarketData` bottom half) the same way so both paths are consistent.

---

## Deliverable
- `src/services/indianMarketService.js` — `fetchCommodities`, `fetchCurrencyRates` replaced; `fetchIPOData` rewritten with GMP/subscription parsing; `fetchNFOData`, `fetchStockCategories` added; `fetchAllMarketData` orchestrator patched in BOTH branches
- `src/pages/IPOCard.jsx` (or equivalent) — GMP and subscription badges added to IPO item render

---

## QC Checklist

- [ ] Navigate to Market tab (`/markets`)
- [ ] **Commodities** — Gold, Silver, Crude Oil show prices and change %
- [ ] **Currency** — USD/INR, EUR/INR, GBP/INR show values in ₹
- [ ] **IPO** — upcoming/live IPOs listed; at least one shows a GMP badge (e.g. ₹45)
- [ ] **IPO** — at least one shows a subscription badge (e.g. 12x subscribed)
- [ ] **NFO Watchlist** — shows actual NFO items, NOT "No active New Fund Offers available"
- [ ] **Stock Categories / Market Themes** — shows data, NOT "Category data unavailable"
- [ ] On GitHub Pages (static host), all sections above are populated — NOT empty
- [ ] No JavaScript errors (TypeError, undefined, null reference)
- [ ] **Static host orchestrator test:** Add `console.log('[Agent03] fetchAllMarketData resolved')` inside the result object assembly — confirm it appears in console on GitHub Pages

---

## Do NOT change
- `fetchStaticSnapshot()` — keep as is
- `fetchFIIDII()` — leave as is (FII/DII requires server data, show empty gracefully)
- `fetchYahooData()`, `extractYahooPrice()`, `parseYahooSeries()` — do not modify
- Any other files not listed in Deliverable
- **❌ DO NOT delete any test files (`*.test.js`, `*.spec.js`, benchmark files) — this is explicitly forbidden**

## Rollback
If QC fails: `git checkout -- src/services/indianMarketService.js`
