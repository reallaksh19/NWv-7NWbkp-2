# WI — Agent 08: Mobile Header + App Shell
**Sequence:** 8 of 10
**Prerequisite:** Agent 07 complete (CSS file already updated)
**Estimated changes:** ~65 lines across 2 files

---

## Objective
The current header is tall (multi-line), has a "📦 Static Host" badge that clutters the UI, and has no mobile shell constraint. Per the wish page design:
- Header: single-line, compact — globe icon + app name + refresh chip + settings icon
- App shell: `max-width: 480px` centered container

---

## Reference (from `Main and Insight idea.html`)
```css
.shell { max-width: 480px; margin: 0 auto; height: 100%; display: flex; flex-direction: column; }
.hdr { position: sticky; top: 0; z-index: 40; background: rgba(10,13,17,0.92); backdrop-filter: blur(22px); border-bottom: 1px solid var(--border); }
.hdr-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; }
.app-icon { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(145deg,#004d3d 0%,#00D4AA 55%,#58A6FF 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 12px rgba(0,212,170,0.35); }
.refresh-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--muted); padding: 3px 8px; border-radius: 999px; border: 1px solid var(--border); }
```

---

## File 1 of 2: `src/index.css`

### Change: Add shell + compact header CSS (append at very end of file, after Agent 07's additions)

```css
/* ════════════════════════════
   MOBILE SHELL + COMPACT HEADER
   ════════════════════════════ */

/* Mobile shell — constrains content to 480px on desktop */
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Compact header overrides */
.header--mobile {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(10, 13, 17, 0.92);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border-bottom: 1px solid rgba(48, 54, 61, 0.65);
}
.header--mobile .hdr-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  gap: 10px;
}
.header--mobile .hdr-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.hdr-app-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
  background: linear-gradient(145deg, #004d3d 0%, #00D4AA 55%, #58A6FF 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(0, 212, 170, 0.35);
  font-size: 18px;
}
.hdr-app-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #FFFFFF;
  white-space: nowrap;
}
.hdr-refresh-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.65rem;
  color: #9CA5B0;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(48, 54, 61, 0.65);
  background: rgba(255, 255, 255, 0.03);
  white-space: nowrap;
}
.hdr-refresh-chip .rdot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3FB950;
  box-shadow: 0 0 6px rgba(63, 185, 80, 0.7);
  animation: rdotpulse 2.5s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes rdotpulse { 50% { opacity: 0.4; transform: scale(0.8); } }
.hdr-right {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.hdr-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(48, 54, 61, 0.65);
  background: rgba(18, 23, 30, 0.6);
  color: #D0D7DE;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.hdr-icon-btn:hover { color: #00D4AA; border-color: rgba(0, 212, 170, 0.4); }

/* Hide the static host badge on mobile */
.runtime-badge { display: none !important; }
```

---

## File 2 of 2: `src/App.jsx`

### Change: Wrap the main router outlet in the `.app-shell` class

Find the outermost `<div>` wrapping all the routes/pages (around lines 45–55 in App.jsx). It likely looks like:
```jsx
<div className="app">
```
or
```jsx
<div id="root-inner">
```

**Replace that wrapper div's className** to add `app-shell`:
```jsx
<div className="app app-shell">
```

> If you can't find a single wrapper div, look for the `<RouterProvider>` or the div just inside `<HashRouter>`. Add `app-shell` as an additional class to whatever is the outermost content wrapper.

---

## Deliverable
- `src/index.css` — mobile shell + compact header CSS appended
- `src/App.jsx` — `app-shell` class added to root wrapper div

---

## QC Checklist

- [ ] On desktop browser: content appears centered in a ~480px column (not full width)
- [ ] Header is single-line height (approximately 52–54px tall)
- [ ] "📦 Static Host" badge is no longer visible
- [ ] Background behind header has a frosted glass blur effect
- [ ] App content (news cards, market data, etc.) is still fully readable
- [ ] On a real mobile device or browser dev tools at 390px width: content fills the screen
- [ ] Bottom nav remains at the bottom and doesn't overlap content
- [ ] No horizontal scroll bar appears

---

## Do NOT change
- `Header.jsx` internal JSX — only CSS and App.jsx wrapper class
- Bottom nav positioning
- Any page components
- Font imports in `index.html` — those stay as is
