# Benchmark Wiring into Agent WIs

## Files Created

| File | Purpose | Items |
|------|---------|-------|
| `src/benchmarks/insightBenchmark.js` | 49 articles across 7 known clusters + 8 noise | Duplicates, time-staggered (1h–13h), multi-source, angles |
| `src/benchmarks/plannerBenchmark.js` | 65 base items → 350+ with variants | Date/location/dedup/noise challenges |
| `src/benchmarks/runInsightBenchmark.js` | Validates cluster purity, dedup recall, noise filtering | 4 automated checks |
| `src/benchmarks/runPlannerBenchmark.js` | Validates category, location, date, eligibility, noise | 7 automated checks |

---

## WI 05 (Insight Pipeline) — Benchmark QC Addendum

### What the agent must do AFTER implementing TF-IDF:

1. **Wire the benchmark fetcher** into `insightFetcher.js` as an alternative slot fetcher:

```javascript
// src/adapters/insightFetcher.js — add benchmark mode
import { buildInsightBenchmarkArticles } from '../benchmarks/insightBenchmark.js';

export const benchmarkSlotFetcher = async (slot) => {
  const all = buildInsightBenchmarkArticles();
  // Distribute articles across slots based on publishedAt age
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

2. **Run the benchmark** from InsightPage (dev mode only):

```javascript
// Add to InsightPage.jsx — dev-only benchmark button
import { runInsightBenchmark } from '../benchmarks/runInsightBenchmark.js';
import { benchmarkSlotFetcher } from '../adapters/insightFetcher.js';

// In the component:
const handleBenchmark = async () => {
  const pipelineFn = async (articles) => {
    // Run full pipeline with benchmark data
    return await runInsightPipeline(benchmarkSlotFetcher, DEFAULT_CONFIG);
  };
  const results = await runInsightBenchmark(pipelineFn);
  alert(`Insight Benchmark: ${results.summary}\n${JSON.stringify(results.details, null, 2)}`);
};
```

### Acceptance Criteria (MUST PASS before merge)

| Check | Target | Method |
|-------|--------|--------|
| Cluster count | 5–9 clusters from 49 articles | `runInsightBenchmark` |
| Cluster purity | ≥90% | Articles in each cluster belong to same event |
| Dedup recall | ≥90% | Known duplicate pairs merged or in same cluster |
| Noise filter | ≥85% | Noise articles excluded from parent clusters |
| No crash | 0 errors | Pipeline completes without exceptions |

### Benchmark Cluster Definitions

| Cluster ID | Topic | Sources | Time Span | Expected Angles |
|-----------|-------|---------|-----------|-----------------|
| C1_RBI_RATE_CUT | RBI rate cut 25bps | Reuters, NDTV, Hindu, Moneycontrol, FE, Bloomberg, DT Next, BBC | 0.5h–5h | base, official, market, expert, regional |
| C2_INDIA_PAK_TENSIONS | LoC ceasefire violation | Reuters, Al Jazeera, NDTV, BBC, Hindu, India Today | 1h–8h | base, official, fact, expert, reaction |
| C3_TCS_RESULTS | TCS Q4 beats estimates | Moneycontrol, FE, Bloomberg, NDTV, TOI | 10h–13h | base, market, expert, fact |
| C4_CHENNAI_CYCLONE | Cyclone warning TN | Hindu, NDTV, India Today, DT Next | 0.5h–4h | base, official, fact, regional |
| C5_AI_REGULATION | EU AI Act passed | Reuters, Bloomberg, Hindu, BBC | 4h–7h | base, market, expert, regional |
| C6_CRICKET_FINAL | India wins World Cup | ESPN, NDTV, BBC, TOI | 5h–8h | base, reaction, fact, expert |
| C7_MUSCAT_METRO | Muscat Metro project | Oman Observer, Times of Oman, Reuters | 8h–10h | base, official, expert |

---

## WI 10 (Up Ahead/Planner) — Benchmark QC Addendum

### What the agent must do AFTER implementing feed improvements:

1. **Run the planner benchmark** from UpAheadPage (dev mode):

```javascript
// Add to UpAheadPage.jsx — dev-only benchmark button
import { runPlannerBenchmark } from '../benchmarks/runPlannerBenchmark.js';

