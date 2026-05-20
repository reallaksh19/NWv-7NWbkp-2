# WI — Agent 09: Market Context — Lazy Loading
**Sequence:** 9 of 10
**Prerequisite:** Agent 02 complete
**Estimated changes:** ~35 lines in 2 files

---

## Objective
Currently `MarketContext` fires a Yahoo Finance API call immediately when the app loads, even if the user is on the Main page. This wastes CORS proxy rate limits and slows startup.

Fix: only fetch market data when the user first navigates to the Market tab.

---

## File 1 of 2: `src/context/MarketContext.jsx`

### Change 1 of 2: Add `booted` state and `ensureBoot` function

> ⚠️ **Audit v3 Fix:** Do NOT change `loading` initial state to `false`. Keep it as `true`. Changing to `false` causes a flash-of-empty-state because `MarketPage` renders error UI when `loading: false` AND `marketData: null`. Instead, use a separate `booted` flag.

**BEFORE (lines 10–14):**
```javascript
export function MarketProvider({ children }) {
    const [marketData, setMarketData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastFetch, setLastFetch] = useState(null);
```

**AFTER:**
```javascript
export function MarketProvider({ children }) {
    const [marketData, setMarketData] = useState(null);
    const [loading, setLoading] = useState(true);  // Keep true — prevents flash-of-empty (audit v3 fix)
    const [error, setError] = useState(null);
    const [lastFetch, setLastFetch] = useState(null);
    const [booted, setBooted] = useState(false);
```

### Change 2 of 2: Remove auto-load useEffect; add `ensureBoot`

**BEFORE (lines 95–101):**
```javascript
    useEffect(() => {
        loadMarketData();
    }, [loadMarketData]);

    const refreshMarket = useCallback(() => {
        return loadMarketData(true);
    }, [loadMarketData]);
```

**AFTER:**
```javascript
    // REMOVED: auto-load on mount — market data now fetched lazily
    const ensureBoot = useCallback(() => {
        if (!booted) {
            setBooted(true);
            loadMarketData();  // loadMarketData already sets loading:true internally
        }
    }, [booted, loadMarketData]);

    const refreshMarket = useCallback(() => {
        return loadMarketData(true);
    }, [loadMarketData]);
```

**BEFORE (context value, lines 103–112):**
```javascript
    return (
        <MarketContext.Provider value={{
            marketData,
            loading,
            error,
            lastFetch,
            refreshMarket
        }}>
```

**AFTER:**
```javascript
    return (
        <MarketContext.Provider value={{
            marketData,
            loading: booted ? loading : true,  // Show spinner until booted (audit v3 fix)
            error,
            lastFetch,
            refreshMarket,
            ensureBoot,
            booted
        }}>
```

---

## File 2 of 2: `src/pages/MarketPage.jsx`

### Change: Call `ensureBoot` when Market page mounts

**Find the useMarket destructuring:**
```javascript
const { marketData, loading, error, refreshMarket, lastFetch } = useMarket();
```

**AFTER:**
```javascript
const { marketData, loading, error, refreshMarket, lastFetch, ensureBoot } = useMarket();
```

**Add useEffect after the destructuring:**
```javascript
useEffect(() => {
    ensureBoot();
}, [ensureBoot]);
```

---

## Deliverable
- `src/context/MarketContext.jsx` — lazy boot with `booted` flag, `ensureBoot` in context
- `src/pages/MarketPage.jsx` — calls `ensureBoot` on mount

---

## QC Checklist

- [ ] Open the app → Main page. No `yahoo.com` or proxy requests in Network tab
- [ ] Click Market tab → proxy requests appear, data loads within 15 seconds
- [ ] **Key test:** NO flash of empty/error state before spinner appears
- [ ] Navigate away and back to Market → uses cached data (no re-fetch within 15 min)
- [ ] `refreshMarket` button still forces a new fetch
- [ ] No console error: `ensureBoot is not a function`

---

## Do NOT change
- Cache TTL (15 minutes)
- Market data parsing or display logic
- `src/services/indianMarketService.js` (that's Agent 02/03)
