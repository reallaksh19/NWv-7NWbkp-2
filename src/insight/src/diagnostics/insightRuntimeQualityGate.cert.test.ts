import { describe, expect, it } from "vitest";
import {
  isInsightQualityAcceptable,
  makeInsightRecoveryConfig,
  recoverInsightRuntimeQuality,
} from "./insightRuntimeQualityGate";
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
  values[(seed + 31) % 200] = 0.4;
  return values;
}

function story(
  id: string,
  title: string,
  summary: string,
  sourceGroup: string,
  seed: number
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
    factualDensity: 0.72,
    summaryQuality: 0.9,
  };
}

function parent(stories: InsightStory[]): InsightParent {
  return {
    parentId: "parent-acme",
    canonicalHeadline: "Acme Bank outage",
    canonicalSummary: "Acme Bank outage has recoverable angles",
    clusterStoryIds: stories.map(item => item.id),
    childStoryIds: [stories[0].id],
    hiddenDuplicateIds: stories.slice(1).map(item => item.id),
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: NOW,
    latestSeenAt: NOW,
    snapshotPresence: {
      now: true,
      minus4h: true,
      minus12h: true,
      minus24h: false,
    },
    impactScore: 0.55,
    persistenceScore: 0.55,
    sourceDiversityScore: 0.55,
    noveltyScore: 0.55,
    freshnessScore: 0.55,
    crossSnapshotMomentum: 0.55,
    editorialClarityScore: 0.55,
    regionBoost: 0,
    finalParentScore: 0.55,
    isRising: false,
    weakTree: true,
    debug: {
      clusterSize: stories.length,
      hiddenCount: stories.length - 1,
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

describe("Insight runtime quality gate certification", () => {
  it("recognizes acceptable C-or-better multi-angle diagnostics", () => {
    expect(isInsightQualityAcceptable({
      grade: "C",
      multiAngleCount: 1,
      avgAngles: 2.1,
    })).toBe(true);

    expect(isInsightQualityAcceptable({
      grade: "D",
      multiAngleCount: 1,
      avgAngles: 2.1,
    })).toBe(false);
  });

  it("creates a relaxed recovery config without mutating the base config", () => {
    const recovered = makeInsightRecoveryConfig(cfg);

    expect(recovered.MIN_CHILD_INFO_GAIN).toBeLessThan(cfg.MIN_CHILD_INFO_GAIN);
    expect(recovered.WEAK_TREE_CHILD_MIN).toBeLessThanOrEqual(cfg.WEAK_TREE_CHILD_MIN);
    expect(cfg.MIN_CHILD_INFO_GAIN).toBe(0.95);
  });

  it("recovers a weak single-child result when cluster stories contain visible angles", () => {
    const stories = [
      story(
        "base",
        "Acme Bank announces payment outage recovery",
        "Acme Bank says failed payments are being restored across India.",
        "wire",
        1
      ),
      story(
        "official",
        "Finance Ministry says Acme Bank outage is under review",
        "Officials said the regulator asked Acme Bank for a statement.",
        "gov",
        2
      ),
      story(
        "market",
        "Acme Bank shares fell as investors reacted to outage",
        "Shares fell 4 percent and investors sold banking stocks.",
        "market",
        3
      ),
      story(
        "expert",
        "Analysts explain why Acme Bank outage matters",
        "Experts warn of wider implications.",
        "analysis",
        4
      ),
    ];

    const result = {
      parents: [parent(stories)],
      storiesById: new Map(stories.map(item => [item.id, item])),
    };

    const recovered = recoverInsightRuntimeQuality(result, "live", cfg);

    expect(recovered.gate.attempted).toBe(true);
    expect(recovered.result.runtimeQualityGate.attempted).toBe(true);
    expect(recovered.result.parents[0].childStoryIds.length).toBeGreaterThanOrEqual(3);
    expect(recovered.diagnostics.avgAngles).toBeGreaterThanOrEqual(2);
    expect(recovered.diagnostics.multiAngleCount).toBeGreaterThanOrEqual(1);
  });
});
