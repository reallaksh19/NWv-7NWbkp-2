# WAVE 2 — Agent 05: Insight Pipeline (Embeddings + Fetcher + Schema.org + Temporal Decay)
> **Prerequisite:** Wave 1 (Agent 01) must be complete. Agent 04 must run BEFORE you touch frontPageComposer.js.

# Role
You are a Senior NLP Pipeline & Data Architecture Engineer.

# Context
You are working on NWv-7, a React-based news application. The Insight page is completely broken — it shows "No Insights Available" due to four cascading bugs: (1) mock embeddings produce identical vectors for all articles → dedup wipes everything, (2) all slots fetch the same query → no diversity, (3) Math.random() IDs collide across slots in the storiesById Map, (4) summary field is always empty → NLP finds nothing.

Additionally, the `src/adapters/` directory contains `.rej` files from previous failed patch attempts. This proves that line-by-line patching is unsafe for these files.

# Mission
Implement the exact changes outlined in the Work Instruction below:
1. **REPLACE ENTIRE FILES** for `embeddingsAdapter.js` and `newsFetcher.js` (do NOT patch)
2. Create two new files: `schemaOrgExtractor.js` and `temporalScorer.js`
3. Append to `insightFetcher.js` (do not replace)
4. Add `rankByTemporalScore` import to `frontPageComposer.js` (replaces the `sorted` line from Agent 04)

# Critical Rules
- REPLACE, NOT PATCH for adapter files
- 200-dimension vectors — FIXED_VOCAB must have exactly 200 terms
- Agent 04 MUST have run before you touch frontPageComposer.js
- Do NOT modify `nlpAdapter.js`, `InsightPage.jsx`, or any files in `src/insight/`
- Do NOT delete any test files (*.test.js, *.spec.js)

---

# Work Instruction

# WI — Agent 05: Insight — Fix Pipeline (Embeddings + Fetcher + Schema.org + Temporal Decay)
**Sequence:** 5 of 10
**Prerequisite:** Agent 01 complete
**Estimated changes:** ~230 lines across 5 files

---

## Objective
The Insight page shows "No Insights Available" due to four cascading bugs:
1. **Mock embeddings** — 384-dim vectors with only 2 non-zero values → cosine similarity ≈ 1.0 for ALL articles → dedup wipes everything
2. **Same query all slots** — all slots use `"latest news"` → identical articles, no temporal diversity
3. **ID collisions** — `Math.random()` IDs get overwritten across slots in `storiesById` Map
4. **Empty summaries** — summary field is always `''` → NLP finds 0 entities

Additionally, add two new capabilities:
5. **Schema.org JSON-LD extraction** — enrich articles with structured metadata via browser DOMParser
6. **Exponential temporal decay** — replace hard freshness cut-off with smooth decay scoring

---

## ⚠️ AGENT RULE: REPLACE ENTIRE FILES

The files in `src/adapters/` have `.rej` files next to them — proof that previous patch attempts failed. **Do NOT try to patch these files line-by-line.** Replace the entire file content as shown. This is the only safe approach.

---

## File 1 of 5: `src/adapters/embeddingsAdapter.js` — REPLACE ENTIRE FILE

```javascript
/**
 * Fixed-vocabulary TF-IDF embeddings — works on static GitHub Pages.
 *
 * CRITICAL: Uses a hardcoded 200-term vocabulary so every vector is ALWAYS
 * exactly 200 dimensions regardless of input corpus. Dimension consistency
 * is mandatory for cosineSimilarity() which checks a.length !== b.length.
 *
 * Previous implementation produced [0,0,...,0,text.length/1000, charCode/255]
 * giving cosine similarity ≈ 0.99 for ALL pairs → dedup removed everything.
 */

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','been','but','by','for','from',
  'has','have','he','her','his','how','i','in','is','it','its','not',
  'of','on','or','she','so','than','that','the','their','they','this',
  'to','up','was','we','were','what','when','which','who','will','with'
]);

// Hardcoded 200-term vocabulary — curated for Indian/global news domain
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
    // Sublinear TF: dampens high-frequency terms
    const freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    Object.keys(freq).forEach(t => { freq[t] = 1 + Math.log(freq[t]); });

    // Project onto fixed vocabulary — always exactly 200 dimensions
    return FIXED_VOCAB.map(term => freq[term] || 0);
  });
}
```

---

## File 2 of 5: `src/adapters/newsFetcher.js` — REPLACE ENTIRE FILE

