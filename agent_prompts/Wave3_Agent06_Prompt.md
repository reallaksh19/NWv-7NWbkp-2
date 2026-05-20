# WAVE 3 — Agent 06: Insight — Fix Child Story Display + Empty State
> **Prerequisite:** Agent 05 (Wave 2) must be complete — pipeline must produce clusters first.

# Role
You are a Senior React UI Engineer specializing in data-driven component rendering.

# Context
You are working on NWv-7. The Insight page cluster expansion UI shows raw IDs like `ddg-3`, `rss-7` instead of readable headlines because the `ICard` component never resolves child IDs from the `storiesById` Map.

# Mission
Implement the exact changes in the WI below: pass `storiesById` Map from `InsightTab` to `ICard`, resolve child stories with O(1) Map lookup, make headlines clickable, add empty-state fallback.

# Critical Rules
- Use `Map.get(childId)`, NOT bracket notation
- Use `child.title` (InsightStory), NOT `child.canonicalHeadline` (InsightParent)
- Do NOT modify signal ring SVG, stats strip, or any CSS files

---

# Work Instruction

# WI — Agent 06: Insight — Fix Child Story Display + Empty State Handling
**Sequence:** 6 of 10
**Prerequisite:** Agent 05 complete (pipeline must produce clusters first)
**Estimated changes:** ~50 lines in 1 file

---

## Objective
When expanding an Insight cluster card:
1. Child Stories show raw IDs like `ddg-3`, `rss-7` instead of readable headlines — fix by using the `storiesById` Map
2. If the cluster loads but has 0 children, show a meaningful empty state instead of an empty list
3. Source column shows "Source" placeholder — fix to show actual source name

---

## Context
- File: `src/pages/InsightPage.jsx`
- The pipeline returns `result.storiesById` as a `Map<string, InsightStory>`. Use `.get(childId)` — O(1). Do NOT rebuild a lookup object from the `parents` array (it won't contain tier-C fallback stories).
- `InsightStory` fields: `title`, `source`, `sourceGroup`, `url`, `publishedAt`, `summary`
- `InsightParent` fields: `parentId`, `canonicalHeadline`, `childStoryIds`, `signalScore`, etc.
- Do NOT confuse `child.title` (InsightStory) with `parent.canonicalHeadline` (InsightParent)

---

## File: `src/pages/InsightPage.jsx`

### Change 1 of 3: Update `InsightTab` to extract `storiesById` Map

Search for the function `InsightTab` (by name — not line number). Inside it, find:
```javascript
const parents = result?.parents || [];
```

Add the following line **immediately after** it:
```javascript
// Use pipeline's Map directly — do NOT rebuild. Map contains ALL stories including tier-C fallbacks.
const storiesById = result?.storiesById instanceof Map ? result.storiesById : new Map();
```

Then find where `ICard` is rendered (search for `<ICard`). It will look like:
```jsx
{parents.map((p, i) => <ICard key={p.parentId} story={p} index={i} />)}
```

**Replace with:**
```jsx
{parents.map((p, i) => (
    <ICard key={p.parentId} story={p} index={i} storiesById={storiesById} />
))}
```

---

### Change 2 of 3: Update `ICard` to resolve child story data from Map

Find the function `ICard` (by name). Its signature will be:
```javascript
function ICard({ story, index }) {
```
**Replace signature with:**
```javascript
function ICard({ story, index, storiesById = new Map() }) {
```

Find the block inside `ICard` that renders child stories. It will contain `.map` over `story.childStoryIds` and currently renders raw `childId` text. Search for one of these patterns:
- `{childId}` 
- `Child {i+1}`
- `src-item`

**Replace the entire child stories map block** with:
```jsx
{(story.childStoryIds?.length > 0) ? (
    story.childStoryIds.map((childId, i) => {
        // O(1) Map lookup — storiesById contains ALL processed articles
        const child    = storiesById.get(childId);
        const headline = child?.title || child?.summary || childId; // childId as last-resort fallback (not crash)
        const source   = child?.source || child?.sourceGroup || 'Unknown';
        const url      = child?.url || null;
        return (
            <div key={childId} className="src-item">
                <span className="sname" title={source}>{source}</span>
                {url
                    ? <a className="sdesc" href={url} target="_blank" rel="noopener noreferrer"
                         onClick={e => e.stopPropagation()}>{headline}</a>
                    : <span className="sdesc">{headline}</span>
                }
                <span className="ang diff">Angle {i + 1}</span>
            </div>
        );
    })
) : (
    <div className="src-item" style={{ opacity: 0.5, fontStyle: 'italic' }}>
        <span className="sdesc">No additional angles found for this story</span>
    </div>
)}
```

---

### Change 3 of 3: Guard against undefined `childStoryIds`

Find the outer conditional that wraps the child stories section. It likely checks something like:
```jsx
{story.childStoryIds && story.childStoryIds.length > 0 && (
```

Ensure it is safe against `null`/`undefined`:
```jsx
{Array.isArray(story.childStoryIds) && (
```

> This removes the `length > 0` check because the map block in Change 2 already handles the empty case with a fallback message.

---

## Deliverable
- `src/pages/InsightPage.jsx` — `InsightTab` passes `storiesById`; `ICard` resolves headlines from Map; empty state added; links added for clickable articles

---

## QC Checklist

- [ ] Navigate to Insight tab (`/insight`)
- [ ] Wait for clusters to load (10–30 seconds)
- [ ] Click `+` on any cluster card to expand
- [ ] **Key test:** Child stories show readable headlines — NOT raw IDs like `ddg-3` or `rss-7`
- [ ] Source column shows a recognizable source name (e.g. "ndtv", "thehindu") — NOT "Source"
- [ ] "Angle 1", "Angle 2" labels appear next to each child story
- [ ] Child story headline is a clickable link if URL is available — clicking opens in new tab
- [ ] If a cluster has 0 children, shows "No additional angles found for this story" message
- [ ] If a child story ID is not in `storiesById`, shows the ID as fallback text — NOT a crash
- [ ] No console error: `storiesById.get is not a function`
- [ ] No console error: `Cannot read properties of undefined (reading 'map')`
- [ ] `InsightTab` receives `storiesById` as instanceof Map (not plain object)

---

## Do NOT change
- The signal ring SVG rendering
- The stats strip (Ranked, Stories counts)
- `EmptyState` component
- `InsightPage` default export function
- Any CSS or style files — only JSX changes

## Rollback
If QC fails: `git checkout -- src/pages/InsightPage.jsx`
