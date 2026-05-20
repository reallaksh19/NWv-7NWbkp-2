import { InsightStory, InsightParent, InsightConfig } from "../types";

export interface SourceDiverseSelectionResult {
  repairedChildIds: string[];
  addedIds: string[];
  sourceGroupsBefore: string[];
  sourceGroupsAfter: string[];
  repairApplied: boolean;
  availableSourceGroupCount: number;
}

export function enforceSourceDiverseChildSelection(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  allCandidates: InsightStory[],
  cfg: InsightConfig
): SourceDiverseSelectionResult {
  const minSources = (cfg as any).minSourcesPerTree ?? cfg.MIN_SOURCES_PER_TREE ?? 2;
  const currentIds = (parent as any).childStoryIds ?? [];

  const currentSources = new Set<string>();
  for (const id of currentIds) {
    const s = storiesById.get(id);
    if (s?.sourceGroup) currentSources.add(s.sourceGroup);
  }

  const availableSourceGroups = new Set<string>(allCandidates.map(s => s.sourceGroup).filter(Boolean) as string[]);
  const sourceGroupsBefore = [...currentSources];

  if (currentSources.size >= minSources) {
    return {
      repairedChildIds: currentIds,
      addedIds: [],
      sourceGroupsBefore,
      sourceGroupsAfter: sourceGroupsBefore,
      repairApplied: false,
      availableSourceGroupCount: availableSourceGroups.size,
    };
  }

  const currentSet = new Set(currentIds);
  const added: string[] = [];

  for (const candidate of allCandidates) {
    if (currentSources.size >= minSources) break;
    if (currentSet.has(candidate.id)) continue;
    if (!currentSources.has(candidate.sourceGroup)) {
      added.push(candidate.id);
      currentSet.add(candidate.id);
      currentSources.add(candidate.sourceGroup);
    }
  }

  const repairedChildIds = [...currentIds, ...added];
  return {
    repairedChildIds,
    addedIds: added,
    sourceGroupsBefore,
    sourceGroupsAfter: [...currentSources],
    repairApplied: added.length > 0,
    availableSourceGroupCount: availableSourceGroups.size,
  };
}
