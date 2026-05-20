# WI — Agent 05: Insight — Fix Pipeline (Embeddings + Slot Fetcher)
**Sequence:** 5 of 10
**Prerequisite:** Agent 01 complete
**Estimated changes:** ~90 lines across 2 files

---

## Objective
The Insight page shows "No Insights Available" because:
1. **Mock embeddings** — produces near-identical vectors (382 zeros + 2 values) → cosine similarity ≈ 0.99 for ALL pairs → dedup removes everything
2. **Same query all slots** — all 4 time slots fetch `"latest news"` → identical articles → no temporal diversity
3. **ID collisions** — `newsService.js` generates `rss-0, rss-1` per call → IDs overwrite across slots in `storiesById` Map
4. **Empty summaries** — RSS fallback hardcodes `"Latest coverage from Google News"` as summary → NLP extraction finds 0 entities

Fix using pure JavaScript (no external API — works on static GitHub Pages).

---

## File 1 of 2: `src/adapters/embeddingsAdapter.js`

**What to do:** Replace the entire file with a **fixed-vocabulary** TF-IDF implementation.

> ⚠️ **Audit v3 Critical Fix:** The vocabulary MUST be hardcoded (not corpus-derived). Corpus-derived vocabulary produces different vector dimensions per slot, breaking `cosineSimilarity` which checks `a.length !== b.length`.

**AFTER (replace entire file):**
```javascript
/**
 * Fixed-vocabulary TF-IDF embeddings — works on static GitHub Pages.
 * Uses a hardcoded 200-term vocabulary so vectors are ALWAYS 200 dimensions
 * regardless of input corpus. This is critical for cross-slot clustering.
 */

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','been','but','by','for','from',
  'has','have','he','her','his','how','i','in','is','it','its','not',
  'of','on','or','she','so','than','that','the','their','they','this',
  'to','up','was','we','were','what','when','which','who','will','with'
]);

// Fixed vocabulary — 200 curated news terms. Every vector is exactly 200 dimensions.
const FIXED_VOCAB = [
  'government','minister','prime','president','parliament','court','supreme',
  'election','vote','party','opposition','congress','bjp','modi','rahul',
  'economy','gdp','inflation','fiscal','deficit','budget','tax','reform',
  'market','stock','shares','sensex','nifty','trading','rally','crash',
  'bank','rbi','rate','repo','interest','loan','emi','credit','deposit',
  'rupee','dollar','euro','currency','forex','exchange','reserve',
  'oil','crude','petrol','diesel','gas','energy','power','coal','solar',
  'gold','silver','commodity','metal','price','export','import','trade',
  'company','profit','revenue','quarterly','results','earnings','growth',
  'startup','funding','valuation','ipo','listing','investor','venture',
  'technology','ai','artificial','intelligence','digital','software','data',
  'cyber','security','privacy','hack','breach','cloud','computing',
  'india','china','pakistan','usa','russia','ukraine','israel','gaza',
  'chennai','mumbai','delhi','kolkata','bengaluru','hyderabad',
  'muscat','oman','dubai','saudi','gulf','middle','east',
  'cricket','ipl','football','sports','match','final','tournament',
  'player','team','captain','coach','win','victory','defeat','score',
  'army','military','defence','border','tension','ceasefire','attack',
  'terror','security','police','arrest','investigation','crime',
  'covid','vaccine','health','hospital','disease','medicine','doctor',
  'education','university','school','student','exam','result',
  'climate','flood','cyclone','earthquake','disaster','rain','storm',
  'imd','warning','alert','rescue','relief','evacuation','shelter',
  'infrastructure','road','highway','metro','railway','airport','bridge',
  'housing','real','estate','property','construction','smart','city',
  'film','movie','actor','director','release','box','office','ott',
  'netflix','disney','bollywood','hollywood','tamil','telugu',
  'festival','celebration','holiday','pongal','diwali','eid',
  'supreme','verdict','law','bill','act','regulation','policy',
  'un','nato','summit','bilateral','treaty','sanctions','diplomacy',
  'women','child','rights','protest','rally','demonstration',
  'agriculture','farmer','crop','msp','monsoon','irrigation',
  'space','isro','nasa','satellite','launch','mission','orbit',
  'dead','killed','casualties','injured','victims','accident'
];

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

export async function getEmbeddings(texts) {
  if (!texts || texts.length === 0) return [];

  return texts.map(text => {
    const tokens = tokenize(text);
    // Sublinear TF: dampens high-frequency terms (audit v3 fix)
    const freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    Object.keys(freq).forEach(t => { freq[t] = 1 + Math.log(freq[t]); });

    // Project onto fixed vocabulary — always exactly 200 dimensions
    return FIXED_VOCAB.map(term => freq[term] || 0);
  });
}
```

