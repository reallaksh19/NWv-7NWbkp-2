// ─────────────────────────────────────────────
//  INSIGHT TAB — Cache Manager
// ─────────────────────────────────────────────

import {
  SnapshotSlot,
  SnapshotCacheEntry,
  InsightStory,
  InsightParent,
  InsightConfig,
} from "../types";

// ── In-process store (swap for Redis/DB in production) ───────────────────────

const store = new Map<SnapshotSlot, SnapshotCacheEntry>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the cache entry for a slot if it is still valid within
 * the tolerance window, applying a stale penalty to story freshness
 * scores if the entry is over the ideal age but within tolerance.
 */
export function getCachedSlot(
  slot: SnapshotSlot,
  cfg: InsightConfig
): SnapshotCacheEntry | null {
  if (slot === "now") return null; // "now" is never cached

  const entry = store.get(slot);
  if (!entry) return null;

  const ageMs   = Date.now() - entry.fetchedAt;
  const ttl     = cfg.CACHE_TTL[slot];
  const tol     = cfg.CACHE_TOLERANCE[slot];

  // Expired beyond TTL + tolerance → stale, reject
  if (ageMs > ttl + tol) return null;

  // Within tolerance but past TTL → apply stale penalty to stories
  if (ageMs > ttl) {
    const hoursOver = (ageMs - ttl) / (60 * 60 * 1000);
    const penalty   = hoursOver * cfg.STALE_PENALTY_PER_HOUR;
    return {
      ...entry,
      stories: entry.stories.map(s => ({
        ...s,
        freshnessScore: Math.max(0, s.freshnessScore - penalty),
      })),
    };
  }

  return entry;
}

/**
 * Write a fetched set of stories (and optionally full parent results)
 * back into the cache for a given slot.
 */
export function setCachedSlot(
  slot: SnapshotSlot,
  stories: InsightStory[],
  cfg: InsightConfig,
  parents?: InsightParent[]
): void {
  store.set(slot, {
    slot,
    fetchedAt: Date.now(),
    stories,
    parents,
    ttlMs: cfg.CACHE_TTL[slot],
  });
}

/**
 * Invalidate a specific slot (force re-fetch on next run).
 */
export function invalidateSlot(slot: SnapshotSlot): void {
  store.delete(slot);
}

/**
 * Returns which slots need a fresh fetch:
 *  - "now" always
 *  - others only if cache is absent or expired
 */
export function slotsNeedingFetch(cfg: InsightConfig): SnapshotSlot[] {
  const all: SnapshotSlot[] = ["now", "minus4h", "minus12h", "minus24h"];
  return all.filter(slot => slot === "now" || getCachedSlot(slot, cfg) === null);
}

/**
 * Determines if a slot's cache is within the pre-warm window
 * (i.e., not yet expired but approaching TTL expiry).
 * Used to trigger background refresh before the user sees a stale load.
 */
export function needsPrewarm(slot: SnapshotSlot, cfg: InsightConfig): boolean {
  if (slot === "now") return false;
  const entry = store.get(slot);
  if (!entry) return false;
  const ageMs = Date.now() - entry.fetchedAt;
  const prewarmAt = cfg.CACHE_TTL[slot] - cfg.PREWARM_BEFORE_TTL_MS;
  return ageMs >= prewarmAt && ageMs < cfg.CACHE_TTL[slot];
}

/**
 * Assembles all available stories across slots — using cache where valid,
 * accepting fresh-fetched stories for expired slots.
 * Stories are tagged with their capturedAtSnapshot.
 */
export function mergeSlotStories(
  freshBySlot: Partial<Record<SnapshotSlot, InsightStory[]>>,
  cfg: InsightConfig
): InsightStory[] {
  const all: InsightStory[] = [];
  const slots: SnapshotSlot[] = ["now", "minus4h", "minus12h", "minus24h"];

  for (const slot of slots) {
    if (freshBySlot[slot]) {
      // Fresh fetch result — tag and store
      const tagged = freshBySlot[slot]!.map(s => ({ ...s, capturedAtSnapshot: slot }));
      if (slot !== "now") setCachedSlot(slot, tagged, cfg);
      all.push(...tagged);
    } else {
      // Use cache
      const cached = getCachedSlot(slot, cfg);
      if (cached) all.push(...cached.stories);
    }
  }

  return all;
}

/**
 * Returns a diagnostic snapshot of cache health across all slots.
 */
export function cacheStatus(cfg: InsightConfig): Record<SnapshotSlot, {
  hit: boolean;
  ageMinutes: number | null;
  stale: boolean;
}> {
  const slots: SnapshotSlot[] = ["now", "minus4h", "minus12h", "minus24h"];
  const result = {} as ReturnType<typeof cacheStatus>;

  for (const slot of slots) {
    const entry = store.get(slot);
    if (!entry) {
      result[slot] = { hit: false, ageMinutes: null, stale: false };
    } else {
      const ageMs   = Date.now() - entry.fetchedAt;
      const stale   = ageMs > cfg.CACHE_TTL[slot];
      result[slot]  = {
        hit: true,
        ageMinutes: Math.round(ageMs / 60000),
        stale,
      };
    }
  }

  return result;
}
