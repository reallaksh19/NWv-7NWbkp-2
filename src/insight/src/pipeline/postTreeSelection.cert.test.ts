import { describe, expect, it } from "vitest";
import {
  computePostTreeQualityScore,
  selectTopParentsWithWeakTreeCheck,
} from "./pipeline";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightParent,
  InsightStory,
} from "../types";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function vector(seed: number): number[] {
  const values = Array.from({ length: 200 }, () => 0);
  values[seed % 200] = 1;
  values[(seed + 17) % 200] = 0.4;
  return values;
}

function story(
  id: string,
  title: string,
  summary: string,
  sourceGroup: string,
  seed: number,
  angle?: any
): InsightStory {
  return {
    id,
    title,
    summary,
    source: sourceGroup,
    sourceGroup,
    url: `https://example.com/${id}`,
    publishedAt: NOW,
    category: "news",
    region: "India",
    language: "en",
    capturedAtSnapshot: "now",
    canonicalUrl: `https://example.com/${id}`,
    canonicalText: `${title} ${summary}`,
    canonicalTextHash: `hash-${id}`,
    entities: {
      people: [],
      orgs: ["Acme Bank"],
      places: ["India"],
      products: [],
      symbols: [],
    },
    keywords: ["acme", "bank", "outage"],
    embedding: vector(seed),
    eventVerbs: ["announces"],
    numbers: [],
    sourceTier: "A",
    sourceAuthority: 0.82,
    freshnessScore: 0.86,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.7,
    summaryQuality: 0.9,
    angle,
  };
}

function parent(
  id: string,
  storyIds: string[],
  finalParentScore: number,
  weakTree = false
): InsightParent {
  return {
    parentId: id,
    canonicalHeadline: id,
    canonicalSummary: id,
    clusterStoryIds: storyIds,
    childStoryIds: storyIds,
    hiddenDuplicateIds: [],
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: NOW,
    latestSeenAt: NOW,
    snapshotPresence: {
      now: true,
      minus4h: false,
      minus12h: false,
      minus24h: false,
    },
    impactScore: finalParentScore,
    persistenceScore: finalParentScore,
    sourceDiversityScore: finalParentScore,
    noveltyScore: finalParentScore,
    freshnessScore: finalParentScore,
    crossSnapshotMomentum: finalParentScore,
    editorialClarityScore: finalParentScore,
    regionBoost: 0,
    finalParentScore,
    isRising: false,
    weakTree,
    debug: {
      clusterSize: storyIds.length,
      hiddenCount: 0,
      matchedSnapshots: ["now"],
      scoreBreakdown: {},
      replacements: [],
    },
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  TOP_PARENTS: 1,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.95,
  WEAK_TREE_CHILD_MIN: 3,
  MIN_SOURCES_PER_TREE: 3,
  TIER_D_EXCLUDE: false,
};

describe("Insight post-tree selection certification", () => {
  it("gives higher post-tree quality to multi-angle trees than single-angle thin trees", () => {
    const storiesById = new Map<string, InsightStory>();

    const singleStories = [
      story("single-1", "High authority market update", "General update without a second perspective.", "wire", 1, "base_report"),
    ];

    const multiStories = [
      story("multi-official", "Finance Ministry says Acme Bank outage is under review", "Officials said regulator asked for statement.", "gov", 2, "official_response"),
      story("multi-market", "Acme Bank shares fell as investors reacted to outage", "Shares fell after investors reacted.", "market", 3, "market_reaction"),
      story("multi-expert", "Analysts explain why Acme Bank outage matters", "Experts warn of wider implications.", "analysis", 4, "expert_analysis"),
    ];

    for (const item of [...singleStories, ...multiStories]) {
      storiesById.set(item.id, item);
    }

    const single = parent("single", singleStories.map(item => item.id), 0.92, true);
    const multi = parent("multi", multiStories.map(item => item.id), 0.62, false);

    const singleScore = computePostTreeQualityScore(single, storiesById, cfg);
    const multiScore = computePostTreeQualityScore(multi, storiesById, cfg);

    expect(multiScore).toBeGreaterThan(singleScore);
    expect((multi.debug as any).postTreeQualityDiagnostics.visibleAngleCount).toBe(3);
  });

  it("selects the multi-angle parent even when pre-tree ranking placed it lower", () => {
    const hiddenIds = new Set<string>();
    const storiesById = new Map<string, InsightStory>();

    const singleStories = [
      story("single-1", "MegaCorp reports quarterly update", "Company update repeats the same base report.", "wire_1", 10),
      story("single-2", "MegaCorp update continues", "Company update repeats the same base report.", "wire_1", 11),
    ];

    const multiStories = [
      story("official", "Finance Ministry says Acme Bank outage is under review", "Officials said regulator asked for statement.", "gov", 20),
      story("market", "Acme Bank shares fell as investors reacted to outage", "Shares fell after investors reacted.", "market", 21),
      story("expert", "Analysts explain why Acme Bank outage matters", "Experts warn of wider implications.", "analysis", 22),
      story("reaction", "Customers criticise Acme Bank after outage goes viral", "Users reacted on social media.", "reaction", 23),
    ];

    for (const item of [...singleStories, ...multiStories]) {
      storiesById.set(item.id, item);
    }

    const highSingle = parent("single-high-score", singleStories.map(item => item.id), 0.94, false);
    const lowerMulti = parent("multi-lower-score", multiStories.map(item => item.id), 0.60, false);

    const selected = selectTopParentsWithWeakTreeCheck(
      [highSingle, lowerMulti],
      storiesById,
      cfg,
      hiddenIds
    );

    expect(selected[0].parentId).toBe("multi-lower-score");
    expect((selected[0].debug as any).postTreeQualityDiagnostics.visibleAngleCount).toBeGreaterThanOrEqual(3);
  });
});
