# WI — Agent 10: Up Ahead — Feed Quality + Festivals + Static Host Fix
**Sequence:** 10 of 10
**Prerequisite:** None (can run in parallel with others after Agent 01)
**Estimated changes:** ~80 lines across 2 files

---

## Objective
The Up Ahead sections (Movies, Events, Festivals, Alerts, Shopping) show empty or irrelevant content because:
1. RSS queries are too broad
2. **On static host, the feed governor prunes ALL `trust: 'medium'` feeds** → events, shopping, civic sections are permanently empty
3. Festivals/holidays for Chennai/Muscat are missing
4. No way to edit locations or manually fetch festivals

---

## Context
- File: `src/intelligence/feedSourceRegistry.js`
- On GitHub Pages, `isStaticHost: true` triggers `buildFeedFetchPlan` line 174:
  ```javascript
  sources = sources.filter(s => s.priorityScore >= 3 || s.trust === 'high').slice(0, 2);
  ```
- `trust: 'medium'` → `priorityScore: 2` → **pruned**. ALL Google News search feeds have `trust: 'medium'` → entire categories vanish.

---

## File 1 of 2: `src/intelligence/feedSourceRegistry.js`

### Change 1: Update feed trust levels + improve queries

> ⚠️ **Audit v3 Critical Fix:** ALL Google News feeds for actionable categories MUST be set to `trust: 'high'`. Otherwise they are pruned on static host and the section is permanently empty.

Replace the `DEFAULT_FEED_SOURCE_REGISTRY` object. Keep the structure, update URLs and trust levels:

```javascript
const DEFAULT_FEED_SOURCE_REGISTRY = Object.freeze({
  alerts: {
    Chennai: [
      { url: 'https://www.thehindu.com/news/cities/chennai/feeder/default.rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://www.dtnext.in/rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=Chennai+power+cut+OR+water+supply+OR+TANGEDCO+OR+metro+water&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://www.omanobserver.om/rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://timesofoman.com/rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=Muscat+road+closure+OR+advisory+OR+announcement&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ],
    Trichy: [
      { url: 'https://www.thehindu.com/news/cities/Tiruchirapalli/feeder/default.rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=Trichy+power+cut+OR+water+supply+OR+civic+alert&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  weather_alerts: {
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=IMD+Chennai+weather+warning+OR+cyclone+OR+heavy+rain+alert&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Oman+Met+weather+warning+OR+thunderstorm+OR+flood+alert+Muscat&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ],
    Trichy: [
      { url: 'https://news.google.com/rss/search?q=Trichy+weather+warning+OR+Tamil+Nadu+rain+alert+OR+IMD&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  shopping: {
    online: [
      { url: 'https://news.google.com/rss/search?q=Amazon+sale+OR+Flipkart+sale+OR+Myntra+sale+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=online+shopping+sale+discount+coupon+India+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=Chennai+sale+OR+T+Nagar+shopping+OR+Saravana+Stores+offer&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Muscat+Lulu+sale+OR+Oman+shopping+offer+discount&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ]
  },
  airlines: {
    global: [
      { url: 'https://news.google.com/rss/search?q=IndiGo+OR+Air+India+OR+Oman+Air+OR+SalamAir+fare+sale+booking+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  events: {
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=Chennai+upcoming+events+concert+exhibition+workshop+this+week&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Muscat+upcoming+events+concert+exhibition+this+month&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ],
    Trichy: [
      { url: 'https://news.google.com/rss/search?q=Trichy+events+exhibition+cultural+event+this+week&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  movies: {
    India: [
      { url: 'https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml', sourceType: 'cinema', trust: 'high' },
      { url: 'https://www.hindustantimes.com/feeds/rss/entertainment/bollywood/rssfeed.xml', sourceType: 'cinema', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=upcoming+movie+release+date+theatre+OTT+India+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  festivals: {
    India: [
      { url: 'https://www.timeanddate.com/holidays/india/feed', sourceType: 'calendar', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=India+public+holiday+OR+Pongal+OR+Diwali+OR+Republic+Day+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Oman: [
      { url: 'https://news.google.com/rss/search?q=Oman+public+holiday+OR+Eid+OR+National+Day+2025&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ]
  },
  civic: {
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=Chennai+metro+water+OR+TANGEDCO+OR+corporation+notice+OR+civic+body&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Muscat+municipality+OR+Oman+civic+announcement+OR+road+work&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ]
  }
});
```

