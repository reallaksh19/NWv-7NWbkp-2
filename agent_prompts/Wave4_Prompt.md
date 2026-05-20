# WAVE 4 — Final Polish (Run last)

> **Prerequisite:** Agent 07 (Wave 3) must be complete. Agent 07 appends the NEWS CARD REVAMP CSS block to `index.css` — Agent 08 appends AFTER that block.

---

## Agent 08: Mobile Shell + Compact Header

# Role
You are a Senior Mobile UI & CSS Architecture Engineer.

# Context
You are working on NWv-7, a React-based news application. The app currently renders at full browser width on desktop, which looks stretched and unprofessional. The design spec calls for a 480px mobile-first shell centered on desktop, with a frosted-glass sticky header. Agent 07 has already added the ncard CSS system to `index.css` — you will append your CSS AFTER that block.

# Mission
Your task is to implement the exact changes outlined in the Work Instruction (WI) below. You will:
1. Append mobile shell + compact header CSS to `src/index.css` (after Agent 07's block)
2. Add the `app-shell` class to the outermost content wrapper div in `App.jsx`

# Execution Guidelines
1. **CSS Insertion Point:** Search for `/* NEWS CARD REVAMP` in `index.css` to find Agent 07's block. Append your CSS AFTER that entire section, at the very end of the file.
2. **App.jsx Identification:** The outermost div inside `<HashRouter>` is what you add `app-shell` to. Look for `<div className="app">` first, then `<div className="root-inner">`, then the div wrapping `<Routes>`. If none found, STOP and report the JSX structure.
3. **Do NOT add to HashRouter:** `app-shell` goes on a `<div>`, NOT on `<HashRouter>`, `<Routes>`, or `<Suspense>`.
4. **dvh not vh:** Use `100dvh` for `min-height` (accounts for mobile browser chrome).
5. **Verification:** Use the QC Checklist. Content must be 480px centered on desktop, full width on mobile, with frosted header.

# Critical Rules
- Search by comment text or class name, NEVER by line number
- Do NOT modify `Header.jsx` internal JSX — only CSS targeting
- Do NOT modify any existing CSS rules — only APPEND new CSS
- Do NOT delete any test files

---

# Work Instruction

# WI — Agent 08: Mobile Shell + Compact Header
**Sequence:** 8 of 10
**Prerequisite:** Agent 07 complete (CSS already updated by Agent 07)
**Estimated changes:** ~70 lines across 2 files

---

## Objective
1. Constrain app to a 480px mobile shell centered on desktop
2. Compact single-line header with app icon, name, refresh chip, and settings icon
3. Frosted-glass header background with sticky positioning

---

## Context
- `src/index.css` — append shell + header CSS after Agent 07's block (search for `/* NEWS CARD REVAMP` to find Agent 07's block end, then append after it)
- `src/App.jsx` — add `app-shell` class to the outermost content wrapper **inside** `<HashRouter>`, but NOT to `<HashRouter>` itself
- The `Header.jsx` component renders the existing header — do NOT edit its internal JSX; only add a CSS class to the wrapper

---

## File 1 of 2: `src/index.css`

Search for this comment in the file (added by Agent 07):
```css
/* ════════════════════════════════════════
   NEWS CARD REVAMP — ncard design system
```

Add the following block **after** the `/* NEWS CARD REVAMP */` section (at the very end of the file):

```css
/* ════════════════════════════════════════
   MOBILE SHELL + COMPACT HEADER
   ════════════════════════════════════════ */

/* Mobile shell — constrains content to 480px on desktop, fills screen on mobile */
.app-shell {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100dvh;          /* dvh: accounts for mobile browser chrome */
    display: flex;
    flex-direction: column;
    position: relative;
    overflow-x: hidden;          /* Prevents any stray horizontal scroll */
}

/* Compact header — sticky, frosted glass */
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
    min-height: 52px;            /* Consistent single-line height */
}
.header--mobile .hdr-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
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
    overflow: hidden;
    text-overflow: ellipsis;
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
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
}
.hdr-refresh-chip .rdot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #3FB950;
    box-shadow: 0 0 6px rgba(63, 185, 80, 0.7);
    animation: rdotpulse 2.5s ease-in-out infinite;
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
    flex-shrink: 0;
}
.hdr-icon-btn:hover { color: #00D4AA; border-color: rgba(0, 212, 170, 0.4); }

/* Ensure bottom nav does not overlap content */
.app-shell > *:last-child:not(nav):not(.bottom-nav) {
    padding-bottom: 70px;       /* Reserve space above bottom nav */
}

/* Global dark background fill outside the shell on wide screens */
body { background-color: #0A0D11; }
```

---

## File 2 of 2: `src/App.jsx`

### Change: Add `app-shell` class to root content wrapper

Open `src/App.jsx`. Find the outermost div **inside** the `<HashRouter>` (or `<Router>`) component. This is the div that wraps your routes/pages, NOT the Router itself.

Identification strategy — look for ONE of these patterns in sequence:
1. `<div className="app">` — most likely
2. `<div className="root-inner">` or `<div id="root-inner">`
3. The div immediately wrapping `<Routes>` or `<Switch>`

**Add `app-shell` to its className:**
```jsx
// BEFORE (whatever you find):
<div className="app">

// AFTER:
<div className="app app-shell">
```

If the wrapper already has `app-shell`, skip this step.

> ⚠️ Do NOT add `app-shell` to `<HashRouter>`, `<Routes>`, `<Suspense>`, or any inner page component. It must be on the single outermost wrapper div that contains the entire app layout (header + main content + bottom nav).

> ⚠️ If you cannot find a single clear wrapper div, **stop and report** the actual JSX structure of `App.jsx` instead of guessing.

---

## Deliverable
- `src/index.css` — mobile shell + compact header CSS appended after Agent 07's block
- `src/App.jsx` — `app-shell` class added to outermost content wrapper div

---

## QC Checklist

- [ ] On desktop at 1920px: content appears in a centered ~480px column with dark background on sides
- [ ] On mobile at 390px: content fills the full screen width
- [ ] Header is single-line height (~52px)
- [ ] "📦 Static Host" badge is NOT visible (hidden by Agent 07's CSS rule — verify it's still gone)
- [ ] Header has frosted glass blur effect when scrolling (scroll down — header stays visible with blur)
- [ ] App icon (gradient square with globe/icon) visible in header left
- [ ] App name visible next to icon
- [ ] Refresh chip with pulsing green dot visible in header
- [ ] Bottom nav does NOT overlap the last card in any section
- [ ] No horizontal scroll bar at any viewport width
- [ ] Content (news cards, market data, etc.) is fully readable within the shell
- [ ] `app-shell` class appears on exactly one element (verify in DevTools → Elements)

---

## Do NOT change
- `Header.jsx` internal JSX — only CSS class on its wrapper in App.jsx
- Bottom nav component or positioning
- Any page components
- Font imports in `index.html`
- Any existing CSS rules — only APPEND new CSS

## Rollback
If QC fails: `git checkout -- src/App.jsx src/index.css`