```javascript
/* eslint-disable */
import { fetchNews } from '../services/newsService.js';
import { extractSchemaOrg } from './schemaOrgExtractor.js';

// Different query per slot for temporal diversity
const SLOT_QUERIES = {
  now       : 'breaking news today top stories',
  minus4h   : 'India news today top headlines',
  minus12h  : 'world news top stories',
  minus24h  : 'business economy markets technology',
  world     : 'world news top stories today',
  india     : 'India news today top stories',
  business  : 'India business economy markets today',
  technology: 'technology AI startups innovation',
  sports    : 'cricket IPL football sports India',
  chennai   : 'Chennai Tamil Nadu news today',
};

export async function fetchStoriesForSlot(slot) {
  const query = SLOT_QUERIES[slot] || `${slot} news today`;
  const news = await fetchNews(query, { newsApiKey: '' });
  if (!news || !Array.isArray(news)) return [];

  return news.map((article, idx) => {
    // Try Schema.org enrichment if raw HTML is available
    const schema = article.rawHtml ? extractSchemaOrg(article.rawHtml) : null;

    // Timestamp — must be a NUMBER (epoch ms), not ISO string
    let publishedAt;
    if (schema?.datePublished) {
      publishedAt = Date.parse(schema.datePublished);
    } else if (typeof article.publishedAt === 'number') {
      publishedAt = article.publishedAt;
    } else if (article.publishedAt) {
      publishedAt = Date.parse(article.publishedAt);
    } else {
      publishedAt = Date.now();
    }
    if (isNaN(publishedAt)) publishedAt = Date.now();

    return {
      // Slot-prefixed ID prevents cross-slot collisions in storiesById Map
      id         : `${slot}-${idx}-${Date.now()}`,
      title      : schema?.headline    || article.headline || article.title   || '',
      summary    : schema?.description || article.description || article.summary || article.headline || '',
      content    : schema?.description || article.description || article.summary || '',
      url        : article.url || article.link || '',
      publishedAt,
      author     : schema?.author   || article.author  || null,
      image      : schema?.image    || article.image   || null,
      keywords   : schema?.keywords || [],
      source     : article.source   || 'Unknown',
      sourceGroup: (article.source  || 'unknown').toLowerCase().replace(/[^a-z]/g, '_'),
    };
  });
}
```

---

## File 3 of 5: `src/adapters/schemaOrgExtractor.js` — CREATE NEW FILE

```javascript
/**
 * schemaOrgExtractor.js
 * Extracts structured article/event metadata from Schema.org JSON-LD blocks
 * in fetched HTML strings. Uses browser-native DOMParser — zero dependencies.
 *
 * Returns null when no valid JSON-LD is found — callers must handle gracefully.
 */

const ARTICLE_TYPES = new Set([
  'Article', 'NewsArticle', 'ReportageNewsArticle',
  'BlogPosting', 'LiveBlogPosting', 'Event'
]);

/**
 * @param {string} html  Raw HTML string (e.g. from a CORS-proxied page)
 * @returns {{ headline, datePublished, author, image, keywords, description }|null}
 */
export function extractSchemaOrg(html) {
  if (!html || typeof html !== 'string') return null;

  let doc;
  try {
    // DOMParser runs in a detached document — no scripts execute, safe for untrusted HTML
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }

  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const raw = JSON.parse(script.textContent);
      // Support both single objects and @graph arrays
      const nodes = Array.isArray(raw['@graph']) ? raw['@graph'] : [raw];
      for (const node of nodes) {
        if (!ARTICLE_TYPES.has(node['@type'])) continue;
        return {
          headline     : node.headline      || node.name        || null,
          datePublished: node.datePublished  || node.startDate   || null,
          author       : node.author?.name   || (typeof node.author === 'string' ? node.author : null),
          image        : node.image?.url     || (typeof node.image  === 'string' ? node.image  : null),
          keywords     : typeof node.keywords === 'string'
                           ? node.keywords.split(',').map(k => k.trim()).filter(Boolean)
                           : Array.isArray(node.keywords) ? node.keywords : [],
          description  : node.description   || null,
        };
      }
    } catch { /* malformed JSON — skip silently */ }
  }
  return null;
}
```

---

## File 4 of 5: `src/services/temporalScorer.js` — CREATE NEW FILE

```javascript
/**
 * temporalScorer.js — Exponential time-decay freshness scorer.
 *
 * Replaces hard freshness cut-offs with smooth decay:
 *   weight = e^(-λ × age_hours)   where λ = ln(2) / HALF_LIFE_HOURS
 *
 * With HALF_LIFE = 6h:
 *   0h   → weight 1.00  (no penalty)
 *   6h   → weight 0.50  (half weight)
 *   12h  → weight 0.25
 *   24h  → weight 0.06  (significant decay, but not zero)
 *   48h  → weight 0.004 (effectively zero for most scores)
 *
 * A high-impact story (score 9) at 24h: 9 × 0.06 = 0.54
 * A mediocre story  (score 2) at  1h: 2 × 0.88 = 1.76  ← correctly wins
 * Tune HALF_LIFE_HOURS to change the decay curve.
 */

const HALF_LIFE_HOURS = 6;
const LAMBDA = Math.LN2 / HALF_LIFE_HOURS;  // ≈ 0.1155

/**
 * @param {number} baseScore    Raw impact/relevance score (e.g. 0–10)
 * @param {number} publishedAt  Unix timestamp in milliseconds
 * @param {number} [now]        Override for unit testing
 * @returns {number}            Time-decayed score (always >= 0)
 */
export function temporalScore(baseScore, publishedAt, now = Date.now()) {
  if (!publishedAt || isNaN(publishedAt)) return baseScore * 0.1; // treat unknown age as stale
  const ageHours = Math.max(0, now - publishedAt) / 3_600_000;
  return baseScore * Math.exp(-LAMBDA * ageHours);
}

/**
 * Re-rank an array of articles by decayed score. Non-destructive.
 * @param {Array<{impactScore?: number, publishedAt: number}>} articles
 * @returns {Array} Sorted highest temporal-score first
 */
export function rankByTemporalScore(articles) {
  return [...articles].sort((a, b) =>
    temporalScore(b.impactScore || 0, b.publishedAt) -
    temporalScore(a.impactScore || 0, a.publishedAt)
  );
}
```

