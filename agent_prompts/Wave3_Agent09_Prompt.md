# WAVE 3 — Agent 09: Market — Lazy Load + IndexedDB + Service Worker + Alerts
> **Prerequisite:** Agent 02 (Wave 2) must be complete.

# Role
You are a Senior Browser Platform Engineer specializing in Web APIs (IndexedDB, Service Workers, Web Workers).

# Context
NWv-7, React news app on static GitHub Pages. Market page fetches data on every app load — wasting CORS proxy quota. Cache uses localStorage (5KB limit). No offline support or price alerts.

# Mission
Implement exact WI changes: lazy boot, IndexedDB cache, Service Worker, Web Worker price alerts.

# Critical Rules
- Check `src/registerSW.js` before adding duplicate SW registration
- Keep `loading` initial state as `true` — do NOT change to `false`
- SW production only: `import.meta.env.PROD`
- Search by function name, NEVER by line number

# Work Instruction
Execute `C:\Code3\NWv-7\agent_instructions\WI_Agent09_Market_LazyLoad.md` — read the file first, then implement every change exactly as specified.
