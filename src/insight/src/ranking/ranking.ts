// ─────────────────────────────────────────────
//  INSIGHT TAB — Parent Ranking
// ─────────────────────────────────────────────

import { InsightParent, InsightStory, InsightConfig, SnapshotSlot } from "../types";

// ── Ranking reason diagnostics ────────────────────────────────────────────────

type RankingScoreKey =
  | "impactScore"
  | "persistenceScore"
  | "sourceDiversityScore"
  | "noveltyScore"
  | "freshnessScore"
  | "crossSnapshotMomentum"
  | "editorialClarityScore"
  | "regionBoost";

const RANKING_SCORE_WEIGHTS: Record<RankingScoreKey, number> = {
  impactScore: 0.28,
  persistenceScore: 0.20,
  sourceDiversityScore: 0.14,
  noveltyScore: 0.12,
  freshnessScore: 0.10,
  crossSnapshotMomentum: 0.08,
  editorialClarityScore: 0.05,
  regionBoost: 0.03,
};

const RANKING_SCORE_LABELS: Record<RankingScoreKey, string> = {
  impactScore: "Impact",
  persistenceScore: "Persistence",
  sourceDiversityScore: "Source diversity",
  noveltyScore: "Novelty",
  freshnessScore: "Freshness",
  crossSnapshotMomentum: "Cross-snapshot momentum",
  editorialClarityScore: "Editorial clarity",
  regionBoost: "Regional relevance",
};

const IMPACT_SCORE_WEIGHTS = {
  avgAuthority: 0.28,
  avgFactDensity: 0.18,
  largeNumScore: 0.14,
  entityBoost: 0.14,
  sourceDiversityScore: 0.16,
  topStoryProminenceScore: 0.10,
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeTopStoryProminenceScore(clusterStories: InsightStory[]): number {
  const scores = clusterStories
    .map(story => clamp01(Number(story.rawProminence)))
    .filter(score => Number.isFinite(score));

  if (scores.length === 0) return 0;

  const avgProminence = average(scores);
  const maxProminence = Math.max(...scores);

  return clamp01((0.6 * maxProminence) + (0.4 * avgProminence));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function getParentScoreValue(parent: InsightParent, key: RankingScoreKey): number {
  const value = Number(parent[key]);
  return Number.isFinite(value) ? value : 0;
}

function getWeightedContribution(parent: InsightParent, key: RankingScoreKey): number {
  return getParentScoreValue(parent, key) * RANKING_SCORE_WEIGHTS[key];
}

function buildRankingContributionBreakdown(parent: InsightParent) {
  return (Object.keys(RANKING_SCORE_WEIGHTS) as RankingScoreKey[]).map(key => {
    const rawScore = getParentScoreValue(parent, key);
    const weight = RANKING_SCORE_WEIGHTS[key];
    const weightedContribution = rawScore * weight;

    return {
      key,
      label: RANKING_SCORE_LABELS[key],
      rawScore: round4(rawScore),
      weight,
      weightedContribution: round4(weightedContribution),
      contributionPercent: 0,
    };
  });
}

function buildTopRankingReasons(parent: InsightParent, finalParentScore: number): string[] {
  const breakdown = buildRankingContributionBreakdown(parent)
    .map(item => ({
      ...item,
      contributionPercent: finalParentScore > 0
        ? round4(item.weightedContribution / finalParentScore)
        : 0,
    }))
    .sort((a, b) => b.weightedContribution - a.weightedContribution);

  return breakdown.slice(0, 3).map(item => {
    return `${item.label} contributed ${round4(item.weightedContribution)} (${Math.round(item.contributionPercent * 100)}%)`;
  });
}

function attachRankingReasonDiagnostics(parent: InsightParent, finalParentScore: number): void {
  const contributionBreakdown = buildRankingContributionBreakdown(parent)
    .map(item => ({
      ...item,
      contributionPercent: finalParentScore > 0
        ? round4(item.weightedContribution / finalParentScore)
        : 0,
    }))
    .sort((a, b) => b.weightedContribution - a.weightedContribution);

  const contributionSum = round4(
    contributionBreakdown.reduce((sum, item) => sum + item.weightedContribution, 0)
  );

  const diagnostics = {
    formulaVersion: "ranking-v1-weighted-contributions",
    weights: { ...RANKING_SCORE_WEIGHTS },
    contributionBreakdown,
    contributionSum,
    finalParentScore: round4(finalParentScore),
    formulaDelta: round4(Math.abs(contributionSum - finalParentScore)),
    topRankingReasons: buildTopRankingReasons(parent, finalParentScore),
  };

  (parent.debug as any).rankingContributionBreakdown = contributionBreakdown;
  (parent.debug as any).rankingReasonLabels = diagnostics.topRankingReasons;
  (parent.debug as any).rankingFormulaDiagnostics = diagnostics;
}

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

  // 6. Top-story anchoring from source placement/headline rank.
  // This is deliberately bounded inside impactScore and does not change
  // final parent-score weights.
  const topStoryProminenceScore = computeTopStoryProminenceScore(clusterStories);

  const impactScore =
    IMPACT_SCORE_WEIGHTS.avgAuthority * avgAuthority +
    IMPACT_SCORE_WEIGHTS.avgFactDensity * avgFactDensity +
    IMPACT_SCORE_WEIGHTS.largeNumScore * largeNumScore +
    IMPACT_SCORE_WEIGHTS.entityBoost * entityBoost +
    IMPACT_SCORE_WEIGHTS.sourceDiversityScore * divScore +
    IMPACT_SCORE_WEIGHTS.topStoryProminenceScore * topStoryProminenceScore;

  (parent.debug as any).impactScoreDiagnostics = {
    formulaVersion: "impact-v2-top-story-anchor",
    weights: { ...IMPACT_SCORE_WEIGHTS },
    avgAuthority: round4(avgAuthority),
    avgFactDensity: round4(avgFactDensity),
    largeNumScore: round4(largeNumScore),
    entityBoost: round4(entityBoost),
    sourceDiversityScore: round4(divScore),
    topStoryProminenceScore: round4(topStoryProminenceScore),
    impactScore: round4(impactScore),
  };

  return impactScore;
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
  // FIX M-2: use 0 as the "no history" baseline — was 0.5, which penalised
  // newly breaking stories that have no older snapshot presence
  const oldAvg    = countOld > 0 ? countOld / 2 : 0;

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
    getWeightedContribution(parent, "impactScore") +
    getWeightedContribution(parent, "persistenceScore") +
    getWeightedContribution(parent, "sourceDiversityScore") +
    getWeightedContribution(parent, "noveltyScore") +
    getWeightedContribution(parent, "freshnessScore") +
    getWeightedContribution(parent, "crossSnapshotMomentum") +
    getWeightedContribution(parent, "editorialClarityScore") +
    getWeightedContribution(parent, "regionBoost");

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

  attachRankingReasonDiagnostics(parent, score);

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