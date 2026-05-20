import { InsightStory, InsightParent, InsightConfig } from "../types";

export interface DiversityAdjustedScore {
  parentId: string;
  baseScore: number;
  diversityBonus: number;
  weaknessPenalty: number;
  finalScore: number;
  angleCount: number;
  sourceGroupCount: number;
}

export function computeDiversityAdjustedParentScore(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): DiversityAdjustedScore {
  const childIds = (parent as any).childStoryIds ?? [];
  const angles = new Set<string>();
  const sources = new Set<string>();
  for (const id of childIds) {
    const s = storiesById.get(id);
    if (s?.angle) angles.add(s.angle);
    if (s?.sourceGroup) sources.add(s.sourceGroup);
  }

  const weakTreeChildMin = (cfg as any).weakTreeChildMin ?? cfg.WEAK_TREE_CHILD_MIN ?? 2;
  const minSources = (cfg as any).minSourcesPerTree ?? cfg.MIN_SOURCES_PER_TREE ?? 2;

  const diversityBonus = (angles.size > 1 ? 0.1 : 0) + (sources.size > 1 ? 0.1 : 0);
  const weaknessPenalty = (childIds.length < weakTreeChildMin ? 0.3 : 0) + (sources.size < minSources ? 0.2 : 0);
  const finalScore = Math.max(0, ((parent as any).score ?? 0) + diversityBonus - weaknessPenalty);

  return {
    parentId: parent.id,
    baseScore: (parent as any).score ?? 0,
    diversityBonus,
    weaknessPenalty,
    finalScore,
    angleCount: angles.size,
    sourceGroupCount: sources.size,
  };
}

export function rerankParentsAfterDiversityRepair(
  parents: InsightParent[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): InsightParent[] {
  const scores = parents.map(p => computeDiversityAdjustedParentScore(p, storiesById, cfg));
  const scoreMap = new Map(scores.map(s => [s.parentId, s.finalScore]));
  return [...parents].sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
}
