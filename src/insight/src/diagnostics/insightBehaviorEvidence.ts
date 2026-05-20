import type { InsightParent, InsightStory, SnapshotSlot } from "../types";

const SNAPSHOT_SLOTS: SnapshotSlot[] = ["now", "minus4h", "minus12h", "minus24h"];

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeStoriesById(storiesById: unknown): Map<string, InsightStory> {
  if (storiesById instanceof Map) return storiesById as Map<string, InsightStory>;

  if (storiesById && typeof storiesById === "object") {
    return new Map(Object.entries(storiesById as Record<string, InsightStory>));
  }

  return new Map();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getDebug(parent: InsightParent): Record<string, any> {
  return (parent.debug || {}) as Record<string, any>;
}

function getChildStories(parent: InsightParent, storiesById: Map<string, InsightStory>): InsightStory[] {
  return safeArray<string>(parent.childStoryIds)
    .map(id => storiesById.get(id))
    .filter(Boolean) as InsightStory[];
}

function getSnapshotCount(parent: InsightParent): number {
  const presence = parent.snapshotPresence || {} as Record<SnapshotSlot, boolean>;
  return SNAPSHOT_SLOTS.filter(slot => Boolean(presence[slot])).length;
}

function getAngleSet(stories: InsightStory[]): Set<string> {
  return new Set(stories.map(story => story.angle || "unknown").filter(Boolean));
}

function getUsefulVariantRescueCount(parent: InsightParent): number {
  const diagnostics = getDebug(parent).childSelectionDiagnostics || {};
  const counts = diagnostics.duplicateReasonCounts || {};
  return asNumber(counts.USEFUL_EMBEDDING_VARIANT_RESCUED, 0);
}

function getDiversityTieBreakCount(parent: InsightParent): number {
  const diagnostics = getDebug(parent).childSelectionDiagnostics || {};
  return safeArray(diagnostics.diversityTieBreaks).length;
}

function getTopStoryProminenceScore(parent: InsightParent): number {
  return asNumber(getDebug(parent).impactScoreDiagnostics?.topStoryProminenceScore, 0);
}

function getRepresentativeScore(parent: InsightParent): number {
  return asNumber(getDebug(parent).representativeDiagnostics?.representativeScore, 0);
}

export interface InsightParentBehaviorEvidence {
  parentId: string;
  headline: string;
  snapshotCoverage: string;
  snapshotCount: number;
  childCount: number;
  angleCount: number;
  angles: string[];
  topStoryProminenceScore: number;
  representativeScore: number;
  diversityTieBreakCount: number;
  usefulVariantRescueCount: number;
  hasImpactAnchor: boolean;
  hasRepresentativeAnchor: boolean;
  has24hCoverage: boolean;
  hasMultiAngleCoverage: boolean;
  notes: string[];
}

export interface InsightBehaviorEvidence {
  status: "strong" | "partial" | "thin";
  summaryTitle: string;
  clusterCount: number;
  storyCount: number;
  childCount: number;
  angleCount: number;
  multiAngleClusters: number;
  full24hClusters: number;
  impactAnchoredClusters: number;
  representativeAnchoredClusters: number;
  diversityTieBreaks: number;
  usefulVariantRescues: number;
  angleLabels: string[];
  parentRows: InsightParentBehaviorEvidence[];
  notes: string[];
}

export function getInsightBehaviorEvidence(result: {
  parents?: InsightParent[];
  storiesById?: unknown;
}): InsightBehaviorEvidence {
  const parents = safeArray<InsightParent>(result?.parents);
  const storiesById = normalizeStoriesById(result?.storiesById);

  const parentRows = parents.map(parent => {
    const childStories = getChildStories(parent, storiesById);
    const angleSet = getAngleSet(childStories);
    const snapshotCount = getSnapshotCount(parent);
    const topStoryProminenceScore = getTopStoryProminenceScore(parent);
    const representativeScore = getRepresentativeScore(parent);
    const diversityTieBreakCount = getDiversityTieBreakCount(parent);
    const usefulVariantRescueCount = getUsefulVariantRescueCount(parent);

    const row: InsightParentBehaviorEvidence = {
      parentId: parent.parentId,
      headline: parent.canonicalHeadline || parent.parentId,
      snapshotCoverage: `${snapshotCount}/4`,
      snapshotCount,
      childCount: safeArray(parent.childStoryIds).length,
      angleCount: angleSet.size,
      angles: [...angleSet].sort(),
      topStoryProminenceScore: round2(topStoryProminenceScore),
      representativeScore: round2(representativeScore),
      diversityTieBreakCount,
      usefulVariantRescueCount,
      hasImpactAnchor: topStoryProminenceScore > 0,
      hasRepresentativeAnchor: representativeScore > 0,
      has24hCoverage: snapshotCount === 4,
      hasMultiAngleCoverage: angleSet.size >= 3,
      notes: [],
    };

    if (row.hasImpactAnchor) row.notes.push(`Top-story prominence score ${row.topStoryProminenceScore}.`);
    if (row.hasRepresentativeAnchor) row.notes.push(`Representative score ${row.representativeScore}.`);
    if (row.diversityTieBreakCount > 0) row.notes.push(`${row.diversityTieBreakCount} diversity tie-break(s) used.`);
    if (row.usefulVariantRescueCount > 0) row.notes.push(`${row.usefulVariantRescueCount} useful variant rescue(s).`);
    if (row.has24hCoverage) row.notes.push("Covered across all four snapshot windows.");
    if (row.hasMultiAngleCoverage) row.notes.push(`${row.angleCount} distinct child-story angles selected.`);
    if (row.notes.length === 0) row.notes.push("No behavior evidence recorded for this cluster.");

    return row;
  });

  const childCount = parentRows.reduce((sum, row) => sum + row.childCount, 0);
  const angleLabels = [...new Set(parentRows.flatMap(row => row.angles))].sort();
  const diversityTieBreaks = parentRows.reduce((sum, row) => sum + row.diversityTieBreakCount, 0);
  const usefulVariantRescues = parentRows.reduce((sum, row) => sum + row.usefulVariantRescueCount, 0);

  const evidenceScore =
    parentRows.filter(row => row.hasImpactAnchor).length +
    parentRows.filter(row => row.hasRepresentativeAnchor).length +
    parentRows.filter(row => row.hasMultiAngleCoverage).length +
    parentRows.filter(row => row.has24hCoverage).length +
    Math.min(3, diversityTieBreaks) +
    Math.min(3, usefulVariantRescues);

  const status: InsightBehaviorEvidence["status"] =
    evidenceScore >= 6 ? "strong" : evidenceScore >= 3 ? "partial" : "thin";

  const notes: string[] = [];

  if (parentRows.length === 0) {
    notes.push("No ranked clusters available for behavior evidence.");
  }

  if (parentRows.some(row => row.has24hCoverage)) {
    notes.push("At least one cluster has full 24h snapshot coverage.");
  } else {
    notes.push("No cluster currently has full 24h snapshot coverage.");
  }

  if (angleLabels.length >= 3) {
    notes.push(`${angleLabels.length} distinct angle labels are represented.`);
  } else {
    notes.push("Angle coverage is still thin.");
  }

  if (diversityTieBreaks > 0) {
    notes.push("Child diversity tie-breaks are active.");
  }

  if (usefulVariantRescues > 0) {
    notes.push("Useful cross-source variants were rescued from hard embedding dedup.");
  }

  return {
    status,
    summaryTitle:
      status === "strong"
        ? "Behavior tuning evidence is strong"
        : status === "partial"
          ? "Behavior tuning evidence is visible"
          : "Behavior tuning evidence is thin",
    clusterCount: parents.length,
    storyCount: storiesById.size,
    childCount,
    angleCount: angleLabels.length,
    multiAngleClusters: parentRows.filter(row => row.hasMultiAngleCoverage).length,
    full24hClusters: parentRows.filter(row => row.has24hCoverage).length,
    impactAnchoredClusters: parentRows.filter(row => row.hasImpactAnchor).length,
    representativeAnchoredClusters: parentRows.filter(row => row.hasRepresentativeAnchor).length,
    diversityTieBreaks,
    usefulVariantRescues,
    angleLabels,
    parentRows,
    notes,
  };
}