# WI — Agent 07: News Cards UI — Stars + ncard Design
**Sequence:** 7 of 10
**Prerequisite:** Agent 01 complete
**Estimated changes:** ~55 lines across 2 files

---

## Objective
News cards on the Main page are functional but plain. The wish page design shows:
- Source name (blue, monospace)
- Star rating (gold, based on impact score)
- Time ago (muted, monospace)
- `#N Sources` badge
- Article headline (bold, `text-wrap: pretty`)
- 2-line summary
- Critics Take (blue accent box, only when available)

---

## Reference Design (from `Main and Insight idea.html` CSS lines 185–204)
These CSS classes are the target design:
```
.ncard — card container
.nmeta — source + stars + time row
.nsrc — source name (blue, monospace)
.nstars — star rating (gold)
.ntime — time ago (muted)
.nsrccnt — source count badge
.ntag.breaking / .ntag.trending — badges
.ncritics — critics take box (blue left border)
```

---

## File 1 of 2: `src/index.css`

### Change: Add the ncard CSS design system (add at the very end of the file)

**Open `src/index.css` and add these lines at the very bottom:**
```css
/* ════════════════════════════
   NEWS CARD REVAMP (ncard style)
   ════════════════════════════ */
.modern-news-card {
  padding: 13px 14px 14px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(22,27,34,0.6), rgba(14,18,24,0.6));
  border: 1px solid rgba(48,54,61,0.65);
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color 0.18s, transform 0.18s;
}
.modern-news-card:hover {
  border-color: rgba(0,212,170,0.35);
  transform: translateY(-1px);
}
.mnc-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.mnc-source {
  font-size: 0.72rem;
  font-weight: 600;
  color: #58A6FF;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.mnc-stars {
  color: #F0883E;
  font-size: 0.65rem;
  letter-spacing: -1px;
}
.mnc-time {
  font-size: 0.7rem;
  color: #9CA5B0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  margin-left: auto;
}
.mnc-headline {
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.005em;
  text-wrap: pretty;
}
.mnc-summary {
  margin-top: 6px;
  font-size: 0.83rem;
  color: #D0D7DE;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mnc-critics {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(88,166,255,0.07);
  border-left: 2px solid rgba(88,166,255,0.5);
  font-size: 0.78rem;
  color: #D0D7DE;
  line-height: 1.4;
}
.mnc-critics strong { color: #58A6FF; font-weight: 600; }
.mnc-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }
.mnc-badge {
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; padding: 2px 7px; border-radius: 999px;
}
.mnc-badge--breaking { background: rgba(255,71,87,0.14); color: #ff8c96; border: 1px solid rgba(255,71,87,0.35); }
.mnc-badge--trending { background: rgba(240,136,62,0.14); color: #f0b070; border: 1px solid rgba(240,136,62,0.35); }
.mnc-badge--consensus { background: rgba(255,255,255,0.04); color: #9CA5B0; border: 1px solid rgba(255,255,255,0.06); font-family: 'JetBrains Mono', monospace; }
```

---

## File 2 of 2: `src/components/NewsSection.jsx`

### Change: Add star rating to the card header (add after line 121)

**Find this block (lines 120–136):**
```jsx
<div className="mnc-header">
    <span className="mnc-source" title={item.source}>{sourceLabel}</span>
    <div className="mnc-actions">
        <span className="mnc-time">{getTimeAgo(item.publishedAt) || item.time}</span>
        <button
            type="button"
            className="info-icon info-icon--story"
            title="Story info"
            onClick={(e) => {
                e.stopPropagation();
                handleInfoClick(item, hasScoreBreakdown);
            }}
        >
            ⓘ
        </button>
    </div>
</div>
```

**AFTER (replace entire block):**
```jsx
<div className="mnc-header">
    <span className="mnc-source" title={item.source}>{sourceLabel}</span>
    <span className="mnc-stars" aria-label="impact rating">
        {(() => {
            const score = item.impactScore || 0;
            const stars = score >= 15 ? 5 : score >= 10 ? 4 : score >= 6 ? 3 : score >= 3 ? 2 : 1;
            return '★'.repeat(stars) + '☆'.repeat(5 - stars);
        })()}
    </span>
    {item.sourceCount > 1 && (
        <span className="mnc-badge mnc-badge--consensus">#{item.sourceCount} Sources</span>
    )}
    <span className="mnc-time">{getTimeAgo(item.publishedAt) || item.time}</span>
    <button
        type="button"
        className="info-icon info-icon--story"
        title="Story info"
        onClick={(e) => { e.stopPropagation(); handleInfoClick(item, hasScoreBreakdown); }}
    >ⓘ</button>
</div>
```

---

## Deliverable
- `src/index.css` — ncard CSS added at end of file
- `src/components/NewsSection.jsx` — star rating added to card header

---

## QC Checklist

- [ ] Navigate to Main page (`/`)
- [ ] News cards show: **blue source name**, **gold stars**, **muted time**, **headline**, **2-line summary**
- [ ] Cards with `sourceCount > 1` show a `#N Sources` badge
- [ ] Cards with `criticsView` text show a blue-bordered critics box below the summary
- [ ] Breaking news cards show red `⚡ Breaking` badge
- [ ] Hovering a card shows a subtle `translateY(-1px)` lift with teal border
- [ ] Stars range from 1–5 depending on impact score (high-impact stories show 4–5 stars)
- [ ] No layout overflow — cards don't break out of the container width
- [ ] Looks good on mobile width (< 480px)

---

## Do NOT change
- Any logic in `NewsSection.jsx` (only the JSX template for the card header)
- Any existing CSS classes (only ADD new classes at end of `index.css`)
- `MarketPage.jsx`, `InsightPage.jsx`, or any other pages
