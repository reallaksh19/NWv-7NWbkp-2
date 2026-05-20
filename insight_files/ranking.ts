// ─────────────────────────────────────────────
//  INSIGHT TAB — Parent Ranking
// ─────────────────────────────────────────────

import { InsightParent, InsightStory, InsightConfig, SnapshotSlot } from "../types";

// ── Impact score ──────────────────────────────────────────────────────────────

/**
 * Heuristic impact score based on cluster-level signals.
 */
export function computeImpactScore(
  parent: InsightParent,
  clusterStories: InsightStory[]
): number {
  // 1. Source authority average
  const avgAuthority =
    clusterStories.reduce((s, x) => s + x.sourceAuthority, 0) /
    Math.max(1, clusterStories.length);

  // 2. Factual density (numbers, entities)
  const avgFactDensity =
    clusterStories.reduce((s, x) => s + x.factualDensity, 0) /
    Math.max(1, clusterStories.length);

  // 3. Large-numbers signal (billions, millions, thousands casualties etc.)
  const largeNumbers = parent.keyNumbers.filter(
    n => /billion|million|crore|lakh|thousand|%|casualties|dead|killed/i.test(n)
  ).length;
  const largeNumScore = Math.min(1, largeNumbers / 3);

  // 4. Key entity type boost (government, market, geopolitical)
  const impactEntities = parent.keyEntities.filter(
    e => /ministry|government|rbi|fed|sebi|un|nato|white house|supreme court|parliament/i.test(e)
  ).length;
  const entityBoost = Math.min(1, impactEntities / 2);

  // 5. Source diversity as proxy for real-world importance
  const divScore = parent.sourceDiversityScore;

  return (
    0.30 * avgAuthority  +
    0.20 * avgFactDensity +
    0.15 * largeNumScore  +
    0.15 * entityBoost    +
    0.20 * divScore
  );
}

// ── Novelty score ─────────────────────────────────────────────────────────────

/**
 * Measures how much the event has changed since the −24h snapshot.
 * Higher when there are new facts, new entities, or new angles in recent stories
 * that were not in older stories.
 */
export function computeNoveltyScore(
  clusterStories: InsightStory[]
): number {
  const recent = clusterStories.filter(
    s => s.capturedAtSnapshot === "now" || s.capturedAtSnapshot === "minus4h"
  );
  const older  = clusterStories.filter(
    s => s.capturedAtSnapshot === "minus12h" || s.capturedAtSnapshot === "minus24h"
  );

  if (older.length === 0) return 0.8; // newly emerged = high novelty
  if (recent.length === 0) return 0.1;

  const oldEntities = new Set(older.flatMap(s => [...s.entities.orgs, ...s.entities.places]));
  const oldNumbers  = new Set(older.flatMap(s => s.numbers));
  const oldVerbs    = new Set(older.flatMap(s => s.eventVerbs));

  let newSignals = 0;
  for (const s of recent) {
    for (const e of [...s.entities.orgs, ...s.entities.places]) {
      if (!oldEntities.has(e)) newSignals++;
    }
    for (const n of s.numbers) {
      if (!oldNumbers.has(n)) newSignals++;
    }
    for (const v of s.eventVerbs) {
      if (!oldVerbs.has(v)) newSignals++;
    }
  }

  return Math.min(1, newSignals / 10);
}

// ── Cross-snapshot momentum ───────────────────────────────────────────────────

/**
 * Sigmoid of the growth in cluster size from −24h to now.
 * Positive = story is rising; negative = declining.
 */
export function computeCrossSnapshotMomentum(
  clusterStories: InsightStory[]
): number {
  const countNow    = clusterStories.filter(s => s.capturedAtSnapshot === "now").length;
  const countMinus4 = clusterStories.filter(s => s.capturedAtSnapshot === "minus4h").length;
  const countOld    = clusterStories.filter(
    s => s.capturedAtSnapshot === "minus12h" || s.capturedAtSnapshot === "minus24h"
  ).length;

  const recentAvg = (countNow + countMinus4) / 2;
  const oldAvg    = countOld / 2 || 0.5; // avoid div/0

  const rawMomentum = (recentAvg - oldAvg) / 5;
  return sigmoid(rawMomentum);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ── Region boost ──────────────────────────────────────────────────────────────

export function computeRegionBoost(
  parent: InsightParent,
  clusterStories: InsightStory[],
  cfg: InsightConfig
): number {
  if (!cfg.REGION_BOOST) return 0;
  const text = [
    ...parent.keyPlaces,
    ...clusterStories.map(s => s.region ?? ""),
    ...clusterStories.map(s => s.title),
  ].join(" ").toLowerCase();

  const matched = cfg.REGION_TAGS.some(tag => text.includes(tag.toLowerCase()));
  return matched ? cfg.REGION_BOOST : 0;
}

// ── Rising badge ──────────────────────────────────────────────────────────────

export function computeIsRising(
  clusterStories: InsightStory[],
  cfg: InsightConfig,
  previousClusterSize: number
): boolean {
  const currentSize = clusterStories.filter(s => s.capturedAtSnapshot === "now").length;
  return currentSize - previousClusterSize >= cfg.RISING_THRESHOLD;
}

// ── Final parent score ────────────────────────────────────────────────────────

export function computeFinalParentScore(parent: InsightParent): number {
  const score =
    0.28 * parent.impactScore              +
    0.20 * parent.persistenceScore         +
    0.14 * parent.sourceDiversityScore     +
    0.12 * parent.noveltyScore             +
    0.10 * parent.freshnessScore           +
    0.08 * parent.crossSnapshotMomentum    +
    0.05 * parent.editorialClarityScore    +
    0.03 * parent.regionBoost;

  parent.debug.scoreBreakdown = {
    impactScore:             parent.impactScore,
    persistenceScore:        parent.persistenceScore,
    sourceDiversityScore:    parent.sourceDiversityScore,
    noveltyScore:            parent.noveltyScore,
    freshnessScore:          parent.freshnessScore,
    crossSnapshotMomentum:   parent.crossSnapshotMomentum,
    editorialClarityScore:   parent.editorialClarityScore,
    regionBoost:             parent.regionBoost,
    finalParentScore:        score,
  };

  return score;
}

// ── Full score population ─────────────────────────────────────────────────────

export function scoreAndRankParents(
  parents: InsightParent[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig,
  previousClusterSizes: Map<string, number> = new Map()
): InsightParent[] {
  for (const parent of parents) {
    const clusterStories = parent.clusterStoryIds
      .map(id => storiesById.get(id))
      .filter(Boolean) as InsightStory[];

    parent.impactScore            = computeImpactScore(parent, clusterStories);
    parent.noveltyScore           = computeNoveltyScore(clusterStories);
    parent.crossSnapshotMomentum  = computeCrossSnapshotMomentum(clusterStories);
    parent.regionBoost            = computeRegionBoost(parent, clusterStories, cfg);
    parent.isRising               = computeIsRising(
      clusterStories, cfg, previousClusterSizes.get(parent.parentId) ?? 0
    );
    parent.finalParentScore       = computeFinalParentScore(parent);
  }

  // Sort desc by finalParentScore
  parents.sort((a, b) => b.finalParentScore - a.finalParentScore);

  return parents;
}
