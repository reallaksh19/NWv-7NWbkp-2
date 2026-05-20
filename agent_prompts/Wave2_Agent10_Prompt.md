# WAVE 2 — Agent 10: Up Ahead Feed Quality + Feed Health Monitor
> **Prerequisite:** Wave 1 (Agent 01) must be complete.

# Role
You are a Senior Feed Pipeline & Content Quality Engineer.

# Context
You are working on NWv-7, a React-based news application. The Up Ahead page has multiple empty categories on GitHub Pages because the static host filter aggressively prunes `trust: 'medium'` feeds — which includes ALL Google News search feeds.

# Mission
Implement the exact changes in the WI below: set all feed trust levels to `'high'`, relax the static host filter, create `feedHealthMonitor.js`, add festivals location editor, and integrate `recordFeedResult` calls.

# Critical Rules
- Search by function/variable name, NEVER by line number
- Do NOT modify `canonicalItemBuilder.js` or `settings_upahead.js`
- Do NOT restructure `upAheadService.js` — only add `recordFeedResult` calls
- Do NOT delete any test files

---

# Work Instruction

# WI — Agent 10: Up Ahead — Feed Quality + Feed Health Monitor + Static Host Fix
**Sequence:** 10 of 10
**Prerequisite:** None (can run in parallel with others after Agent 01)
**Estimated changes:** ~130 lines across 3 files + 1 new file

---

## Objective
1. Fix all feed trust levels so categories are not pruned on GitHub Pages (static host)
2. Improve RSS queries for better content relevance
3. Add a festivals location editor with live-fetch button
4. Add `feedHealthMonitor.js` — 24-hour rolling error-rate tracker that auto-demotes consistently failing feeds

---

## Context
- `src/intelligence/feedSourceRegistry.js` — on static host, `buildFeedFetchPlan` line filters out `trust: 'medium'` sources → ALL Google News search feeds vanish → entire categories are empty
- Fix: set ALL actionable feeds to `trust: 'high'` and relax the static host filter threshold

---

## File 1 of 3: `src/intelligence/feedSourceRegistry.js`

### Change 1 of 2: Replace `DEFAULT_FEED_SOURCE_REGISTRY` with corrected trust levels

Search for `DEFAULT_FEED_SOURCE_REGISTRY` (by name). **Replace the entire object** with:

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

### Change 2 of 2: Relax static host filter in `buildFeedFetchPlan`

Find the static host filter inside `buildFeedFetchPlan` (search for `isStaticHost`):
```javascript
// BEFORE (search for this pattern):
sources = sources.filter(s => s.priorityScore >= 3 || s.trust === 'high').slice(0, 2);

// AFTER:
sources = sources.filter(s => s.priorityScore >= 2 || s.trust !== 'low').slice(0, 3);
```

Then immediately after that filter, add the feed health weight filter:
```javascript
// Import at top of file (add if not present):
// import { getFeedWeight } from './feedHealthMonitor.js';

// After the trust filter:
sources = sources.filter(s => {
    try { return getFeedWeight(s.url) > 0; } catch { return true; } // fail-open if monitor unavailable
});
```

> Add `import { getFeedWeight } from './feedHealthMonitor.js';` at the top of `feedSourceRegistry.js` if not already present.

---

## File 2 of 3: `src/intelligence/feedHealthMonitor.js` — CREATE NEW FILE

