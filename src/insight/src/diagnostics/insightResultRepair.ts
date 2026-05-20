import { classifyAngle } from "../dedup/dedup";
import {
  AngleLabel,
  InsightParent,
  InsightStory,
} from "../types";

type StoriesByIdLike = Map<string, InsightStory> | Record<string, InsightStory> | undefined | null;

export const INSIGHT_OUTPUT_CONTRACT_VERSION = "insight-output-contract-v4-angle-persisted";

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeStoriesByIdForRepair(storiesById: StoriesByIdLike): Map<string, InsightStory> {
  if (storiesById instanceof Map) return storiesById;
  if (storiesById && typeof storiesById === "object") {
    return new Map(Object.entries(storiesById));
  }
  return new Map();
}

function isMissingAngle(angle: unknown): boolean {
  return !angle || angle === "unknown";
}

function getVisibleAngleSet(parent: InsightParent, storiesById: Map<string, InsightStory>): Set<AngleLabel> {
  return new Set(
    safeArray(parent.childStoryIds)
      .map(id => storiesById.get(id))
      .filter(Boolean)
      .map(story => (story?.angle || "unknown") as AngleLabel)
      .filter(angle => angle !== "unknown")
  );
}

export function repairInsightStoryAngle(story: InsightStory, parentId?: string): {
  story: InsightStory;
  changed: boolean;
  previousAngle?: AngleLabel | "unknown";
  repairedAngle: AngleLabel;
} {
  const previousAngle = (story.angle || "unknown") as AngleLabel | "unknown";

  if (parentId && story.parentId !== parentId) {
    story.parentId = parentId;
  }

  if (!isMissingAngle(story.angle)) {
    return {
      story,
      changed: false,
      previousAngle,
      repairedAngle: story.angle as AngleLabel,
    };
  }

  const repairedAngle = classifyAngle(story);
  story.angle = repairedAngle;

  (story as any).angleRepair = {
    repaired: true,
    previousAngle,
    repairedAngle,
    contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
  };

  return {
    story,
    changed: true,
    previousAngle,
    repairedAngle,
  };
}

export function repairInsightResult(result: any) {
  if (!result || typeof result !== "object") return result;

  const storiesById = normalizeStoriesByIdForRepair(result.storiesById);
  const parents = safeArray<InsightParent>(result.parents);

  const repairDiagnostics = {
    contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    repairedStoryAngles: 0,
    repairedParentLinks: 0,
    parentsWithVisibleAngles: 0,
    parentsStillSingleAngle: 0,
    childLinksChecked: 0,
    missingStoryLinks: 0,
    repairedStories: [] as Array<{
      id: string;
      parentId: string;
      previousAngle?: AngleLabel | "unknown";
      repairedAngle: AngleLabel;
    }>,
  };

  for (const parent of parents) {
    const childIds = safeArray(parent.childStoryIds);

    for (const childId of childIds) {
      repairDiagnostics.childLinksChecked += 1;

      const story = storiesById.get(childId);
      if (!story) {
        repairDiagnostics.missingStoryLinks += 1;
        continue;
      }

      const beforeParent = story.parentId;
      const repaired = repairInsightStoryAngle(story, parent.parentId);

      if (beforeParent !== story.parentId) {
        repairDiagnostics.repairedParentLinks += 1;
      }

      if (repaired.changed) {
        repairDiagnostics.repairedStoryAngles += 1;

        if (repairDiagnostics.repairedStories.length < 50) {
          repairDiagnostics.repairedStories.push({
            id: story.id,
            parentId: parent.parentId,
            previousAngle: repaired.previousAngle,
            repairedAngle: repaired.repairedAngle,
          });
        }
      }

      storiesById.set(childId, story);
    }

    const visibleAngles = getVisibleAngleSet(parent, storiesById);
    if (visibleAngles.size >= 2) {
      repairDiagnostics.parentsWithVisibleAngles += 1;
    } else if (childIds.length > 0) {
      repairDiagnostics.parentsStillSingleAngle += 1;
    }

    parent.debug = parent.debug || {
      clusterSize: safeArray(parent.clusterStoryIds).length,
      hiddenCount: safeArray(parent.hiddenDuplicateIds).length,
      matchedSnapshots: [],
      scoreBreakdown: {},
      replacements: [],
    };

    (parent.debug as any).outputContractRepair = {
      contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
      visibleAngleCount: visibleAngles.size,
      visibleAngles: [...visibleAngles],
    };
  }

  return {
    ...result,
    parents,
    storiesById,
    outputContractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    outputContractRepairDiagnostics: repairDiagnostics,
  };
}

export function isInsightResultContractCurrent(result: any): boolean {
  return result?.outputContractVersion === INSIGHT_OUTPUT_CONTRACT_VERSION;
}

export function getInsightResultRepairSummary(result: any) {
  const repaired = repairInsightResult(result);
  const diagnostics = repaired?.outputContractRepairDiagnostics || {};

  return {
    contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    current: isInsightResultContractCurrent(repaired),
    repairedStoryAngles: Number(diagnostics.repairedStoryAngles || 0),
    repairedParentLinks: Number(diagnostics.repairedParentLinks || 0),
    parentsWithVisibleAngles: Number(diagnostics.parentsWithVisibleAngles || 0),
    parentsStillSingleAngle: Number(diagnostics.parentsStillSingleAngle || 0),
    missingStoryLinks: Number(diagnostics.missingStoryLinks || 0),
  };
}

export default repairInsightResult;
