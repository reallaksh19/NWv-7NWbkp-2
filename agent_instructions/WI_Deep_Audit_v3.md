# NWv-7 — Deep Independent Audit: Insight, Up Ahead, Market, UI
## Root-Cause Analysis From Page Mount To Network Call

---

## PART 1: INSIGHT — "Can't even fetch 2 stories with 3 angles"

### Full Execution Trace

```
InsightPage.jsx L130
  → runInsightPipeline(slotFetcher, DEFAULT_CONFIG)
    → slotsNeedingFetch(cfg) → returns ["now","minus4h","minus12h","minus24h"]
    → slotFetcher("now")
      → insightFetcher.js L7: fetchStoriesForSlot("now")
        → newsFetcher.js L7: fetchNews('latest news', {newsApiKey: ''})
          → newsService.js L49: fetchDDGNews('latest news')
            → Bing RSS via rss2json (CORS proxy)
            → Returns items with {headline, source, url, time}
          → Falls through to fetchRSSNews → Google News RSS
        ← Returns array of {id:"rss-0", headline:..., summary:"Latest coverage from Google News"}
      → getEmbeddings(texts) — embeddingsAdapter.js
        → Returns 384-dim vectors where vec[0]=text.length/1000, rest is 0
      → extractEntities, extractVerbs, extractNumbers, extractKeywords
      → normalizeStory(raw, slot, cfg, embedding, entities, ...)
    → (Same for minus4h, minus12h, minus24h)
    → mergeSlotStories → removeHardDuplicates → clusterIntoParentEvents → ...
```

### ROOT CAUSE 1: Mock embeddings make ALL stories look identical

