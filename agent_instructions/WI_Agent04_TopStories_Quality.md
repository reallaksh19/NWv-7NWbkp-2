# WI — Agent 04: Top Stories — Quality Gate
**Sequence:** 4 of 10
**Prerequisite:** Agent 01 complete
**Estimated changes:** ~20 lines across 2 files

---

## Objective
Top Stories shows random BBC articles ("Grammy Awards 2026: How to watch", "New PlayStation exclusive", etc.) instead of actual breaking/high-priority news. Fix by:
1. Adding a minimum impact score threshold before articles enter the front page
2. Preventing articles from being misclassified into wrong sections

---

## File 1 of 2: `src/services/frontPageComposer.js`

### Change: Add quality threshold at the top of `composeBalancedFeed` (line 5)

**BEFORE (lines 5–13):**
```javascript
export function composeBalancedFeed(articles, limit = 20, maxTopicPercent = 40, maxGeoPercent = 30) {
    const selected = [];
    const topicCounts = new Map();
    const geoCounts = new Map();

    // Sort by impact score (highest first)
    const sorted = [...articles].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

    for (const article of sorted) {
```

**AFTER (replace lines 5–15 with this):**
```javascript
export function composeBalancedFeed(articles, limit = 20, maxTopicPercent = 40, maxGeoPercent = 30) {
    const selected = [];
    const topicCounts = new Map();
    const geoCounts = new Map();

    // Quality gate: only articles above minimum impact score qualify for front page
    // This prevents low-relevance filler (e.g. award show guides, celebrity gossip) 
    // from appearing in Top Stories. Minimum score of 2.5 keeps breaking news in.
    const MIN_IMPACT = 2.5;
    const qualified = articles.filter(a => (a.impactScore || 0) >= MIN_IMPACT);
    // Safety: if fewer than 5 qualify (e.g. no news loaded yet), use top scored from full list
    const pool = qualified.length >= 5
        ? qualified
        : [...articles].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0)).slice(0, limit * 2);

    // Sort by impact score (highest first)
    const sorted = [...pool].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

    for (const article of sorted) {
```

> This adds 9 lines and changes `sorted` to sort `pool` instead of `articles`. Everything else in the file stays the same.

---

## File 2 of 2: `src/services/rssAggregator.js`

### Change: Prevent destructive section reclassification (line 654)

The `classifySection` function detects keywords in article text and moves articles to a different section. This means a BBC World article about "stock markets crashing" gets moved to "business" and disappears from World news.

**Find line 654 (inside `normalizeItem` function):**
```javascript
const finalSection = detectedSection || section;
```

**Replace with:**
```javascript
// Only reclassify if the original feed section is 'general' (unclassified).
// Otherwise keep the feed's original section to prevent cross-section drift.
const finalSection = (section === 'general' && detectedSection) ? detectedSection : section;
```

> 1 line replaced with 3 lines (including comment). No other changes.

---

## Deliverable
- `src/services/frontPageComposer.js` — quality gate added to `composeBalancedFeed`
- `src/services/rssAggregator.js` — section classification is non-destructive

---

## QC Checklist

- [ ] Run `npm run dev`, navigate to Main page (`/`)
- [ ] Top Stories section appears with articles
- [ ] **Spot check:** None of the top 5 stories are "how to watch", award guides, or celebrity opinions
- [ ] Top stories should include news types like: war/conflict, government decisions, natural disasters, major economic events, local breaking news
- [ ] If fewer than 5 stories appear in Top Stories, check console — should see `[Composer]` log with `total` count
- [ ] World section should contain world news, not be empty because articles were reclassified
- [ ] No JavaScript errors in console

---

## Do NOT change
- `extractGeography()` function in `frontPageComposer.js`
- Any scoring functions in `rssAggregator.js`
- `composeBalancedFeed` arguments/signature — only internal logic changes
