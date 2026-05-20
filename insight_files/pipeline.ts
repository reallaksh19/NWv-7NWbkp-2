// ─────────────────────────────────────────────
//  INSIGHT TAB — Main Pipeline Orchestrator
// ─────────────────────────────────────────────

import {
  InsightStory, InsightParent, InsightConfig,
  DEFAULT_CONFIG, SnapshotSlot,
} from "../types";
import {
  getCachedSlot, setCachedSlot, mergeSlotStories,
  slotsNeedingFetch, needsPrewarm, cacheStatus,
} from "../cache/cacheManager";
import { removeHardDuplicates } from "../dedup/dedup";
import { clusterIntoParentEvents, createCanonicalParent } from "../cluster/cluster";
import { scoreAndRankParents } from "../ranking/ranking";
import { buildChildTree, isWeakTree, tryReplaceWeakestChild } from "../tree/treeBuilder";
import { applyTierCFallback } from "../pipeline/normalize";

// ── Types for external interfaces ─────────────────────────────────────────────

export interface InsightRunResult {
  parents:       InsightParent[];
  storiesById:   Map<string, InsightStory>;
  hiddenIds:     Set<string>;
  slotsRefetched: SnapshotSlot[];
  cacheStatus:   ReturnType<typeof cacheStatus>;
  ranAt:         number;
}

/** Provided by the host app: fetches raw stories for one snapshot slot */
export type SlotFetcher = (slot: SnapshotSlot) => Promise<InsightStory[]>;

/** Optional: previous cluster sizes for momentum computation */
export type PreviousClusterSizes = Map<string, number>;

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runInsightPipeline(
  fetcher: SlotFetcher,
  cfg: InsightConfig = DEFAULT_CONFIG,
  previousClusterSizes: PreviousClusterSizes = new Map(),
  backgroundPrewarmCallback?: (slot: SnapshotSlot) => void
): Promise<InsightRunResult> {

  // ── Step 1: Resolve which slots need a fresh fetch ─────────────────────────
  const slotsToFetch = slotsNeedingFetch(cfg);
  const freshBySlot: Partial<Record<SnapshotSlot, InsightStory[]>> = {};

  await Promise.all(
    slotsToFetch.map(async slot => {
      try {
        freshBySlot[slot] = await fetcher(slot);
      } catch {
        freshBySlot[slot] = []; // degrade gracefully
      }
    })
  );

  // ── Step 2: Merge cached + fresh stories ───────────────────────────────────
  const allStories = mergeSlotStories(freshBySlot, cfg);

  // ── Step 3: Trigger background pre-warm if any slot is approaching TTL ─────
  if (backgroundPrewarmCallback) {
    const slots: SnapshotSlot[] = ["minus4h", "minus12h", "minus24h"];
    for (const slot of slots) {
      if (needsPrewarm(slot, cfg)) backgroundPrewarmCallback(slot);
    }
  }

  // ── Step 4: Hard duplicate removal ─────────────────────────────────────────
  const hiddenIds = new Set<string>();
  const deduped   = removeHardDuplicates(allStories, cfg, hiddenIds);

  // ── Step 5: Event clustering ────────────────────────────────────────────────
  const clusters = clusterIntoParentEvents(deduped, cfg);

  // ── Step 6: Create canonical parents ───────────────────────────────────────
  const parents = clusters.map(c => createCanonicalParent(c, cfg));

  // Tag stories with their parentId on the deduped list
  const storiesById = new Map<string, InsightStory>();
  for (const cluster of clusters) {
    for (const s of cluster.stories) storiesById.set(s.id, s);
  }

  // ── Step 7: Apply Tier C fallback ───────────────────────────────────────────
  const tierFiltered = applyTierCFallback(deduped, cfg);
  for (const s of tierFiltered) storiesById.set(s.id, s); // refresh map

  // ── Step 8: Score and rank parents ─────────────────────────────────────────
  const ranked = scoreAndRankParents(parents, storiesById, cfg, previousClusterSizes);

  // ── Step 9: Select top N parents, handle weak tree demotion ────────────────
  const topParents = selectTopParentsWithWeakTreeCheck(ranked, storiesById, cfg, hiddenIds);

  // ── Step 10: Cache the "now" parents for possible incremental update ────────
  setCachedSlot("now", freshBySlot["now"] ?? [], cfg, topParents);

  return {
    parents:        topParents,
    storiesById,
    hiddenIds,
    slotsRefetched: slotsToFetch,
    cacheStatus:    cacheStatus(cfg),
    ranAt:          Date.now(),
  };
}

