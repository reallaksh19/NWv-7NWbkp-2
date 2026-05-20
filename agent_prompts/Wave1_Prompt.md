# WAVE 1 — Foundation (Run First, Solo)

## Agent 01: Navigation & Routing Fix

# Role
You are a Senior React Router & Navigation Architect.

# Context
You are working on NWv-7, a React-based news application designed to run entirely on static GitHub Pages. The application uses a bottom navigation bar for mobile. The current routing implementation is missing the `/insight` route, and two pages (Market, Insight) are unreachable from the nav.

# Mission
Your task is to implement the exact changes outlined in the Work Instruction (WI) below. This is the foundational WI — all other agents depend on navigation working correctly.

# Execution Guidelines
1. **Strict WI Adherence:** Follow the attached WI exactly. Do not over-engineer or rewrite surrounding code unless specified.
2. **Static Host Awareness:** This app runs on GitHub Pages (static host). Client-side routing uses `HashRouter` — NEVER change it to `BrowserRouter`.
3. **ErrorBoundary:** You must add the ErrorBoundary class component wrapping every route. This prevents one broken page from blanking the entire app. Ensure `React` is in scope for class components.
4. **Active Tab Fix:** The root path `/` must use exact matching to prevent it from highlighting when on `/insight`, `/markets`, etc.
5. **Verification:** Use the QC Checklist in the WI to verify your work. You must achieve 100% compliance.
6. **Beyond 100%:** Once verified, propose 1-2 enhancements (e.g., route-based code splitting with `React.lazy`) — propose only, do not implement.

# Critical Rules
- Search by function/variable name, NEVER by line number (line numbers drift between agent runs)
- Do NOT delete any test files (*.test.js, *.spec.js)
- If the `InsightPage` import does not exist in App.jsx, ADD it — do not skip

---

# Work Instruction

# WI — Agent 01: Navigation & Routing Fix
**Sequence:** 1 of 10 — DO THIS FIRST. All other agents depend on this.
**Estimated changes:** ~50 lines across 2–3 files

---

## Objective
1. Wire the 5-tab navigation (Main, Insight, Up Ahead, Planner, Market)
2. Add the missing `/insight` route to the router
3. Wrap each route in an `ErrorBoundary` so a crash in one page never blanks the entire app

---

## Context
- App uses `react-router-dom` with `HashRouter` (critical for GitHub Pages — never change to BrowserRouter)
- Routes are in `src/App.jsx`
- Bottom nav is `src/components/BottomNav.jsx`
- `InsightPage` component exists at `src/pages/InsightPage.jsx` — **confirm this file exists before proceeding**
- Current nav items include `/following` and `/more` — these must be removed from nav (keep the page files)

---

## File 1 of 3: `src/components/BottomNav.jsx`

### Change: Replace navItems array

Search for the `navItems` array by text (do NOT rely on line number — it may have shifted):
```javascript
const navItems = [
```

**Replace the entire navItems array** with:
```jsx
const navItems = [
    { path: '/', label: 'Main', icon: '🏠' },
    { path: '/insight', label: 'Insight', icon: '📊' },
    { path: '/up-ahead', label: 'Up Ahead', icon: '🗓️' },
    { path: '/my-planner', label: 'Planner', icon: '📌' },
    { path: '/markets', label: 'Market', icon: '📈' },
];
```

> No other changes in this file.

---

## File 2 of 3: `src/App.jsx`

### Change 1 of 2: Add ErrorBoundary component

Add this class at the **very top of `src/App.jsx`**, before any imports of pages:

```jsx
// ── ErrorBoundary: prevents one page crash from blanking the entire app ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px 16px', textAlign: 'center',
          color: '#9CA5B0', fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
          <strong style={{ color: '#D0D7DE' }}>This page encountered an error</strong>
          <p style={{ fontSize: '0.82rem', marginTop: '8px' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '12px', padding: '6px 16px', borderRadius: '8px',
              border: '1px solid rgba(48,54,61,0.65)', background: 'rgba(18,23,30,0.6)',
              color: '#D0D7DE', cursor: 'pointer', fontSize: '0.82rem'
            }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

> `React` must be in scope. If `App.jsx` uses `import React from 'react'`, it's fine. If it only uses named imports (`import { useState } from 'react'`), add `React` to the import: `import React, { useState, ... } from 'react'`.

### Change 2 of 2: Add /insight route + wrap routes in ErrorBoundary

Find the `<Route path="/" ...>` line inside the `<Routes>` block.

**BEFORE (existing route block — exact text may vary):**
```jsx
<Route path="/" element={<MainPage />} />
```

**AFTER (add insight route immediately after, and wrap EACH route in ErrorBoundary):**
```jsx
<Route path="/" element={<ErrorBoundary><MainPage /></ErrorBoundary>} />
<Route path="/insight" element={<ErrorBoundary><InsightPage /></ErrorBoundary>} />
<Route path="/markets" element={<ErrorBoundary><MarketPage /></ErrorBoundary>} />
<Route path="/up-ahead" element={<ErrorBoundary><UpAheadPage /></ErrorBoundary>} />
<Route path="/my-planner" element={<ErrorBoundary><PlannerPage /></ErrorBoundary>} />
```

> ⚠️ Only wrap routes in `ErrorBoundary` — do NOT wrap `<Routes>` itself or `<HashRouter>`.
> ⚠️ Do NOT remove any other existing routes (e.g., `/following`, `/more`) — just don't add them to the nav.

**Verify `InsightPage` is imported** — search the top of `App.jsx` for:
```jsx
import InsightPage from './pages/InsightPage';
```
If it is NOT present, add it alongside the other page imports. If it IS present, leave it unchanged.

---

## File 3 of 3: `src/components/BottomNav.jsx` — active state guard

Find the active-tab logic. It typically looks like:
```jsx
className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
```

If using `NavLink`, this is automatic. If using manual `location.pathname === item.path`, ensure the Main tab (`/`) uses **exact** matching:
```jsx
const isActive = item.path === '/'
  ? location.pathname === '/'
  : location.pathname.startsWith(item.path);
```

> This prevents "/" matching `/insight`, `/markets`, etc. as "active".

---

## Deliverable
- `src/components/BottomNav.jsx` — navItems array replaced + active tab fix
- `src/App.jsx` — `ErrorBoundary` class added + `/insight` route added + all routes wrapped

---

## QC Checklist

- [ ] Bottom nav shows exactly 5 tabs: **Main, Insight, Up Ahead, Planner, Market**
- [ ] Clicking each tab navigates to its page without crash
- [ ] Active tab is highlighted — **only one tab** is highlighted at a time
- [ ] Main tab is NOT highlighted when on `/insight`
- [ ] Refreshing at `/#/markets` keeps Market tab active (HashRouter deep-link test)
- [ ] No console error: `No routes matched location "/insight"`
- [ ] **ErrorBoundary test:** In browser console, run: `throw new Error('EB test')` — page should not go blank; ErrorBoundary should catch and show retry button
- [ ] No console error: `React is not defined` (ErrorBoundary requires React in scope)
- [ ] `InsightPage` import exists in `App.jsx` (check Network tab — `InsightPage` chunk loads when clicking Insight)

---

## Do NOT change
- `src/pages/MorePage.jsx` — keep file, just removed from nav
- `src/pages/FollowingPage.jsx` — keep file, just removed from nav
- `HashRouter` → do NOT change to `BrowserRouter` (breaks GitHub Pages)
- Any CSS files
- Any routes beyond the ones listed above

## Rollback
If QC fails: `git checkout -- src/components/BottomNav.jsx src/App.jsx`
