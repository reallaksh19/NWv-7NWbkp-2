# NWv-7 Agent Master Sequence
## 10 Agent Work Instructions — Execution Order & Dependencies

> [!IMPORTANT]
> **Constraint:** App runs on static GitHub Pages. All fixes are client-side JavaScript only. No backend servers, no Node scripts, no Python.
> **Agent rule:** Each agent must NOT edit more than 200 lines total across all files.

---

## Execution Map

```
WAVE 1 (Must be first)
└── Agent 01: Nav & Routing ──────────────────────────────── unblocks ALL testing

WAVE 2 (Run in parallel after Agent 01)
├── Agent 02: Market Proxy Fallbacks
├── Agent 04: Top Stories Quality Gate
├── Agent 05: Insight Pipeline (embeddings + fetcher)
└── Agent 10: Up Ahead Feed Queries

WAVE 3 (Run after their prerequisites)
├── Agent 03: Market Commodities (needs Agent 02)
├── Agent 06: Insight Child Stories UI (needs Agent 05)
├── Agent 07: News Cards UI (needs Agent 01)
└── Agent 09: Market Lazy Load (needs Agent 02)

WAVE 4 (Final polish)
└── Agent 08: Mobile Shell + Header (needs Agent 07)
```

---

## Agent Summary Table

| # | Agent | Files Changed | Lines Changed | Prerequisite | Priority |
|---|-------|--------------|---------------|-------------|----------|
| 01 | Nav & Routing | BottomNav.jsx, App.jsx | ~25 | None | 🔴 CRITICAL |
| 02 | Market Proxy | indianMarketService.js | ~12 | Agent 01 | 🔴 CRITICAL |
| 03 | Market Commodities | indianMarketService.js | ~60 | Agent 02 | 🔴 CRITICAL |
| 04 | Top Stories Quality | frontPageComposer.js, rssAggregator.js | ~20 | Agent 01 | 🟡 HIGH |
| 05 | Insight Pipeline | embeddingsAdapter.js, newsFetcher.js | ~75 | Agent 01 | 🔴 CRITICAL |
| 06 | Insight Child UI | InsightPage.jsx | ~40 | Agent 05 | 🟡 HIGH |
| 07 | News Cards UI | NewsSection.jsx, index.css | ~55 | Agent 01 | 🟡 HIGH |
| 08 | Mobile Shell | index.css, App.jsx | ~65 | Agent 07 | 🟡 HIGH |
| 09 | Market Lazy Load | MarketContext.jsx, MarketPage.jsx | ~30 | Agent 02 | 🟢 MEDIUM |
| 10 | Up Ahead Feeds | feedSourceRegistry.js | ~50 | Agent 01 | 🟢 MEDIUM |

---

## Work Instruction Files

| Agent | File |
|-------|------|
| Agent 01 | [WI_Agent01_Nav_Routing.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent01_Nav_Routing.md) |
| Agent 02 | [WI_Agent02_Market_Proxy.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent02_Market_Proxy.md) |
| Agent 03 | [WI_Agent03_Market_Commodities.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent03_Market_Commodities.md) |
| Agent 04 | [WI_Agent04_TopStories_Quality.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent04_TopStories_Quality.md) |
| Agent 05 | [WI_Agent05_Insight_Pipeline.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent05_Insight_Pipeline.md) |
| Agent 06 | [WI_Agent06_Insight_UI.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent06_Insight_UI.md) |
| Agent 07 | [WI_Agent07_NewsCards_UI.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent07_NewsCards_UI.md) |
| Agent 08 | [WI_Agent08_MobileShell_Header.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent08_MobileShell_Header.md) |
| Agent 09 | [WI_Agent09_Market_LazyLoad.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent09_Market_LazyLoad.md) |
| Agent 10 | [WI_Agent10_UpAhead_Feeds.md](file:///C:/Users/reall/.gemini/antigravity/brain/1daae5e3-cc86-4008-a4ce-682b71803f86/artifacts/WI_Agent10_UpAhead_Feeds.md) |

---

## Global Rules for All Agents

1. **Run `npm run dev` before and after** — app must start without errors both times
2. **Do not change files outside your WI** — if you need to touch another file, stop and report
3. **Do not reformat or re-indent entire files** — only change the specific lines described
4. **If a line number doesn't match**, search for the described code by text content, not line number
5. **If a file doesn't exist**, stop and report — do not create it from scratch
6. **GitHub Pages constraint** — never suggest adding a backend server, API route, or server-side script

---

## Final Integration QC (Run after all agents complete)

```markdown
### Full App QC

Navigation
- [ ] 5 tabs: Main, Insight, Up Ahead, Planner, Market
- [ ] All tabs navigate without crash

Main / Top Stories
- [ ] Shows actual news (not award guides or celebrity fluff)  
- [ ] Cards show: source (blue), stars (gold), time, headline, summary
- [ ] Critics Take box appears on some cards (blue left border)
- [ ] Breaking badge appears on breaking news

Market
- [ ] NIFTY 50, SENSEX, BANK NIFTY, MIDCAP 150 values visible
- [ ] Global indices (S&P 500, NASDAQ) visible
- [ ] Commodities: Gold, Silver, Crude Oil with prices
- [ ] Currency: USD/INR, EUR/INR, GBP/INR
- [ ] Top Movers: gainers and losers list
- [ ] No CORS errors that block all data

Insight
- [ ] Loads clusters (not the "No Insights" empty state)
- [ ] Expanding a card shows readable headlines (not raw IDs)
- [ ] Signal score ring shows a number

Up Ahead / Planner
- [ ] Movies section shows upcoming releases
- [ ] Events section shows upcoming events (not old news)
- [ ] Planner shows items added from Up Ahead

Mobile View (test at 390px width)
- [ ] Content constrained in 480px shell (centered on desktop)
- [ ] Header is one-line, compact
- [ ] Bottom nav doesn't overlap content
- [ ] No horizontal scroll
```
