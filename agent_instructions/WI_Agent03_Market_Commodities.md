# WI — Agent 03: Market — Commodities & Currency Fallback
**Sequence:** 3 of 10
**Prerequisite:** Agent 02 complete (proxy fallbacks must work first)
**Estimated changes:** ~70 lines in 1 file

---

## Objective
The Commodities and Currency sections on the Market page are always empty because they only read from a pre-generated static JSON file (`/data/market_snapshot.json`) that doesn't exist on GitHub Pages. Add Yahoo Finance fallback fetching so these sections populate from live data.

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

## Deliverable
- `src/services/indianMarketService.js` — two functions replaced (`fetchCommodities` and `fetchCurrencyRates`)

---

## QC Checklist

- [ ] Navigate to Market tab (`/markets`)
- [ ] Scroll to **Commodities** section — should show Gold, Silver, Crude Oil with prices
- [ ] Each commodity shows: name, unit, price (like `$2341.50`), and green/red percentage change
- [ ] Scroll to **Currency Rates** section — should show USD/INR, EUR/INR, GBP/INR
- [ ] Each currency shows: pair name, value in ₹, and change %
- [ ] If Yahoo Finance fails (all proxies fail), sections show the `"snapshot unavailable"` empty message — NOT a JavaScript error
- [ ] No new console errors (TypeError, undefined, etc.)

---

## Do NOT change
- `fetchStaticSnapshot()` — keep as is
- `fetchFIIDII()` — leave as is (FII/DII requires server data, show empty gracefully)
- Any other functions in the file
- Any other files
