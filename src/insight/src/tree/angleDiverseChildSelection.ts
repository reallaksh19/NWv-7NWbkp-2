import { InsightStory, InsightParent, InsightConfig, AngleLabel } from "../types";

export interface AngleDiverseSelectionResult {
  repairedChildIds: string[];
  addedIds: string[];
  removedIds: string[];
  anglesBefore: string[];
  anglesAfter: string[];
  repairApplied: boolean;
}

export function enforceAngleDiverseChildSelection(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  allCandidates: InsightStory[],
  cfg: InsightConfig
): AngleDiverseSelectionResult {
  const maxAngle = (cfg as any).maxPerAngle ?? cfg.MAX_PER_ANGLE ?? 2;
  const currentIds = (parent as any).childStoryIds ?? [];
  const anglesBefore = getAngles(currentIds, storiesById);

  // Check if any angle exceeds max
  const angleCounts = new Map<string, string[]>();
  for (const id of currentIds) {
    const s = storiesById.get(id);
    const angle = s?.angle ?? 'unknown';
    if (!angleCounts.has(angle)) angleCounts.set(angle, []);
    angleCounts.get(angle)!.push(id);
  }

  const overloadedAngles = [...angleCounts.entries()].filter(([, ids]) => ids.length > maxAngle);
  if (overloadedAngles.length === 0) {
    return {
      repairedChildIds: currentIds,
      addedIds: [],
      removedIds: [],
      anglesBefore,
      anglesAfter: anglesBefore,
      repairApplied: false,
    };
  }

  // Remove excess children from overloaded angles, replace with diverse angle candidates
  const toRemove = new Set<string>();
  for (const [, ids] of overloadedAngles) {
    for (const id of ids.slice(maxAngle)) toRemove.add(id);
  }

  const usedAngles = new Map<string, number>();
  const kept = currentIds.filter((id: string) => !toRemove.has(id));
  for (const id of kept) {
    const s = storiesById.get(id);
    const angle = s?.angle ?? 'unknown';
    usedAngles.set(angle, (usedAngles.get(angle) ?? 0) + 1);
  }

  const currentSet = new Set(kept);
  const added: string[] = [];
  for (const candidate of allCandidates) {
    if (currentSet.has(candidate.id)) continue;
    const angle = candidate.angle ?? 'unknown';
    const count = usedAngles.get(angle) ?? 0;
    if (count < maxAngle) {
      added.push(candidate.id);
      currentSet.add(candidate.id);
      usedAngles.set(angle, count + 1);
    }
  }

  const repairedChildIds = [...kept, ...added];
  return {
    repairedChildIds,
    addedIds: added,
    removedIds: [...toRemove],
    anglesBefore,
    anglesAfter: getAngles(repairedChildIds, storiesById),
    repairApplied: true,
  };
}

export function orderAngleDiverseChildrenForDisplay(
  childIds: string[],
  storiesById: Map<string, InsightStory>
): string[] {
  const ANGLE_ORDER: AngleLabel[] = [
    "base_report", "official_response", "fact_update", "market_reaction",
    "expert_analysis", "regional_followup", "investigative_detail",
    "correction", "background_context", "reaction_public", "unknown",
  ];
  return [...childIds].sort((a, b) => {
    const sa = storiesById.get(a);
    const sb = storiesById.get(b);
    const ai = ANGLE_ORDER.indexOf((sa?.angle ?? 'unknown') as AngleLabel);
    const bi = ANGLE_ORDER.indexOf((sb?.angle ?? 'unknown') as AngleLabel);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function getAngles(ids: string[], storiesById: Map<string, InsightStory>): string[] {
  return [...new Set(ids.map((id: string) => storiesById.get(id)?.angle ?? 'unknown'))];
}