[embeddingsAdapter.js](file:///c:/Code3/NWv-7/src/adapters/embeddingsAdapter.js) L3-10:
```javascript
const vec = new Array(384).fill(0);
vec[0] = text.length / 1000;
vec[1] = text.charCodeAt(0) / 255;
```

**Impact chain:**
- `cosineSimilarity` in [dedup.ts L12-22](file:///c:/Code3/NWv-7/src/insight/src/dedup/dedup.ts#L12-L22) compares these vectors
- Two articles with similar text lengths (e.g., both ~200 chars) produce nearly identical vectors: `[0.2, 0.X, 0, 0, 0, ...]`
- Cosine similarity between them ≈ **0.99+** (because 382 out of 384 dimensions are zero, and dimension 0 is nearly identical)
- `HARD_DUP_EMBED_SIM` threshold is **0.985** → almost every story pair passes the duplicate check
- `removeHardDuplicates` at [dedup.ts L105-106](file:///c:/Code3/NWv-7/src/insight/src/dedup/dedup.ts#L105-L116) marks nearly all stories as duplicates
- After dedup, only **1-2 stories survive** per source group — not enough to form a cluster with 3+ children
- `isWeakTree` requires `WEAK_TREE_CHILD_MIN: 3` children → every cluster fails this check
- Pipeline returns **0 parents** → "No Insights Available"

**This is the #1 blocker.** The WI 05 TF-IDF fix is correct in concept but has the cross-slot dimension mismatch issue I documented in the prior audit.

### ROOT CAUSE 2: All 4 slots fetch the SAME query

[newsFetcher.js](file:///c:/Code3/NWv-7/src/adapters/newsFetcher.js) L7:
```javascript
const news = await fetchNews('latest news', { newsApiKey: '' });
```

The `slot` parameter is **completely ignored**. Every slot ("now", "minus4h", "minus12h", "minus24h") fetches `'latest news'`. This means:
- All 4 slots return the same ~10 articles from the same RSS feed
- `mergeSlotStories` combines them → 40 articles, but they're all duplicates
- `removeHardDuplicates` collapses them to ~10
- The snapshot presence data is meaningless (stories appear in all 4 slots, so `persistenceScore` is always maxed)

**WI 05 addresses this** by adding slot-specific queries, but the proposed queries are generic ("world news today", "india news today"). They need to target the user's actual configured news sources from settings.

### ROOT CAUSE 3: ID collisions silently delete stories

[newsService.js L103](file:///c:/Code3/NWv-7/src/services/newsService.js#L103) generates `id: 'rss-${idx}'`. Every slot call produces `rss-0, rss-1, ..., rss-9`. When the pipeline's `storiesById` Map is built in [pipeline.ts L82-84](file:///c:/Code3/NWv-7/src/insight/src/pipeline/pipeline.ts#L82-L84):
```typescript
for (const cluster of clusters) {
    for (const s of cluster.stories) storiesById.set(s.id, s);
}
```
The `minus4h` slot's `rss-0` **overwrites** the `now` slot's `rss-0`. If 10 articles per slot × 4 slots = 40 articles, only 10 unique IDs survive.

### ROOT CAUSE 4: Summary field is hardcoded garbage

[newsService.js L113](file:///c:/Code3/NWv-7/src/services/newsService.js#L113):
```javascript
summary: 'Latest coverage from Google News',
```

This literal string is what `nlpAdapter.js` receives for entity extraction. `extractEntities("Latest coverage from Google News")` finds zero cities, zero orgs, zero verbs, zero numbers. Every story gets:
- `entities: { people: [], orgs: [], places: [], products: [], symbols: [] }`
- `factualDensity: 0`
- `eventVerbs: []`
- `numbers: []`

This means `entityOverlap`, `verbMatch`, `numberFactMatch` all return 0 for every pair in `eventSimilarity`. The only non-zero signal is `embSim` (which is ~0.99 due to mock embeddings) and `timeSim`. So the composite similarity is `0.30 * 0.99 + ... = ~0.30`, which is below `SAME_EVENT_THRESHOLD: 0.88`. **Every story becomes its own cluster**, each with 1 member, all flagged as `weakTree`.

### Corrected WI 05 must address all 4 root causes

| Root Cause | Fix |
|-----------|-----|
| Mock embeddings | Fixed-vocabulary TF-IDF (200 hardcoded news terms) |
| Same query all slots | Slot-specific queries: `"breaking news"`, `"world news"`, `"india top headlines"`, `"business economy"` |
| ID collisions | Prefix IDs with slot: `${slot}-${idx}-${Date.now()}` |
| Empty summaries | Use `article.description` if available, else use `article.headline` as summary text |

---

## PART 2: UP AHEAD — Multiple Failures

### 2A: "Data vanishes between mobile and desktop"

**Root Cause:** The cache is **localStorage-based** ([upAheadService.js L309-321](file:///c:/Code3/NWv-7/src/services/upAheadService.js#L309-L321)):
```javascript
export function loadFromCache() {
    const cached = localStorage.getItem(CACHE_KEY);
```

localStorage is **per-origin AND per-browser**. Your mobile browser's `localStorage` is a completely separate storage from your desktop browser's `localStorage`. They don't share data.

Additionally, the insight pipeline uses an **in-memory `Map`** store ([cacheManager.ts L15](file:///c:/Code3/NWv-7/src/insight/src/cache/cacheManager.ts#L15)):
```typescript
const store = new Map<SnapshotSlot, SnapshotCacheEntry>();
```

This is wiped on every page refresh, tab close, or device switch. There is NO persistence across sessions.

**This is NOT a bug — it's an architectural limitation.** On GitHub Pages (no backend), there is no shared database. Each browser tab is an island.

**Fix:** This is unfixable without a backend or a sync service. The WIs should document this limitation clearly and ensure the page always fetches fresh data on mount rather than relying on stale cache.

### 2B: "Online offers not fetched, movies not found, civic alerts missing"

**Root Cause:** Static host feed pruning kills most feeds.

[feedSourceRegistry.js L174-176](file:///c:/Code3/NWv-7/src/intelligence/feedSourceRegistry.js#L174-L176):
```javascript
if (isStaticHost) {
    sources = sources.filter(s => s.priorityScore >= 3 || s.trust === 'high').slice(0, 2);
}
```

`rankFeedSource` at L155-161:
```javascript
priorityScore: (source.trust === 'high' ? 3 : source.trust === 'medium' ? 2 : 1)
```

Most feeds in the registry have `trust: 'medium'`, giving them `priorityScore: 2`. The filter `>= 3` excludes them. Only `trust: 'high'` feeds survive.

**Category-by-category impact on static host:**

| Category | Feeds Surviving | Why |
|----------|----------------|-----|
| **movies** | 2 of 3 | Hindustan Times RSS feeds are `trust: 'high'`; Google News search is `trust: 'medium'` → pruned |
| **events** | 0 of 3 | ALL are `trust: 'medium'` Google News → **entire section is empty** |
| **shopping** | 0 of 4 | ALL are `trust: 'medium'` → **entire section is empty** |
| **airlines** | 0 of 1 | `trust: 'high'` ✅ → survives BUT `.slice(0, 2)` still allows it |
| **alerts/Chennai** | 2 of 3 | The Hindu RSS and DT Next are high trust; Google News is pruned |
| **civic** | 0 | Not even in the registry (no `civic` key exists) |
| **weather_alerts** | 2 of 3 | Google News queries are `trust: 'high'` ✅ |

**So on GitHub Pages: events = empty, shopping = empty, civic = empty.** This explains why those sections show nothing.

**Fix for WI 10:** Must EITHER:
1. Change ALL Google News search feeds to `trust: 'high'` in the registry
2. OR relax the static host filter: `s.priorityScore >= 2` (includes medium)

### 2C: "Date awareness and location awareness seem poor"

**Root Cause:** Traced to `canonicalItemBuilder.js` → `analyzeDateText()` → `dateAware.js`.

The pipeline passes through `buildCanonicalItem` at [L70-177](file:///c:/Code3/NWv-7/src/intelligence/canonicalItemBuilder.js#L70-L177). The date analysis at L94 calls `analyzeDateText(baseText, ...)`. If the article text doesn't contain explicit date strings ("May 15", "next Friday", "tomorrow"), `dateConfidence` is set to `'none'`.

Then in [eligibilityWindowing.js L49-59](file:///c:/Code3/NWv-7/src/intelligence/eligibilityWindowing.js#L49-L59):
```javascript
if (!eventDate) {
    const possible = item.routeHint === 'upahead_possible' || 
                     (sourceTrust === 'high' && classificationConfidence >= 0.3);
    upAheadEligible: possible,  // Only true if trust is high AND classification > 0.3
```

Items with `dateConfidence: 'none'` + `sourceTrust: 'medium'` (which is most Google News results) get `upAheadEligible: false`. They're dropped.

**So the pipeline requires BOTH a parseable date AND high source trust to show an item in Up Ahead.** Most RSS results from Google News are `trust: 'medium'` with no structured date → they're all dropped as ineligible.

**Fix:** The eligibility check should be more lenient for static hosts. If `classificationConfidence > 0.5` (strong category match), items should be eligible even without an extracted date, using `publishDate` as the fallback `eventDate`.

### 2D: "Deduplication seems poor"

`uniqByKey` in [upAheadService.js L23-33](file:///c:/Code3/NWv-7/src/services/upAheadService.js#L23-L33) uses `getItemKey` which falls back to `item.title`. Two articles with identical titles from different feeds ARE deduped. But articles about the same event with different titles (e.g., "Modi visits France" vs "PM arrives in Paris") are NOT deduped because there's no semantic similarity check — only exact key matching.

**This is a known limitation.** The `deDuplication.js` intelligence module DOES have Jaccard similarity, but it's only used in the dedup step, not in `upAheadService.js`'s `uniqByKey`. **The WIs don't address this gap.**

---

## PART 3: MARKET — "Always dead, never fetches"

### Full Execution Trace

```
App.jsx L92: <MarketProvider>
  → MarketContext.jsx L95-97: useEffect → loadMarketData()
    → indianMarketService.js L177-212: fetchAllMarketData()
      → L178: if (isStaticHostRuntime()) → YES on GitHub Pages
      → L180-186: check localStorage cache → probably empty
      → L187-191: fetchStaticSnapshot() 
        → L149: fetch('/data/market_snapshot.json') → 404 (file doesn't exist)
      → L191: return EMPTY object {indices:[], commodities:[], ...}
```

**The market page dies at line 178.** On static host, `fetchAllMarketData()` doesn't even TRY the Yahoo Finance APIs. It goes straight to static snapshot → fails → returns empty.

Even if it DID try Yahoo (the non-static-host path at L194):
```javascript
const PROXIES = [(url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`];
```

There's **only 1 proxy** (`codetabs`). When it fails (rate limited, CORS blocked, server down), there's no fallback. The market page is dead.

### Why WI 02 + WI 03 are insufficient

WI 02 adds more proxies to the `PROXIES` array. But it doesn't address the **static host early return** at line 178. Even with 5 proxies, the code never reaches them on GitHub Pages because `isStaticHostRuntime()` short-circuits to the snapshot path.

**Critical fix needed:** The static host branch must ALSO attempt Yahoo Finance via CORS proxies as a fallback before returning empty:

```javascript
if (isStaticHostRuntime()) {
    // Try cache first
    // Try static snapshot
    // NEW: If both fail, try live Yahoo via CORS proxies as last resort
    try {
        const indices = await fetchIndices();
        if (indices.length > 0) {
            const result = { indices, /* other empty sections */ };
            localStorage.setItem(CACHE_KEY, JSON.stringify(result));
            return result;
        }
    } catch {}
    // Return empty as absolute last resort
    return { indices: [], ... };
}
```

---

## PART 4: SETTINGS CONFUSION

### "Either completely link with main page or show only in Up Ahead"

[UpAheadPage.jsx L108-111](file:///c:/Code3/NWv-7/src/pages/UpAheadPage.jsx#L108-L111):
```javascript
const upAheadSettings = settings.upAhead || {
    categories: { movies: true, events: true, ... },
    locations: ['Chennai']
};
```

`settings.upAhead` comes from `DEFAULT_UPAHEAD_SETTINGS` imported in [storage.js L5](file:///c:/Code3/NWv-7/src/utils/storage.js#L5). This is a **separate settings subtree** from `settings.newsSources` (the main page sources).

But the Settings page likely shows both in the same UI, making it confusing which controls what. There are TWO independent location lists:
- `settings.weather.cities` — used by Weather
- `settings.upAhead.locations` — used by Up Ahead
- `settings.sections.chennai.enabled` — used by Main page

**The user sees "Chennai" configured in 3 different places** and doesn't know which one affects Up Ahead.

**Fix for WI:** The Up Ahead settings section should be self-contained in the Settings page with its own header: "Up Ahead Categories & Locations". It should NOT reference or depend on the main page's `newsSources` or `sections` settings.

---

## PART 5: UI WIs — "Very brief, is it OK?"

### Agent 07 (News Cards) — Risk Assessment

The WI asks the agent to:
1. Append ~80 lines of CSS to `index.css`
2. Replace a 16-line JSX block in `NewsSection.jsx` with a 15-line block

**This is manageable** for a low-skill agent because:
- The CSS is purely additive (no existing styles are modified)
- The JSX change is a clean block replacement with clear BEFORE/AFTER markers

**But there's a hidden risk:** The WI references `.mnc-header`, `.mnc-source` etc. These classes may already exist in `index.css` from the current implementation. Appending new definitions will override via cascade order, which is intentional but should be explicitly stated.

### Agent 08 (Mobile Shell) — Risk Assessment

The WI adds ~90 lines of CSS and changes one className. **This is safe** for a low-skill agent.

**However**, the WI is missing the BottomNav fix: the `position: fixed` nav will escape the 480px shell. This needs:
```css
.bottom-nav { max-width: 480px; left: 50%; transform: translateX(-50%); }
```

### Overall: UI WIs are adequately scoped for agents

The line counts are within the 200-line limit and the changes are primarily additive CSS. The risk is low. The main gap is missing the BottomNav constraint in Agent 08.

---

## SUMMARY: Priority-Ordered Fix List

| Priority | Module | Root Cause | Fix |
|----------|--------|-----------|-----|
| 🔴 P0 | Market | Static host early-return skips Yahoo entirely | Remove early return; try CORS proxies on static host |
| 🔴 P0 | Market | Only 1 proxy (codetabs) | Add allorigins + corsproxy.io (WI 02) |
| 🔴 P0 | Insight | Mock embeddings → all stories deduplicated as identical | Fixed-vocab TF-IDF (WI 05, with cross-slot fix) |
| 🔴 P0 | Insight | All slots fetch same query "latest news" | Slot-specific queries (WI 05) |
| 🔴 P0 | Insight | Summaries are hardcoded text | Extract from RSS description |
| 🟡 P1 | Up Ahead | Static host prunes ALL medium-trust feeds | Change trust to 'high' or relax filter |
| 🟡 P1 | Up Ahead | Items without dates dropped even if well-classified | Use publishDate as fallback eventDate |
| 🟡 P1 | Insight | Story IDs collide across slots | Prefix with slot name |
| 🟡 P2 | Up Ahead | Data not shared across devices | Document as limitation (no fix without backend) |
| 🟡 P2 | Settings | Up Ahead locations confused with main page | Self-contained settings section |
| 🟢 P3 | UI | BottomNav escapes 480px shell | Add max-width constraint |

---

## Do you want me to rewrite the affected WIs with these corrections?

The WIs that need substantial rewriting are:
1. **WI 02** — Must also modify the static-host early-return branch
2. **WI 05** — Needs fixed-vocabulary TF-IDF + ID fix + summary extraction fix
3. **WI 10** — Must update trust levels or relax the static-host filter
4. **NEW WI** — Up Ahead eligibility relaxation for dateless items on static host
