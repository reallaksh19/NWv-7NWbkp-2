# WI — Agent 06: Insight — Fix Child Story Display
**Sequence:** 6 of 10
**Prerequisite:** Agent 05 complete (pipeline must produce clusters first)
**Estimated changes:** ~35 lines in 1 file

---

## Objective
When expanding an Insight card, Child Stories section shows raw IDs like `ddg-3`, `rss-7` instead of actual headlines. Fix so it shows readable story titles and source names.

---

## Context
- File: `src/pages/InsightPage.jsx`
- The `ICard` component (line 8) receives a `story` prop which has `childStoryIds` (array of string IDs)
- The `InsightTab` component (line 64) has access to `result`
- **CRITICAL (Audit v3 Fix):** The pipeline returns `result.storiesById` as a `Map<string, InsightStory>`. Use this Map DIRECTLY — do NOT rebuild a manual lookup object. The Map contains ALL processed stories including tier-C fallbacks that are NOT in the parents array.

---

## File: `src/pages/InsightPage.jsx`

### Change 1 of 2: Update `InsightTab` to pass `storiesById` Map down

**BEFORE (lines 64–65):**
```javascript
function InsightTab({ result }) {
  const parents = result?.parents || [];
```

**AFTER:**
```javascript
function InsightTab({ result }) {
  const parents = result?.parents || [];
  // USE the pipeline's Map directly — do NOT rebuild (audit v3 fix)
  const storiesById = result?.storiesById || new Map();
```

Then find the map call at line 106:
```javascript
{parents.map((p, i) => <ICard key={p.parentId} story={p} index={i} />)}
```
Replace with:
```javascript
{parents.map((p, i) => <ICard key={p.parentId} story={p} index={i} storiesById={storiesById} />)}
```

---

### Change 2 of 2: Update `ICard` to use `storiesById` Map

**BEFORE (line 8):**
```javascript
function ICard({ story, index }) {
```

**AFTER:**
```javascript
function ICard({ story, index, storiesById = new Map() }) {
```

**BEFORE (lines 44–55 — the child stories rendering block):**
```jsx
story.childStoryIds.map((childId, i) => (
   <div key={i} className="src-item">
     <span className="sname">Child {i+1}</span>
     <span className="sdesc">{childId}</span>
     <span className="ang diff">Sub-angle</span>
   </div>
))
```

**AFTER:**
```jsx
story.childStoryIds.map((childId, i) => {
   // Use Map.get() for O(1) lookup (audit v3 fix)
   const child = storiesById.get(childId);
   const headline = child?.title || child?.canonicalText || childId;
   const source = child?.source || child?.sourceGroup || 'Source';
   return (
     <div key={i} className="src-item">
       <span className="sname">{source}</span>
       <span className="sdesc">{headline}</span>
       <span className="ang diff">Angle {i + 1}</span>
     </div>
   );
})
```

> **Note:** `storiesById` contains `InsightStory` objects with fields `title`, `source`, `sourceGroup` — NOT `canonicalHeadline`. The `canonicalHeadline` field is on `InsightParent` objects only.

---

## Deliverable
- `src/pages/InsightPage.jsx` — `ICard` and `InsightTab` updated

---

## QC Checklist

- [ ] Navigate to Insight tab (`/insight`)
- [ ] Wait for clusters to load
- [ ] Click the `+` button on any cluster card to expand it
- [ ] **Key test:** Under "Related Angles", stories show readable headlines — NOT raw IDs like `ddg-3`
- [ ] If a child story's data is not in the Map, it shows the ID as fallback (not crash)
- [ ] Source column shows a recognizable source name
- [ ] "Angle 1", "Angle 2" labels appear next to each child story
- [ ] No console error: `storiesById.get is not a function`

---

## Do NOT change
- The signal ring SVG (lines 71–84)
- The stats strip (lines 95–101)
- `EmptyState` component
- `InsightPage` default export function
- Any CSS or style files