---

## File 5 of 5: `src/adapters/insightFetcher.js` — APPEND ONLY (do not replace)

Find the end of `insightFetcher.js`. **Append** (do not replace existing exports):

```javascript
// ── Benchmark slot fetcher (dev mode only) ────────────────────────────────
import { buildInsightBenchmarkArticles } from '../benchmarks/insightBenchmark.js';

export const benchmarkSlotFetcher = async (slot) => {
  const all = buildInsightBenchmarkArticles();
  const NOW = Date.now();
  const H   = 3_600_000;
  return all.filter(a => {
    const age = NOW - a.publishedAt;
    switch (slot) {
      case 'now'      : return age < 4 * H;
      case 'minus4h'  : return age >= 4 * H  && age < 12 * H;
      case 'minus12h' : return age >= 12 * H && age < 24 * H;
      case 'minus24h' : return age >= 24 * H;
      default         : return true;
    }
  });
};
```

> ⚠️ Only append — do NOT replace any existing exports in `insightFetcher.js`.

---

## Integration: `src/services/frontPageComposer.js`

Add ONE import at the top of `frontPageComposer.js` (if not already present):
```javascript
import { rankByTemporalScore } from './temporalScorer.js';
```

Find the sort line inside `composeBalancedFeed` (search for `sort((a, b)` inside that function):
```javascript
// BEFORE (search for this pattern):
const sorted = [...pool].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

// AFTER:
const sorted = rankByTemporalScore(pool);
```

---

## Deliverable
- `src/adapters/embeddingsAdapter.js` — **full file replacement** — fixed-vocab TF-IDF, always 200 dims
- `src/adapters/newsFetcher.js` — **full file replacement** — slot queries + ID fix + summary fix + Schema.org enrichment
- `src/adapters/schemaOrgExtractor.js` — **new file** — JSON-LD extractor via DOMParser
- `src/services/temporalScorer.js` — **new file** — exponential decay ranker
- `src/adapters/insightFetcher.js` — **append only** — benchmark slot fetcher
- `src/services/frontPageComposer.js` — 1 import + 1 line swap

---

## QC Checklist

- [ ] `npm run dev` — no import errors (`Cannot find module 'schemaOrgExtractor'`, etc.)
- [ ] Navigate to Insight tab (`/insight`)
- [ ] Clusters appear after 10–30 seconds — NOT "No Insights Available"
- [ ] At least 2 clusters with different topics
- [ ] Two articles about "India budget" cluster together; "cricket" and "RBI" do NOT cluster
- [ ] Cluster cards show readable headlines, not blank
- [ ] Signal stats show numbers > 0 for Ranked, Stories
- [ ] No console error: `a.length !== b.length` (vector dimension mismatch)
- [ ] No console error: `Cannot read property of undefined` in embeddings
- [ ] **ID uniqueness:** Open DevTools → Console, run: `Array.from(storiesById.keys()).some((id, i, a) => a.indexOf(id) !== i)` — should return `false`
- [ ] **Schema.org:** For an RSS article with JSON-LD, `author` and `image` populate on the card
- [ ] **Schema.org fallback:** Article without JSON-LD shows no crash — falls back to RSS fields
- [ ] **Temporal decay:** Most recent articles appear at top; 24h-old low-score article does not appear in Top Stories
- [ ] **Benchmark (dev only):** `benchmarkSlotFetcher('now')` returns array of articles, not error

---

## Do NOT change
- `src/adapters/nlpAdapter.js`
- Any files in `src/insight/` subdirectory
- `src/pages/InsightPage.jsx` — that is Agent 06's scope
- `src/services/frontPageComposer.js` MIN_IMPACT gate logic (Agent 04's scope) — only add the `rankByTemporalScore` import + swap

## Rollback
If QC fails: `git checkout -- src/adapters/embeddingsAdapter.js src/adapters/newsFetcher.js src/services/frontPageComposer.js`
(New files `schemaOrgExtractor.js` and `temporalScorer.js` can be deleted if needed: `rm src/adapters/schemaOrgExtractor.js src/services/temporalScorer.js`)