---

## File 2 of 2: `src/adapters/newsFetcher.js`

**What to do:** Fix slot-specific queries, ID collisions, and summary extraction.

> ⚠️ **Audit v3 Fixes applied:**
> - IDs prefixed with slot name to prevent cross-slot collisions
> - Summary uses `article.description || article.headline` (not hardcoded string)
> - `publishedAt` kept as epoch number (not ISO string) — pipeline expects number

**AFTER (replace the function):**
```javascript
const SLOT_QUERIES = {
  now:       'breaking news today top stories',
  minus4h:   'India news today top headlines',
  minus12h:  'world news top stories',
  minus24h:  'business economy markets technology',
  // Section-based slots (if used)
  world:     'world news top stories today',
  india:     'India news today top stories',
  business:  'India business economy markets today',
  technology:'technology AI startups innovation',
  sports:    'cricket IPL football sports India',
  chennai:   'Chennai Tamil Nadu news today',
};

export async function fetchStoriesForSlot(slot) {
  const query = SLOT_QUERIES[slot] || `${slot} news today`;
  const news = await fetchNews(query, { newsApiKey: '' });
  if (!news || !Array.isArray(news)) return [];

  return news.map((article, idx) => ({
    id: `${slot}-${idx}-${Date.now()}`,  // UNIQUE across slots (audit v3 fix)
    title: article.headline || article.title || '',
    summary: article.description || article.summary || article.headline || '',  // NOT hardcoded (audit v3 fix)
    content: article.description || article.summary || '',
    url: article.url || article.link || '',
    publishedAt: typeof article.publishedAt === 'number'
      ? article.publishedAt
      : (article.publishedAt ? Date.parse(article.publishedAt) : Date.now()),  // Must be NUMBER (audit v3 fix)
    source: article.source || 'Unknown',
    sourceGroup: (article.source || 'unknown').toLowerCase().replace(/[^a-z]/g, '_'),
  }));
}
```

---

## Benchmark Validation (NEW)

After implementing the above, wire the benchmark test:

1. Add to `src/adapters/insightFetcher.js` a benchmark slot fetcher:
```javascript
import { buildInsightBenchmarkArticles } from '../benchmarks/insightBenchmark.js';

export const benchmarkSlotFetcher = async (slot) => {
  const all = buildInsightBenchmarkArticles();
  const NOW = Date.now();
  const H = 3600000;
  return all.filter(a => {
    const age = NOW - a.publishedAt;
    switch(slot) {
      case 'now': return age < 4*H;
      case 'minus4h': return age >= 4*H && age < 12*H;
      case 'minus12h': return age >= 12*H && age < 24*H;
      case 'minus24h': return age >= 24*H;
      default: return true;
    }
  });
};
```

2. In dev mode, test via browser console:
```javascript
import { runInsightBenchmark } from './benchmarks/runInsightBenchmark.js';
// Expected: 5-9 clusters, ≥90% purity, ≥90% dedup recall, ≥85% noise filtered
```

---

## Deliverable
- `src/adapters/embeddingsAdapter.js` — fixed-vocabulary TF-IDF (always 200 dims)
- `src/adapters/newsFetcher.js` — slot queries + ID fix + summary fix + timestamp fix
- `src/adapters/insightFetcher.js` — benchmark slot fetcher added (append, don't replace)

---

## QC Checklist

- [ ] Navigate to Insight tab (`/insight`)
- [ ] Clusters appear after 10–30 seconds (NOT "No Insights Available")
- [ ] At least 2+ clusters with different topics
- [ ] Two articles about same topic (e.g., "India budget") cluster together
- [ ] Articles about different topics (e.g., "cricket" vs "RBI") do NOT cluster
- [ ] Clusters show meaningful headlines (not blank/undefined)
- [ ] Signal stats show numbers > 0 for Ranked, Stories
- [ ] No console errors: `Cannot read property`, `a.length !== b.length`
- [ ] **Benchmark test:** Run `benchmarkSlotFetcher` → expect 5-9 clusters from 49 articles

---

## Do NOT change
- `src/adapters/nlpAdapter.js`
- Any files in `src/insight/src/`
- `src/pages/InsightPage.jsx` — that is Agent 06's job