// ── Top-parent selection with weak tree demotion ──────────────────────────────

function selectTopParentsWithWeakTreeCheck(
  ranked: InsightParent[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig,
  hiddenIds: Set<string>
): InsightParent[] {
  const result: InsightParent[] = [];
  let   candidateIdx = 0;

  while (result.length < cfg.TOP_PARENTS && candidateIdx < ranked.length) {
    const parent = ranked[candidateIdx++];

    const clusterStories = parent.clusterStoryIds
      .map(id => storiesById.get(id))
      .filter(Boolean) as InsightStory[];

    // Build child tree
    const children = buildChildTree(parent, clusterStories, cfg, hiddenIds);
    parent.childStoryIds = children.map(c => c.id);

    // Weak tree check: demote if below minimum quality children
    if (isWeakTree(children, cfg)) {
      parent.weakTree = true;
      // Still include if we're running low on candidates
      if (ranked.length - candidateIdx < cfg.TOP_PARENTS - result.length) {
        result.push(parent);
      }
      // Otherwise skip and try next cluster
      continue;
    }

    result.push(parent);
  }

  return result;
}

// ── Incremental update (new "now" stories arrive) ─────────────────────────────

/**
 * Called when a fresh batch of "now" stories arrives between full pipeline runs.
 * Only processes new stories (not already in storiesById).
 * Updates affected parent trees in-place without re-ranking all parents.
 */
export function applyIncrementalUpdate(
  newStories: InsightStory[],
  existingResult: InsightRunResult,
  cfg: InsightConfig
): InsightRunResult {
  const { parents, storiesById, hiddenIds } = existingResult;

  // Only process genuinely new stories
  const truly_new = newStories.filter(s => !storiesById.has(s.id));
  if (truly_new.length === 0) return existingResult;

  // For each new story, find which parent it belongs to (or flag as new parent candidate)
  const { clusterIntoParentEvents } = require("../cluster/cluster");
  const allExistingStories = [...storiesById.values()];

  for (const story of truly_new) {
    storiesById.set(story.id, story);

    // Try to match to an existing parent
    let matched = false;
    for (const parent of parents) {
      const rep = getClusterRepStory(parent, storiesById);
      if (!rep) continue;

      const { eventSimilarity, applyClusterOverrides } = require("../dedup/dedup");
      const rawSim = eventSimilarity(story, rep);
      const rule   = applyClusterOverrides(story, rep, rawSim, cfg);

      const sim = rule === "SAME" ? 1.0 : rule === "DIFFERENT" ? 0.0 : rawSim;

      if (sim >= cfg.SAME_EVENT_THRESHOLD) {
        // Belongs to this parent — try to update its tree
        parent.clusterStoryIds.push(story.id);
        parent.latestSeenAt = Math.max(parent.latestSeenAt, story.publishedAt);
        parent.snapshotPresence.now = true;

        const currentChildren = parent.childStoryIds
          .map(id => storiesById.get(id))
          .filter(Boolean) as InsightStory[];

        const updated = tryReplaceWeakestChild(parent, currentChildren, story, cfg, hiddenIds);
        parent.childStoryIds = updated.map(c => c.id);

        matched = true;
        break;
      }
    }

    // Not matched: new parent candidate (re-run full pipeline at next cycle)
    if (!matched) {
      // Tag for next full run — do not disrupt current output
    }
  }

  // Check for rising badge updates
  for (const parent of parents) {
    const nowCount = parent.clusterStoryIds
      .filter(id => storiesById.get(id)?.capturedAtSnapshot === "now")
      .length;
    parent.isRising = nowCount >= cfg.RISING_THRESHOLD;
  }

  return { ...existingResult, parents, storiesById, hiddenIds };
}

function getClusterRepStory(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): InsightStory | null {
  let best: InsightStory | null = null;
  let bestAuth = -1;
  for (const id of parent.clusterStoryIds) {
    const s = storiesById.get(id);
    if (s && s.sourceAuthority > bestAuth) { best = s; bestAuth = s.sourceAuthority; }
  }
  return best;
}