// In the component (after the view toggle buttons):
{import.meta.env.DEV && (
  <button onClick={async () => {
    const results = await runPlannerBenchmark();
    alert(`Planner Benchmark: ${results.summary}`);
  }} style={{fontSize:'0.7rem', padding:'4px 8px'}}>
    🧪 Run Benchmark
  </button>
)}
```

### Acceptance Criteria

| Check | Target | Method |
|-------|--------|--------|
| Category classification | ≥90% | movies/events/festivals/alerts/shopping/airlines correctly classified |
| Location mapping | ≥95% | T.Nagar→Chennai, Adyar→Chennai, Al Khuwair→Muscat |
| Date extraction | ≥90% | Explicit dates + "this weekend" + "next Tuesday" parsed |
| Eligibility | ≥90% | Correct upAhead/planner eligible flags |
| Noise filter | ≥90% | Listicles, stock analysis, generic blogs dropped |
| Past event filter | 100% | Events before today are dropped |
| Dedup | ≥90% | Duplicate pairs (M1/M1_DUP, S1/S1_DUP) merged |

### Benchmark Challenge Matrix

| Challenge | Items | What It Tests |
|-----------|-------|---------------|
| **Exact date** | `TANGEDCO power shutdown on ${tomorrow}` | Date parser handles ISO dates |
| **Relative date** | `Book Fair this weekend`, `meetup next Tuesday` | Natural language date inference |
| **Date range** | `Flipkart sale from X to Y` | Range extraction |
| **No date** | `Myntra EOSS live now` | Dateless offer still eligible |
| **Past date** | `Concert last week was great` | Must be filtered out |
| **T. Nagar → Chennai** | Civic alert, shopping | Location alias resolution |
| **Adyar → Chennai** | Tech meetup | Sub-locality mapping |
| **Madras → Chennai** | Saravana Stores sale | Historical alias |
| **Al Khuwair → Muscat** | Road closure | Muscat sub-area |
| **Online offers** | Amazon sale, Flipkart | No location required |
| **Duplicate titles** | M1 vs M1_DUP, S1 vs S1_DUP | Semantic dedup |
| **Noise** | Restaurant listicle, stock analysis | Category rejection |

---

## NEW FEATURE: Festivals/Holidays with Editable Locations

### Specification

Add a **Festivals** sub-tab in Up Ahead with:

1. **Editable location selector** (pill chips: Chennai ✕, Muscat ✕, + Add)
2. **Fetch button** to manually trigger festival/holiday data refresh
3. **Data sources:**
   - `timeanddate.com/holidays/india/` (for India)
   - `timeanddate.com/holidays/oman/` (for Oman)
   - Google News RSS: `"${location} public holiday OR festival date"`

### Implementation (Agent 10 scope)

```javascript
// Add to feedSourceRegistry.js — festivals section
festivals: {
    India: [
      { url: 'https://www.timeanddate.com/holidays/india/feed', sourceType: 'calendar', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=India+public+holiday+OR+Pongal+OR+Diwali+OR+Republic+Day&hl=en-IN', sourceType: 'search', trust: 'high' }
    ],
    Oman: [
      { url: 'https://news.google.com/rss/search?q=Oman+public+holiday+OR+Eid+OR+National+Day&hl=en-US', sourceType: 'search', trust: 'high' }
    ]
}
```

### UI in UpAheadPage.jsx

```jsx
// Inside the festivals view tab — add location editor + fetch button
{view === 'festivals' && (
  <div className="ua-tab-view">
    <div style={{display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center'}}>
      {(settings.upAhead?.locations || ['Chennai','Muscat']).map(loc => (
        <span key={loc} className="ua-badge type-festival" style={{cursor:'pointer'}} 
              onClick={() => { /* remove location */ }}>
          {loc} ✕
        </span>
      ))}
      <button className="btn btn--secondary" style={{padding:'4px 12px', fontSize:'0.75rem'}}
              onClick={() => {
                const loc = prompt('Add location (e.g., Trichy, Dubai):');
                if (loc) { /* add to settings.upAhead.locations */ }
              }}>+ Add</button>
      <button className="btn btn--primary" style={{padding:'4px 12px', fontSize:'0.75rem'}}
              onClick={() => loadData({ forceRefresh: true })}>
        🔄 Fetch Festivals
      </button>
    </div>
    {renderEntertainmentStyleGrid(festivalCards, 'No festivals found. Tap Fetch to load.')}
  </div>
)}
```

### Settings Independence

The Up Ahead locations list must be **self-contained** in `settings.upAhead.locations`. It should NOT read from `settings.weather.cities` or `settings.sections`. The Settings page should show a dedicated "Up Ahead Locations" editor under the Up Ahead section.