### Change 2: Relax static host filter (line 174-176)

**BEFORE:**
```javascript
if (isStaticHost) {
    sources = sources.filter(s => s.priorityScore >= 3 || s.trust === 'high').slice(0, 2);
}
```

**AFTER:**
```javascript
if (isStaticHost) {
    sources = sources.filter(s => s.priorityScore >= 2 || s.trust !== 'low').slice(0, 3);
}
```

---

## File 2 of 2: `src/pages/UpAheadPage.jsx`

### Change: Add festivals location editor + fetch button

Find the festivals view (around line 383):
```javascript
{view === 'festivals' && <div className="ua-tab-view">...
```

**AFTER (replace the festivals view block):**
```jsx
{view === 'festivals' && (
  <div className="ua-tab-view">
    <ProgressBar active={loading || isRefreshing} />
    <div style={{display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center', padding:'8px'}}>
      {(settings.upAhead?.locations || ['Chennai','Muscat']).map(loc => (
        <span key={loc} className="ua-badge type-festival" style={{cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'4px'}}>
          {loc}
          <span onClick={() => {
            const locs = (settings.upAhead?.locations || []).filter(l => l !== loc);
            if (locs.length > 0) {
              const updated = { ...settings, upAhead: { ...settings.upAhead, locations: locs } };
              // Save via settings context if available
            }
          }} style={{opacity:0.7, cursor:'pointer'}}>✕</span>
        </span>
      ))}
      <button className="btn btn--secondary" style={{padding:'4px 12px', fontSize:'0.75rem'}}
        onClick={() => {
          const loc = prompt('Add location (e.g., Trichy, Dubai):');
          if (loc && loc.trim()) {
            const current = settings.upAhead?.locations || ['Chennai','Muscat'];
            if (!current.includes(loc.trim())) {
              current.push(loc.trim());
            }
          }
        }}>+ Add</button>
      <button className="btn btn--primary" style={{padding:'4px 12px', fontSize:'0.75rem'}}
        onClick={() => loadData({ forceRefresh: true })}>
        🔄 Fetch Festivals
      </button>
    </div>
    {renderEntertainmentStyleGrid(festivalCards, 'No festivals found. Tap "Fetch Festivals" to load.')}
  </div>
)}
```

---

## Benchmark Validation (NEW)

After implementing changes, wire the planner benchmark test (dev mode only):

Add after the view toggle buttons (line ~337):
```jsx
{import.meta.env.DEV && (
  <button onClick={async () => {
    const { runPlannerBenchmark } = await import('../benchmarks/runPlannerBenchmark.js');
    const results = await runPlannerBenchmark();
    alert(`Planner Benchmark: ${results.summary}`);
  }} style={{fontSize:'0.7rem', padding:'4px 8px', marginLeft:'8px'}}>
    🧪 Benchmark
  </button>
)}
```

### Acceptance Criteria
| Check | Target |
|-------|--------|
| Category classification | ≥90% |
| Location mapping (T.Nagar→Chennai etc.) | ≥95% |
| Date extraction | ≥90% |
| Eligibility accuracy | ≥90% |
| Noise filter | ≥90% |

---

## Deliverable
- `src/intelligence/feedSourceRegistry.js` — trust levels + queries + civic category + relaxed static filter
- `src/pages/UpAheadPage.jsx` — festivals location editor + fetch button + benchmark button

---

## QC Checklist

- [ ] Navigate to Up Ahead (`/up-ahead`)
- [ ] **Movies** — shows actual upcoming releases with dates, not old reviews
- [ ] **Events** — shows concerts/exhibitions, NOT empty
- [ ] **Offers** — shows Amazon/Flipkart sales, NOT empty
- [ ] **Alerts** — shows TANGEDCO/civic notices, NOT empty
- [ ] **Festivals** — shows upcoming holidays for Chennai and Muscat
- [ ] **Festivals** — location pills (Chennai ✕, Muscat ✕) are visible and removable
- [ ] **Festivals** — "+ Add" button prompts for new location
- [ ] **Festivals** — "Fetch Festivals" button triggers data refresh
- [ ] No items older than 7 days in timeline
- [ ] Console shows `[UpAheadService]` logs without errors

---

## Do NOT change
- `src/services/upAheadService.js`
- `src/config/settings_upahead.js`
- `src/intelligence/canonicalItemBuilder.js`
