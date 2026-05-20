# WI — Agent 01: Navigation & Routing Fix
**Sequence:** 1 of 10 — DO THIS FIRST. All other agents depend on this.
**Estimated changes:** ~25 lines across 2 files.

---

## Objective
Users cannot reach the Market or Insight pages because they are missing from the bottom navigation bar. Fix the nav and wire up the missing route.

---

## Context
- The app uses `react-router-dom` with `HashRouter` (important for GitHub Pages)
- Routes are defined in `src/App.jsx`
- The bottom navigation is `src/components/BottomNav.jsx`
- `InsightPage` component exists at `src/pages/InsightPage.jsx` but has no route
- Current nav: Main, Up Ahead, Planner, Follow, More ← WRONG
- Target nav: Main, Insight, Up Ahead, Planner, Market ← per design

---

## File 1 of 2: `src/components/BottomNav.jsx`

**What to do:** Replace the entire `navItems` array (lines 9–15).

**BEFORE (current code):**
```jsx
const navItems = [
    { path: '/', label: 'Main', icon: '🏠' },
    { path: '/up-ahead', label: 'Up Ahead', icon: '🗓️' },
    { path: '/my-planner', label: 'Planner', icon: '📌' },
    { path: '/following', label: 'Follow', icon: '🧭' },
    { path: '/more', label: 'More', icon: '⋯' }
];
```

**AFTER (replace with this exactly):**
```jsx
const navItems = [
    { path: '/', label: 'Main', icon: '🏠' },
    { path: '/insight', label: 'Insight', icon: '📊' },
    { path: '/up-ahead', label: 'Up Ahead', icon: '🗓️' },
    { path: '/my-planner', label: 'Planner', icon: '📌' },
    { path: '/markets', label: 'Market', icon: '📈' },
];
```

> No other changes needed in this file.

---

## File 2 of 2: `src/App.jsx`

**What to do:** Add the `/insight` route. Find the block of `<Route>` elements (around lines 100–112) and add one new line.

**Find this line:**
```jsx
<Route path="/" element={<MainPage />} />
```

**Add immediately after it:**
```jsx
<Route path="/insight" element={<InsightPage />} />
```

**Verify:** `InsightPage` is already imported at the top of `App.jsx` (line 16):
```jsx
import InsightPage from './pages/InsightPage';
```
✅ No import change needed.

**Verify:** `/markets` route already exists (line 105):
```jsx
<Route path="/markets" element={<MarketPage />} />
```
✅ No change needed for Market route.

---

## Deliverable
- `src/components/BottomNav.jsx` — navItems array replaced
- `src/App.jsx` — one new `<Route>` line added

---

## QC Checklist (run `npm run dev` and check in browser)

- [ ] Bottom nav shows exactly 5 tabs: **Main, Insight, Up Ahead, Planner, Market**
- [ ] Clicking **Main** navigates to `/` — news feed loads
- [ ] Clicking **Insight** navigates to `/insight` — page renders (may show loading or empty state, no crash)
- [ ] Clicking **Up Ahead** navigates to `/up-ahead` — page renders
- [ ] Clicking **Planner** navigates to `/my-planner` — page renders
- [ ] Clicking **Market** navigates to `/markets` — page renders (may show loading, no crash)
- [ ] Active tab is highlighted in the nav
- [ ] No console error: `No routes matched location "/insight"`
- [ ] No console error: `No routes matched location "/markets"`
- [ ] Refreshing page on any tab keeps the correct tab active (HashRouter handles this)

---

## Do NOT change
- `src/pages/MorePage.jsx` — keep file, just no longer in nav
- `src/pages/FollowingPage.jsx` — keep file, just no longer in nav
- Any CSS files
- Any other routes in App.jsx
