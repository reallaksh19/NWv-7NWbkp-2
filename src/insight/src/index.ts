// ─────────────────────────────────────────────
//  INSIGHT TAB — Public API
// ─────────────────────────────────────────────

export { runInsightPipeline, applyIncrementalUpdate } from "./pipeline/pipeline";
export type { InsightRunResult, SlotFetcher } from "./pipeline/pipeline";

export { DEFAULT_CONFIG } from "./types";
export type {
  InsightConfig,
  InsightStory,
  InsightParent,
  SnapshotSlot,
  AngleLabel,
  SourceTier,
  ChildCandidate,
} from "./types";

export { normalizeStory, getSourceTier, isTierD, computeFreshnessScore } from "./pipeline/normalize";
export { removeHardDuplicates, eventSimilarity, classifyAngle, isAngleVariant } from "./dedup/dedup";
export { clusterIntoParentEvents, createCanonicalParent, computePersistenceScore } from "./cluster/cluster";
export { scoreAndRankParents, computeImpactScore, computeNoveltyScore } from "./ranking/ranking";
export { buildChildTree, isWeakTree, tryReplaceWeakestChild } from "./tree/treeBuilder";
export {
  getCachedSlot, setCachedSlot, mergeSlotStories,
  slotsNeedingFetch, needsPrewarm, cacheStatus,
} from "./cache/cacheManager";
