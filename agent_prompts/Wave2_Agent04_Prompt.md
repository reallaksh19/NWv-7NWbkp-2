# WAVE 2 — Agent 04: Top Stories Quality Gate
> **Prerequisite:** Wave 1 (Agent 01) must be complete and verified.

# Role
You are a Senior Content Quality & Ranking Engineer.

# Context
You are working on NWv-7, a React-based news application. The Top Stories feed on the Main page is polluted with low-relevance content (Grammy guides, gaming articles, celebrity opinions) because there is no minimum impact score threshold.

# Mission
Implement the exact changes outlined in the Work Instruction below: add a `MIN_IMPACT = 2.5` quality gate inside `composeBalancedFeed` and prevent destructive section reclassification in `rssAggregator.js`.

# Critical Rules
- Search by function name `composeBalancedFeed`, NEVER by line number
- Do NOT add the temporal decay import — that is Agent 05's responsibility
- Do NOT delete any test files (*.test.js, *.spec.js)

---

# Work Instruction

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

### Change: Add quality threshold to `composeBalancedFeed`

> Search by function name `composeBalancedFeed` — do NOT use a line number; the file may have shifted.

Find the function `composeBalancedFeed`. Inside it, find the line that initializes `sorted` (it sorts by `impactScore`). It will look like:

```javascript
// Search for this pattern inside composeBalancedFeed:
const sorted = [...articles].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
```

**Replace the sort line and the `for` loop opener** with this block:

```javascript
// Quality gate: filter out low-relevance articles before sorting.
// Minimum score of 2.5 keeps breaking news while filtering celebrity filler.
// Safety: if fewer than 5 qualify, use top-scored from full list to avoid empty feed.
const MIN_IMPACT = 2.5;
const qualified  = articles.filter(a => (a.impactScore || 0) >= MIN_IMPACT);
const pool       = qualified.length >= 5
    ? qualified
    : [...articles].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0)).slice(0, limit * 2);

// NOTE: Agent 05 will later replace this sort with rankByTemporalScore(pool)
// Do NOT add that import here — it is Agent 05's responsibility.
const sorted = [...pool].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

for (const article of sorted) {
```

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
- **Do NOT add `import { rankByTemporalScore }` here** — that is Agent 05's responsibility
- **❌ DO NOT delete any test files (`*.test.js`, `*.spec.js`)**

## Rollback
If QC fails: `git checkout -- src/services/frontPageComposer.js src/services/rssAggregator.js`