```javascript
/**
 * feedHealthMonitor.js — Per-source error-rate tracker with auto-demotion.
 *
 * Tracks feed fetch success/failure over a 24-hour rolling window using localStorage.
 * Sources with >50% failure rate over that window are auto-demoted (weight = 0).
 * Auto-recovers: events older than 24h are pruned on each write.
 *
 * IMPORTANT: localStorage reads/writes are synchronous. Keep event arrays small
 * (capped at 50 events per URL) to prevent UI-thread blocking.
 */

const STORAGE_KEY   = 'nwv7_feed_health';
const WINDOW_MS     = 24 * 60 * 60 * 1000;  // 24-hour rolling window
const DEMOTE_THRESH = 0.5;                    // pause if failure rate > 50%
const MIN_SAMPLES   = 3;                      // need ≥3 attempts before judging
const MAX_EVENTS    = 50;                     // cap per URL to prevent localStorage bloat

function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
}

function saveStore(store) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch {} // Fail silently (storage quota exceeded, private browsing, etc.)
}

/**
 * Record a fetch result for a feed URL.
 * Call this after every RSS fetch attempt — success OR failure.
 * @param {string}  url      Feed URL (used as key)
 * @param {boolean} success  true if fetch returned ≥1 valid items, false otherwise
 */
export function recordFeedResult(url, success) {
    if (!url) return;
    const store = loadStore();
    const now   = Date.now();
    if (!store[url]) store[url] = { events: [] };
    store[url].events.push({ ts: now, ok: Boolean(success) });
    // Prune: keep only recent events within window, cap at MAX_EVENTS
    store[url].events = store[url].events
        .filter(e => now - e.ts < WINDOW_MS)
        .slice(-MAX_EVENTS);
    saveStore(store);
}

/**
 * Get the health weight for a feed URL.
 * @param {string} url  Feed URL
 * @returns {number}    1.0 = fully healthy, 0.0 = paused (>50% fail rate)
 */
export function getFeedWeight(url) {
    if (!url) return 1.0;
    const store  = loadStore();
    const entry  = store[url];
    if (!entry || entry.events.length < MIN_SAMPLES) return 1.0; // insufficient data → assume healthy

    const now    = Date.now();
    const recent = entry.events.filter(e => now - e.ts < WINDOW_MS);
    if (recent.length < MIN_SAMPLES) return 1.0;

    const failed = recent.filter(e => !e.ok).length;
    const rate   = failed / recent.length;

    if (rate > DEMOTE_THRESH) return 0.0;    // paused
    return Math.max(0.1, 1.0 - rate);        // proportional: 0% fail→1.0, 49% fail→0.51
}

/**
 * Debug helper — returns health report for all tracked URLs.
 * @returns {Array<{url, events, failRate, weight}>}
 */
export function getFeedHealthReport() {
    const store = loadStore();
    const now   = Date.now();
    return Object.entries(store).map(([url, entry]) => {
        const recent = entry.events.filter(e => now - e.ts < WINDOW_MS);
        const failed = recent.filter(e => !e.ok).length;
        const rate   = recent.length > 0 ? failed / recent.length : 0;
        return {
            url,
            events   : recent.length,
            failRate : rate.toFixed(2),
            weight   : getFeedWeight(url),
        };
    });
}
```

---

## File 3 of 3: `src/pages/UpAheadPage.jsx`

### Change: Add festivals location editor + fetch button

Find the festivals view block (search for `view === 'festivals'`). It will look like:
```jsx
{view === 'festivals' && <div ...>
```

**Replace the festivals view content** (the div inside the condition) with:
```jsx
{view === 'festivals' && (
  <div className="ua-tab-view">
    <ProgressBar active={loading || isRefreshing} />
    {/* Location pills + controls */}
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px',
                  alignItems: 'center', padding: '8px' }}>
      {(settings?.upAhead?.locations || ['Chennai', 'Muscat']).map(loc => (
        <span key={loc} className="ua-badge type-festival"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {loc}
          <span
            title={`Remove ${loc}`}
            style={{ opacity: 0.7, cursor: 'pointer', fontSize: '0.75rem' }}
            onClick={() => {
              const current = settings?.upAhead?.locations || ['Chennai', 'Muscat'];
              const next = current.filter(l => l !== loc);
              if (next.length > 0 && typeof updateSettings === 'function') {
                updateSettings({ ...settings, upAhead: { ...settings.upAhead, locations: next } });
              }
            }}
          >✕</span>
        </span>
      ))}
      <button className="btn btn--secondary"
        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
        onClick={() => {
          const loc = window.prompt('Add location (e.g. Trichy, Dubai):');
          if (!loc?.trim()) return;
          const current = settings?.upAhead?.locations || ['Chennai', 'Muscat'];
          if (!current.includes(loc.trim())) {
            const next = [...current, loc.trim()];
            if (typeof updateSettings === 'function') {
              updateSettings({ ...settings, upAhead: { ...settings.upAhead, locations: next } });
            }
          }
        }}>+ Add</button>
      <button className="btn btn--primary"
        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
        onClick={() => typeof loadData === 'function' && loadData({ forceRefresh: true })}>
        🔄 Fetch Festivals
      </button>
    </div>
    {renderEntertainmentStyleGrid(festivalCards, 'No festivals found. Tap "Fetch Festivals" to load.')}
  </div>
)}
```

