/**
 * plannerUtils.js
 *
 * Five-concept boundary:
 *   1. Fetched slot     — Python only (slotMeta), never used here
 *   2. Current age      — client filter (Date.now() - publishedAt), not used here
 *   3. Event date       — eventStartAt / eventEndAt  ← this file operates on this
 *   4. Cache freshness  — file TTL, handled in upAheadService.js
 *   5. Item expiry      — expiryAt checked at render time (here)
 *
 * Planner sort formula:
 *   score = 0.30 * urgency  +  0.25 * locality  +  0.20 * dateConf
 *         + 0.15 * actionability  +  0.10 * severity
 */

const DAY = 86_400_000;

function startOfDay(ts) {
  const d = new Date(Number(ts));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── Expiry / visibility ───────────────────────────────────────────────────────

/**
 * Filter items that should be visible right now.
 * Expired items are hidden even when the cache is fresh.
 *
 * @param {object[]} items
 * @param {number}   [now]
 * @returns {object[]}
 */
export function filterVisiblePlannerItems(items, now = Date.now()) {
  const MAX_PUB_AGE_MS = 24 * DAY;
  return (items ?? []).filter((item) => {
    if (item.expiryAt && Number(item.expiryAt) < now) return false;
    if (item.plannerEligible === false) return false;
    // Exclude news-derived alerts older than 24 h — prevents stale articles surfacing
    if (item.pubDate) {
      const age = now - new Date(item.pubDate).getTime();
      if (age > MAX_PUB_AGE_MS) return false;
    }
    return true;
  });
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score a planner item for sort order.
 * Higher = more actionable / urgent / local.
 *
 * @param {object} item
 * @param {number} [now]
 * @returns {number}
 */
export function plannerScore(item, now = Date.now()) {
  const daysAhead     = Math.max(0, ((Number(item.eventStartAt) || now + DAY) - now) / DAY);
  const urgency       = 1 / (1 + daysAhead);

  const dateConfMap   = { exact: 1.0, range: 0.75, inferred: 0.5, unknown: 0.2 };
  const dateConf      = dateConfMap[item.dateConfidence] ?? 0.2;

  const locality      = Number(item.localityScore ?? 0.1);
  const severity      = { high: 0.3, medium: 0.15, low: 0 }[item.severity] ?? 0;
  const actionability = Number(item.actionabilityScore ?? 0.5);

  return (
    0.30 * urgency +
    0.25 * locality +
    0.20 * dateConf +
    0.15 * actionability +
    0.10 * severity
  );
}

/**
 * Sort items by plannerScore descending (highest urgency first).
 *
 * @param {object[]} items
 * @param {number}   [now]
 * @returns {object[]}
 */
export function sortPlannerItems(items, now = Date.now()) {
  return [...(items ?? [])].sort((a, b) => plannerScore(b, now) - plannerScore(a, now));
}

// ── Bucketing ─────────────────────────────────────────────────────────────────

/**
 * Bucket visible planner items into today / tomorrow / laterThisWeek / noConfirmedDate.
 * Expiry check is run first so expired items never appear in any bucket.
 *
 * @param {object[]} items
 * @param {number}   [now]
 * @returns {{ today: object[], tomorrow: object[], laterThisWeek: object[], noConfirmedDate: object[] }}
 */
export function bucketPlannerItems(items, now = Date.now()) {
  const today          = [];
  const tomorrow       = [];
  const laterThisWeek  = [];
  const noConfirmedDate = [];

  for (const item of filterVisiblePlannerItems(items, now)) {
    const start = item.eventStartAt;
    if (!start) {
      noConfirmedDate.push(item);
      continue;
    }
    const days = Math.floor((startOfDay(start) - startOfDay(now)) / DAY);
    if (days === 0) {
      today.push(item);
    } else if (days === 1) {
      tomorrow.push(item);
    } else if (days >= 2 && days <= 7) {
      laterThisWeek.push(item);
    }
    // days < 0 (past events) and days > 7 are intentionally dropped
  }

  return {
    today:           sortPlannerItems(today, now),
    tomorrow:        sortPlannerItems(tomorrow, now),
    laterThisWeek:   sortPlannerItems(laterThisWeek, now),
    noConfirmedDate: sortPlannerItems(noConfirmedDate, now),
  };
}
