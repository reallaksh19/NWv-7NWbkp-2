import { InsightStory, InsightConfig } from "../types";

export interface VariantRescueResult {
  rescued: InsightStory[];
  rescuedIds: string[];
  rescueCount: number;
  reasonsByStoryId: Record<string, string[]>;
}

export function rescueUsefulVariantsBeforeDuplicateFreeze(
  remainingCandidates: InsightStory[],
  currentChildIds: string[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): VariantRescueResult {
  const maxRescue = (cfg as any).maxChildrenPerParent ?? cfg.MAX_CHILDREN_PER_PARENT ?? 8;
  const currentSet = new Set(currentChildIds);
  const rescued: InsightStory[] = [];
  const reasonsByStoryId: Record<string, string[]> = {};

  const currentAngles = new Set<string>();
  const currentSources = new Set<string>();
  for (const id of currentChildIds) {
    const s = storiesById.get(id);
    if (s?.angle) currentAngles.add(s.angle);
    if (s?.sourceGroup) currentSources.add(s.sourceGroup);
  }

  for (const candidate of remainingCandidates) {
    if (currentSet.has(candidate.id)) continue;
    if (currentChildIds.length + rescued.length >= maxRescue) break;

    const reasons: string[] = [];
    const angle = candidate.angle ?? 'unknown';
    const sourceGroup = candidate.sourceGroup ?? 'unknown';

    if (!currentAngles.has(angle)) reasons.push('NEW_ANGLE');
    if (!currentSources.has(sourceGroup)) reasons.push('NEW_SOURCE');
    if ((candidate as any).numericFacts && (candidate as any).numericFacts.length > 0) reasons.push('NUMERIC_FACT');

    if (reasons.length > 0) {
      rescued.push(candidate);
      reasonsByStoryId[candidate.id] = reasons;
      currentAngles.add(angle);
      currentSources.add(sourceGroup);
      currentSet.add(candidate.id);
    }
  }

  return {
    rescued,
    rescuedIds: rescued.map(s => s.id),
    rescueCount: rescued.length,
    reasonsByStoryId,
  };
}
