# NWv-7 — Deep Source-Level WI Audit v2
## Independent Architectural Review Against Live Codebase

> [!CAUTION]
> This audit traces **actual execution paths** through the codebase to identify where the proposed WI changes will break, produce silent failures, or introduce regressions **specifically on a static GitHub Pages deployment**. Each finding includes the exact file, line, and code path.

---

## Audit Methodology

For each WI, I traced the full call chain from the UI component through the context layer, into the service, and out to the network boundary. Every proposed code change was validated against:
1. **Type contracts** — do the inputs/outputs match what the downstream code expects?
2. **Execution environment** — will this work on `*.github.io` with no backend?
3. **Error propagation** — what happens when the network call fails?
4. **React lifecycle** — will this cause flicker, double-renders, or stale closures?
5. **Data integrity** — can data be lost, duplicated, or corrupted?

---

## 🔴 FINDING 1: Agent 05 (Insight Embeddings) — Critical Type-Contract Violation

**Severity:** FATAL — will crash the entire Insight pipeline at runtime.

### The Problem

The WI replaces `embeddingsAdapter.js` with a TF-IDF implementation that produces **variable-length vectors** (exactly 200 dimensions, or fewer if vocabulary is smaller). But the downstream pipeline **hard-compares vector lengths** in `cosineSimilarity`:

