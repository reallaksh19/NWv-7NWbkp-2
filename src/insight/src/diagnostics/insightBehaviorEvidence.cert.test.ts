import { describe, expect, it } from "vitest";
import { getInsightBehaviorEvidence } from "./insightBehaviorEvidence";
import type { InsightParent, InsightStory } from "../types";

function story(id: string, angle: InsightStory["angle"]): InsightStory {
  return {
    id,
    title: id,
    summary: "Summary",
    source: "Source",
    sourceGroup: "source-group",
    url: `https://example.com/${id}`,
    publishedAt: 1,
    category: "news",
    region: "IN",
    language: "en",
    capturedAtSnapshot: "now",
    canonicalUrl: `https://example.com/${id}`,
    canonicalText: id,
    canonicalTextHash: id,
    entities: { people: [], orgs: ["Org"], places: ["India"], products: [], symbols: [] },
    keywords: [],
    embedding: [1, 0, 0],
    eventVerbs: ["announced"],
    numbers: [],
    sourceTier: "A",
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,
    angle,
  };
}

function parent(): InsightParent {
  return {
    parentId: "parent-1",
    canonicalHeadline: "Port story",
    canonicalSummary: "Summary",
    clusterStoryIds: ["child-1", "child-2", "child-3"],
    childStoryIds: ["child-1", "child-2", "child-3"],
    hiddenDuplicateIds: [],
    keyEntities: [],
    keyPlaces: [],
    keyVerbs: [],
    keyNumbers: [],
    firstSeenAt: 1,
    latestSeenAt: 2,
    snapshotPresence: {
      now: true,
      minus4h: true,
      minus12h: true,
      minus24h: true,
    },
    impactScore: 0.8,
    persistenceScore: 1,
    sourceDiversityScore: 0.8,
    noveltyScore: 0.8,
    freshnessScore: 0.8,
    crossSnapshotMomentum: 0.8,
    editorialClarityScore: 0.8,
    regionBoost: 0,
    finalParentScore: 0.8,
    isRising: false,
    weakTree: false,
    debug: {
      clusterSize: 3,
      hiddenCount: 0,
      matchedSnapshots: ["now", "minus4h", "minus12h", "minus24h"],
      scoreBreakdown: {},
      replacements: [],
      impactScoreDiagnostics: {
        formulaVersion: "impact-v2-top-story-anchor",
        topStoryProminenceScore: 0.92,
      },
      representativeDiagnostics: {
        formulaVersion: "cluster-representative-v2-top-story-anchor",
        representativeScore: 0.88,
      },
      childSelectionDiagnostics: {
        diversityTieBreaks: [{ selectedId: "child-2" }],
        duplicateReasonCounts: {
          USEFUL_EMBEDDING_VARIANT_RESCUED: 1,
        },
      },
    } as any,
  };
}

describe("Insight behavior evidence certification", () => {
  it("summarizes top-story, representative, diversity, rescue and 24h evidence", () => {
    const storiesById = new Map<string, InsightStory>([
      ["child-1", story("child-1", "official_response")],
      ["child-2", story("child-2", "market_reaction")],
      ["child-3", story("child-3", "background_context")],
    ]);

    const evidence = getInsightBehaviorEvidence({
      parents: [parent()],
      storiesById,
    });

    expect(evidence.status).toBe("strong");
    expect(evidence.clusterCount).toBe(1);
    expect(evidence.storyCount).toBe(3);
    expect(evidence.childCount).toBe(3);
    expect(evidence.angleCount).toBe(3);
    expect(evidence.full24hClusters).toBe(1);
    expect(evidence.impactAnchoredClusters).toBe(1);
    expect(evidence.representativeAnchoredClusters).toBe(1);
    expect(evidence.diversityTieBreaks).toBe(1);
    expect(evidence.usefulVariantRescues).toBe(1);
    expect(evidence.parentRows[0].snapshotCoverage).toBe("4/4");
    expect(evidence.parentRows[0].hasMultiAngleCoverage).toBe(true);
  });

  it("handles empty results safely", () => {
    const evidence = getInsightBehaviorEvidence({ parents: [], storiesById: new Map() });

    expect(evidence.status).toBe("thin");
    expect(evidence.clusterCount).toBe(0);
    expect(evidence.notes.join(" ")).toContain("No ranked clusters");
  });
});