> ⚠️ `updateSettings` and `loadData` are the names used in the existing component. If the actual function names differ (check the top of `UpAheadPage.jsx`), use the correct names. Do NOT hardcode `undefined` — if the function doesn't exist, wrap the call in `typeof fn === 'function' && fn()`.

---

## Integration: `recordFeedResult` calls in `upAheadService.js`

> This is an **additive integration** — you are only adding 2-line wrappers around existing fetch calls, not restructuring the file.

In `src/services/upAheadService.js`, add this import at the top (if not already present):
```javascript
import { recordFeedResult } from '../intelligence/feedHealthMonitor.js';
```

Find each place where an RSS feed is fetched and the result is checked. Wrap each with a `recordFeedResult` call:
```javascript
// Pattern to find (varies by exact code):
try {
    const items = await someRSSFetch(source.url);
    // ADD after successful fetch:
    recordFeedResult(source.url, items?.length > 0);
    return items;
} catch (err) {
    // ADD in catch block:
    recordFeedResult(source.url, false);
    return [];
}
```

> Only add `recordFeedResult` calls — do NOT change any existing fetch logic, parsing, or error handling.

---

## Deliverable
- `src/intelligence/feedSourceRegistry.js` — ALL trust levels set to 'high'; static host filter relaxed; feed health weight filter added
- `src/intelligence/feedHealthMonitor.js` — **NEW FILE** — rolling 24h error-rate tracker
- `src/pages/UpAheadPage.jsx` — festivals location editor + fetch button
- `src/services/upAheadService.js` — `recordFeedResult` calls added (additive only)

---

## QC Checklist

- [ ] Navigate to Up Ahead (`/up-ahead`)
- [ ] **Movies** — shows actual upcoming releases with dates, NOT old reviews
- [ ] **Events** — shows concerts/exhibitions, NOT empty on GitHub Pages
- [ ] **Offers** — shows Amazon/Flipkart sales, NOT empty
- [ ] **Alerts** — shows TANGEDCO/civic notices, NOT empty
- [ ] **Festivals** — location pills (Chennai ✕, Muscat ✕) are visible
- [ ] **Festivals** — clicking ✕ removes a location pill
- [ ] **Festivals** — "+ Add" button prompts and adds a new location
- [ ] **Festivals** — "🔄 Fetch Festivals" button triggers a data refresh
- [ ] No items older than 7 days in the timeline
- [ ] Console shows `[UpAheadService]` logs without errors
- [ ] **Feed Health:** DevTools → Application → Local Storage → `nwv7_feed_health` key appears after feeds load
- [ ] **Feed Health report:** In console run: `import('/src/intelligence/feedHealthMonitor.js').then(m => console.table(m.getFeedHealthReport()))` — shows per-source data
- [ ] **Auto-demotion:** Call `recordFeedResult('test-url', false)` 4 times → `getFeedWeight('test-url')` returns `0`

---

## Do NOT change
- `src/intelligence/canonicalItemBuilder.js`
- `src/config/settings_upahead.js`
- Any existing fetch logic or error handling in `upAheadService.js` — only ADD `recordFeedResult` calls
- **❌ DO NOT delete any test files (`*.test.js`, `*.spec.js`, benchmark files)**

## Rollback
If QC fails: `git checkout -- src/intelligence/feedSourceRegistry.js src/pages/UpAheadPage.jsx src/services/upAheadService.js`
(New file: `del src\intelligence\feedHealthMonitor.js`)