**File:** [dedup.ts L12-13](file:///c:/Code3/NWv-7/src/insight/src/dedup/dedup.ts#L12-L13)
```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
```

This returns `0` if lengths differ, which is correct. But the deeper problem is in `cluster.ts`:

**File:** [cluster.ts L28-29](file:///c:/Code3/NWv-7/src/insight/src/cluster/cluster.ts#L28-L29)
```typescript
function updateCentroid(cluster: Cluster, newStory: InsightStory): void {
  const ce = cluster.centroidEmbedding;
  const ne = newStory.embedding;
  if (ce.length === 0 || ce.length !== ne.length) {
    cluster.centroidEmbedding = [...ne]; // RESETS centroid to new story's vector
```

If any two batches of articles produce vocabularies of different sizes (which is **guaranteed** because TF-IDF vocabulary is corpus-dependent), the centroid resets to the latest story's embedding, destroying all prior centroid averaging.

### Root Cause Chain
1. WI 05 TF-IDF builds vocabulary from `texts` passed in one `getEmbeddings(texts)` call
2. `insightFetcher.js` L11 calls `getEmbeddings(texts)` **per slot** (once for "now", once for "minus4h", etc.)
3. Each slot's corpus produces a DIFFERENT vocabulary → different vector dimensions
4. When stories from different slots are clustered together in `clusterIntoParentEvents`, `cosineSimilarity` returns 0 for cross-slot pairs → **every slot creates its own isolated clusters** → pipeline produces N×4 clusters instead of N
5. The `HARD_DUP_EMBED_SIM` check (0.985 threshold) also returns 0 for cross-slot pairs → deduplication fails across slots → duplicate stories appear as separate parents

### Fix Required for WI 05
The TF-IDF implementation **must produce fixed-dimension vectors** across all calls. Two options:

**Option A (recommended):** Build vocabulary from ALL texts across all slots in a single call, then project each text onto that vocabulary. This requires changing `insightFetcher.js` to batch all slots:

```javascript
// CANNOT just replace embeddingsAdapter.js — must also ensure
// getEmbeddings is called once for ALL stories, not per-slot
```

**Option B (simpler, WI-compatible):** Use a fixed vocabulary of ~200 common news terms (hardcoded), not corpus-derived. This makes vectors deterministic regardless of corpus:

```javascript
const FIXED_VOCAB = [
  'government','market','economy','crisis','election','court','minister',
  'police','india','chennai','pakistan','china','stocks','rupee','dollar',
  'cricket','nifty','sensex','bank','trade','war','attack','flood',
  'covid','vaccine','hospital','school','university','technology','ai',
  // ... 170 more curated terms
];

export async function getEmbeddings(texts) {
  return texts.map(text => {
    const tokens = tokenize(text);
    const tf = computeTF(tokens);
    return FIXED_VOCAB.map(term => tf[term] || 0);
  });
}
```

This guarantees every vector is exactly 200 dimensions regardless of input corpus.

---

## 🔴 FINDING 2: Agent 05 (Insight Fetcher) — `fetchNews` Returns Incompatible Shape

**Severity:** CRITICAL — insight pipeline receives malformed story objects.

### The Problem

WI 05 changes `newsFetcher.js` to call `fetchNews(query)` with different queries per slot. But look at what `fetchNews` actually returns:

**File:** [newsService.js L110-121](file:///c:/Code3/NWv-7/src/services/newsService.js#L110-L121)
```javascript
return {
    id: `rss-${idx}`,          // ← sequential per call, will COLLIDE across slots
    headline: item.title,
    summary: 'Latest coverage from Google News', // ← HARDCODED, not the real summary
    source: source,
    url: item.link,
    time: new Date(item.pubDate).toLocaleTimeString(...),
    confidence: 'MEDIUM',
    sourceCount: 1
};
```

The WI maps these to `InsightStory` fields in `newsFetcher.js`:
```javascript
return {
    id: article.id,           // ← "rss-0", "rss-1" — COLLIDES across slots
    title: article.headline,
    summary: article.summary,  // ← Always "Latest coverage from Google News"
    ...
};
```

**Problems:**
1. **ID collisions:** Both "world" and "india" slots produce `rss-0`, `rss-1`, etc. When `storiesById` Map is built in `pipeline.ts L82-84`, the India `rss-0` **overwrites** the World `rss-0`. Stories are silently lost.
2. **Empty summaries:** The `summary` field is always the literal string `"Latest coverage from Google News"`, not the article description. `nlpAdapter.js` then extracts entities/verbs from this useless string, producing empty entity sets. The `factualDensity` score becomes 0 for ALL stories. This collapses the impact score calculation.
3. **publishedAt is wrong:** The WI sets `publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString()` — but `normalize.ts L142` expects `publishedAt` to be **epoch milliseconds (number)**, not an ISO string. `Date.now() - raw.publishedAt` where `publishedAt` is a string like `"2026-04-29T..."` produces `NaN`, which means `ageHours > cfg.MAX_STORY_AGE_HOURS` returns `false` (NaN comparisons), so no stories are filtered by age. Then `computeFreshnessScore(NaN)` returns `0.0`.

### Fix Required for WI 05

```javascript
export async function fetchStoriesForSlot(slot) {
  const query = SLOT_QUERIES[slot] || `${slot} news today`;
  const news = await fetchNews(query, { newsApiKey: '' });
  if (!news || !Array.isArray(news)) return [];
  return news.map((article, idx) => ({
    id: `${slot}-${idx}-${Date.now()}`,  // UNIQUE across slots
    title: article.headline || article.title || '',
    summary: article.description || article.summary || article.headline || '',  // Use description, NOT the hardcoded string
    content: article.description || article.summary || '',
    url: article.url || article.link || '',
    publishedAt: article.publishedAt               // Already epoch ms from newsService
      ? (typeof article.publishedAt === 'number' ? article.publishedAt : Date.parse(article.publishedAt))
      : Date.now(),                                 // Must be NUMBER, not ISO string
    source: article.source || 'Unknown',
    sourceGroup: (article.source || 'unknown').toLowerCase().replace(/[^a-z]/g, '_'),
  }));
}
```

Also: `newsService.js` line 113 sets `summary: 'Latest coverage from Google News'` — the real description is in `item.description`. This should be `summary: cleanDescription(item.description) || 'No summary'`. However, changing newsService.js is NOT in Agent 05's scope, so the `newsFetcher.js` must extract from `article.originalTitle` or use the `headline` as the summary text for NLP processing (imperfect but functional).

---

## 🔴 FINDING 3: Agent 06 (Insight UI) — Confirmed: Redundant storyMap (from prior audit)

**Severity:** CRITICAL — wastes cycles and drops stories.

The pipeline returns `result.storiesById` as a `Map<string, InsightStory>` ([pipeline.ts L103](file:///c:/Code3/NWv-7/src/insight/src/pipeline/pipeline.ts#L103)). The WI tells the agent to manually build a new plain object `storyMap` from the `parents` array. This:
1. Converts a native `Map` (O(1) lookups) to a plain `Object` (property access, prototype chain)
2. Only indexes stories that appear as parents or their clusterStoryIds — **misses** stories added during tier-C fallback ([normalize.ts L184-208](file:///c:/Code3/NWv-7/src/insight/src/pipeline/normalize.ts#L184-L208)) and incremental updates
3. Rebuilds on every render since it's inside the component body (no useMemo)

### Fix: WI 06 must instruct the agent to:

```jsx
// InsightPage.jsx — pass result.storiesById directly
function InsightTab({ result }) {
  const parents = result?.parents || [];
  const storiesById = result?.storiesById || new Map();  // USE the pipeline's Map directly

  return (
    // ...
    {parents.map((p, i) => <ICard key={p.parentId} story={p} index={i} storiesById={storiesById} />)}
  );
}

// ICard — use Map.get()
function ICard({ story, index, storiesById = new Map() }) {
  // ...
  const child = storiesById.get(childId);
  const headline = child?.title || child?.canonicalText || childId;
  const source = child?.source || child?.sourceGroup || 'Source';
```

> **Note:** `storiesById` contains `InsightStory` objects, not `InsightParent` objects. The fields are `title`, `source`, `sourceGroup` — NOT `canonicalHeadline`.

---

## 🔴 FINDING 4: Agent 09 (Market Lazy Load) — Confirmed: Flash-of-Empty-State Race

**Severity:** HIGH — visual glitch, user sees error before data loads.

### Detailed Trace

1. `MarketContext` mounts → `loading: false` (per WI), `marketData: null`
2. `MarketPage` mounts → reads context → `loading` is false, `marketData` is null
3. [MarketPage.jsx](file:///c:/Code3/NWv-7/src/pages/MarketPage.jsx) renders — the conditional rendering checks `loading` first. Since `loading: false` and `marketData: null`, it renders the error/empty state
4. `useEffect(() => ensureBoot())` fires (post-render) → sets `initialized: true`, calls `loadMarketData()`
5. `loadMarketData` L36 sets `loading: true` → re-render → now shows spinner
6. User sees: Empty state flash → spinner → data

### But there's a SECOND bug the prior audit missed

The WI's `ensureBoot` uses the `initialized` flag, but `loadMarketData` already has its own cache check (L18-33). If localStorage has a valid cache, `loadMarketData` returns early **without** setting `loading: true` at all — it just sets `setMarketData(parsed)` and `setLoading(false)`. The state transitions are:

```
loading: false → (ensureBoot) → loadMarketData called → cache found →
  setMarketData(parsed), setLoading(false)
```

Loading was already false, so `setLoading(false)` is a no-op. The user saw the empty flash but now data appears. However, because React batches state updates in events but NOT in async callbacks (React 18 does batch, but the `localStorage.getItem` path is synchronous within the callback), the flash may or may not appear depending on React's batching behavior.

### Correct Fix

Do NOT change `loading` initial state. Instead, introduce a `booted` flag that starts `false`. The Market page shows a distinct "waiting to boot" UI (not the error state) when `!booted`:

```jsx
// MarketContext.jsx
const [booted, setBooted] = useState(false);

const ensureBoot = useCallback(() => {
    if (!booted) {
        setBooted(true);
        loadMarketData();   // loadMarketData already sets loading: true internally
    }
}, [booted, loadMarketData]);

// Remove the auto-load useEffect
// Keep loading initial state as: true

// MarketPage.jsx
const { marketData, loading, error, refreshMarket, lastFetch, ensureBoot, booted } = useMarket();

useEffect(() => { ensureBoot(); }, [ensureBoot]);

// Render: if (!booted) show "Tap Market tab to load" or just the spinner
// The loading: true initial state means the spinner shows until data arrives — no flash
```

---

## 🟡 FINDING 5: Agent 02 (Market Proxy) — Proxy URL Format Mismatch

**Severity:** MODERATE — one of the four proposed proxies will always fail.

### The Problem

The WI proposes adding `thingproxy.freeboard.io`:
```javascript
(url) => `https://thingproxy.freeboard.io/fetch/${url}`
```

But `fetchThroughProxies` L34 parses the response based on the `parser` argument:
```javascript
return parser === 'text' ? await response.text() : await response.json();
```

Yahoo Finance returns JSON. `thingproxy` wraps the response in its own JSON envelope: `{ "status": 200, "contents": "..." }`. So the raw Yahoo JSON is nested inside `contents` as a string, not at the top level. `extractYahooPrice(data)` looks for `data.chart.result[0]` — which doesn't exist in the wrapper. It returns `null`.

### Fix
Remove `thingproxy` from the list. It doesn't support pass-through JSON correctly. Replace with:
```javascript
(url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
(url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
(url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
```
Three proxies is sufficient with the existing retry logic.

---

## 🟡 FINDING 6: Agent 03 (Commodities) — Confirmed: Silent Failure (from prior audit)

**Severity:** MODERATE — empty UI sections with no explanation.

### Additional Detail

The `fetchAllMarketData` function at [indianMarketService.js L194](file:///c:/Code3/NWv-7/src/services/indianMarketService.js#L194) uses `Promise.allSettled` and extracts values:
```javascript
commodities: commodities.status === 'fulfilled' ? commodities.value : []
```

When Agent 03's code returns `[]` (all proxy attempts failed), the `sourceHealth` map at L195 reports:
```javascript
commodities: commodities.status === 'fulfilled' ? 'live' : 'failed'
```

Since `Promise.allSettled` never rejects the outer promise, `status` is always `'fulfilled'`, even when the value is `[]`. So `sourceHealth.commodities` says `'live'` while displaying zero commodities. **The health indicator lies to the user.**

### Fix
Agent 03's return value should distinguish between "no data available" (empty snapshot AND proxy failure) vs "data fetched successfully":

```javascript
const successful = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
if (successful.length === 0) {
    // Signal failure upstream instead of returning empty array
    throw new Error('All commodity data sources unavailable');
}
return successful;
```

This makes `sourceHealth.commodities` report `'failed'` correctly, and `MarketPage` can render the appropriate error UI.

---

## 🟡 FINDING 7: Agent 05 (TF-IDF) — Confirmed: IDF Smoothing (from prior audit)

**Severity:** MODERATE — garbage clustering on small corpuses.

The WI formula: `Math.log(N / (dfCounts[t] + 1)) + 1`

With N=3, df=3: `Math.log(3/4) + 1 = 0.71` — terms that appear in every document still get positive weight, which is mathematically correct but makes all vectors nearly identical (every document contains the common terms with similar TF, so the distinguishing power comes only from rare terms).

The scikit-learn smooth formula `Math.log((N + 1) / (df + 1)) + 1` with N=3, df=3: `Math.log(4/4) + 1 = 1.0` — same problem, actually worse (common terms get HIGHER weight).

The real fix is to use **sublinear TF**: `1 + Math.log(tf)` instead of raw `tf/total`. This dampens terms that appear many times in a single document (like "India" appearing 10 times in a short headline set):

```javascript
function computeTF(tokens) {
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  // Sublinear TF: dampens high-frequency terms within a single document
  Object.keys(freq).forEach(t => {
    freq[t] = 1 + Math.log(freq[t]);
  });
  return freq;
}
```

---

## 🟡 FINDING 8: Agent 01 (Nav/Routing) — Missing `InsightPage` Import Verification

**Severity:** LOW but important for agent confidence.

The WI says "InsightPage is already imported at line 16." This is **correct** — [App.jsx L16](file:///c:/Code3/NWv-7/src/App.jsx#L16) has:
```javascript
import InsightPage from './pages/InsightPage';
```

✅ Verified. No issue. But the WI should also note that the `/markets` route already exists at line 105. An uncareful agent might add a duplicate. **Add a "DO NOT add duplicate /markets route" warning.**

---

## 🟡 FINDING 9: Agent 04 (Top Stories Quality) — Line Number Drift

**Severity:** MODERATE — agent may edit the wrong line.

The WI says to find `const finalSection = detectedSection || section;` at **line 654**. But the actual code shows this at [rssAggregator.js L654](file:///c:/Code3/NWv-7/src/services/rssAggregator.js#L654). Let me verify:

From the view output, `normalizeItem` is at line 640, and line 654 contains:
```javascript
const finalSection = detectedSection || section;
```

✅ Verified. Line number is correct. However, the `classifySection` function (line 652) is called BEFORE this line. The WI's fix changes the assignment but doesn't change `classifySection` itself. If `classifySection` returns `null` for genuinely ambiguous articles, the fix correctly falls back to `section`. But if `classifySection` returns `"entertainment"` for a world article about the Grammys, the fix STILL reclassifies it because `section !== 'general'` is false for items from the `world` feed (where `section` is `'world'`, not `'general'`).

**Wait — re-read the fix:**
```javascript
const finalSection = (section === 'general' && detectedSection) ? detectedSection : section;
```

This says: only reclassify if the ORIGINAL section is `'general'`. For world feed items, `section` is `'world'`, so `section === 'general'` is false, and `finalSection` stays as `'world'`. ✅ This is correct. The Grammy article stays in world (where it will be filtered out by the impact score gate in Agent 04's other change).

---

## 🟡 FINDING 10: Agent 10 (Up Ahead Feeds) — Static Host Feed Pruning Nullifies Changes

**Severity:** HIGH — Agent 10's work may have zero effect on GitHub Pages.

### The Problem

[feedSourceRegistry.js L174-176](file:///c:/Code3/NWv-7/src/intelligence/feedSourceRegistry.js#L174-L176):
```javascript
if (isStaticHost) {
    sources = sources.filter(s => s.priorityScore >= 3 || s.trust === 'high').slice(0, 2);
}
```

On GitHub Pages (`isStaticHost: true`), only feeds with `trust: 'high'` or `priorityScore >= 3` survive, and only the top 2 per category.

Most Google News search feeds in the registry have `trust: 'medium'`. Their `priorityScore` = 2 (from `rankFeedSource`). They **fail the filter** and are dropped.

So even if Agent 10 improves the query strings on the Google News URLs, those feeds are **never fetched on GitHub Pages** because they're pruned by the static host governor.

### Fix
Agent 10's WI must ALSO update the `trust` field for the improved Google News feeds to `'high'`:
```javascript
{ url: 'https://news.google.com/rss/search?q=...improved...', sourceType: 'search', trust: 'high' }
```

Or, the WI should instruct the agent to relax the static host filter to allow at least 3 feeds per category:
```javascript
if (isStaticHost) {
    sources = sources.filter(s => s.priorityScore >= 2 || s.trust !== 'low').slice(0, 3);
}
```

---

## 🟢 FINDING 11: Agent 07 (News Cards) — CSS Class Collision Risk

**Severity:** LOW.

The WI appends new CSS classes to `index.css`. The classes `.modern-news-card`, `.mnc-header`, `.mnc-source`, etc. already exist in the current `index.css` (they're used by the existing `NewsSection.jsx`). Appending new definitions will **override** existing ones due to CSS cascade order (later rules win).

This is actually intentional — the new styles are meant to replace the old ones. But the WI should explicitly state: "These CSS rules will override existing definitions for the same class names. This is by design."

---

## 🟢 FINDING 12: Agent 08 (Mobile Shell) — `app-shell` className on wrong element

**Severity:** LOW.

The WI says to add `app-shell` to the wrapper div. The actual wrapper is at [App.jsx L98](file:///c:/Code3/NWv-7/src/App.jsx#L98):
```jsx
<div className="app">
```

The WI correctly identifies this. Adding `app-shell`:
```jsx
<div className="app app-shell">
```

This works. However, the `BottomNav` is INSIDE this div (L113), so the 480px constraint will also apply to the nav. The nav uses `position: fixed` in the current CSS, which means it breaks out of the parent's flow but still respects `left`/`right` relative to the viewport, not the parent. So the nav will extend full-width while content is 480px centered. This may look wrong.

**Fix:** The WI should add to the `.bottom-nav` CSS:
```css
.bottom-nav {
  max-width: 480px;
  margin: 0 auto;
  left: 0;
  right: 0;
}
```

---

## Summary: Required WI Corrections

| WI | Finding | Severity | Action |
|----|---------|----------|--------|
| **05** | TF-IDF vectors vary in length across slots → clustering breaks | 🔴 FATAL | Use fixed vocabulary, not corpus-derived |
| **05** | `fetchNews` returns wrong shape (colliding IDs, hardcoded summary, string timestamps) | 🔴 CRITICAL | Fix ID generation, summary extraction, timestamp type |
| **06** | Manually builds storyMap instead of using `result.storiesById` Map | 🔴 CRITICAL | Use pipeline's Map directly |
| **09** | `loading: false` initial state causes flash-of-empty | 🔴 HIGH | Keep `loading: true`, add separate `booted` flag |
| **02** | `thingproxy` wraps JSON in envelope → parsing fails | 🟡 MODERATE | Remove `thingproxy` from proxy list |
| **03** | Empty commodities report `sourceHealth: 'live'` | 🟡 MODERATE | Throw on total failure instead of returning `[]` |
| **05** | IDF formula volatile on small corpus | 🟡 MODERATE | Add sublinear TF dampening |
| **10** | Static host prunes `trust: 'medium'` feeds | 🟡 HIGH | Update trust to `'high'` or relax filter |
| **01** | No warning about duplicate `/markets` route | 🟢 LOW | Add "DO NOT duplicate" note |
| **07** | CSS class name collision (intentional) | 🟢 LOW | Add explicit note |
| **08** | BottomNav escapes 480px shell | 🟢 LOW | Add `max-width: 480px` to `.bottom-nav` |

---

## Recommended Execution with Fixes Applied

```
WAVE 1: Agent 01 (as-is, add duplicate route warning)
WAVE 2: Agent 02 (remove thingproxy), Agent 04 (as-is), Agent 05 (MAJOR REWRITE — fixed vocab, ID fix, timestamp fix)
WAVE 3: Agent 03 (throw on failure), Agent 06 (use result.storiesById), Agent 07 (add CSS note)
WAVE 4: Agent 09 (keep loading:true, add booted flag), Agent 10 (update trust fields)
WAVE 5: Agent 08 (add bottom-nav max-width)
```
