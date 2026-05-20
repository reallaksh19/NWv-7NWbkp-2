import { describe, expect, it } from "vitest";
import {
  INSIGHT_OUTPUT_CONTRACT_VERSION,
  getInsightResultRepairSummary,
  isInsightResultContractCurrent,
  repairInsightResult,
} from "./insightResultRepair";
import { InsightParent, InsightStory } from "../types";

function story(id: string, title: string, summary: string): InsightStory {
  return {
    id,
    title,
    summary,
    source: "source",
    sourceGroup: "source_group",
    url: `https://example.com/${id}`,
    publishedAt: Date.parse("2026-01-01T00:00:00Z"),
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
    keywords: ["acme", "bank"],
    embedding: Array.from({ length: 200 }, (_, index) => index === 1 ? 1 : 0),
    eventVerbs: ["announces"],
    numbers: [],
    sourceTier: "A",
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,
  };
}

function parent(): InsightParent {
  return {
    parentId: "parent-1",
    canonicalHeadline: "Acme Bank outage",
    canonicalSummary: "Acme Bank outage has multiple angles",
    clusterStoryIds: ["official", "market"],
    childStoryIds: ["official", "market"],
    hiddenDuplicateIds: [],
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: Date.parse("2026-01-01T00:00:00Z"),
    latestSeenAt: Date.parse("2026-01-01T00:00:00Z"),
    snapshotPresence: {
      now: true,
      minus4h: false,
      minus12h: false,
      minus24h: false,
    },
    impactScore: 0.8,
    persistenceScore: 0.8,
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
      clusterSize: 2,
      hiddenCount: 0,
      matchedSnapshots: ["now"],
      scoreBreakdown: {},
      replacements: [],
    },
  };
}

describe("Insight result repair certification", () => {
  it("backfills missing child angles in cached storiesById map", () => {
    const result = {
      parents: [parent()],
      storiesById: new Map([
        [
          "official",
          story(
            "official",
            "Finance Ministry says Acme Bank outage is under review",
            "Officials said the regulator asked Acme Bank for a statement"
          ),
        ],
        [
          "market",
          story(
            "market",
            "Acme Bank shares fell as investors reacted to outage",
            "Shares fell 4 percent and investors sold banking stocks"
          ),
        ],
      ]),
    };

    const repaired = repairInsightResult(result);
    const official = repaired.storiesById.get("official");
    const market = repaired.storiesById.get("market");

    expect(repaired.outputContractVersion).toBe(INSIGHT_OUTPUT_CONTRACT_VERSION);
    expect(official.angle).toBe("official_response");
    expect(market.angle).toBe("market_reaction");
    expect(repaired.outputContractRepairDiagnostics.repairedStoryAngles).toBe(2);
    expect(isInsightResultContractCurrent(repaired)).toBe(true);
  });

  it("repairs object-shaped cached storiesById after JSON rehydration", () => {
    const result = {
      parents: [parent()],
      storiesById: {
        official: story(
          "official",
          "Finance Ministry says Acme Bank outage is under review",
          "Officials said the regulator asked Acme Bank for a statement"
        ),
        market: story(
          "market",
          "Acme Bank shares fell as investors reacted to outage",
          "Shares fell 4 percent and investors sold banking stocks"
        ),
      },
    };

    const summary = getInsightResultRepairSummary(result);

    expect(summary.current).toBe(true);
    expect(summary.repairedStoryAngles).toBe(2);
    expect(summary.parentsWithVisibleAngles).toBe(1);
  });

  it("keeps already-current contract results current", () => {
    const result = repairInsightResult({
      parents: [parent()],
      storiesById: new Map([
        [
          "official",
          {
            ...story(
              "official",
              "Finance Ministry says Acme Bank outage is under review",
              "Officials said the regulator asked Acme Bank for a statement"
            ),
            angle: "official_response",
          },
        ],
        [
          "market",
          {
            ...story(
              "market",
              "Acme Bank shares fell as investors reacted to outage",
              "Shares fell 4 percent and investors sold banking stocks"
            ),
            angle: "market_reaction",
          },
        ],
      ]),
      outputContractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    });

    expect(isInsightResultContractCurrent(result)).toBe(true);
    expect(result.outputContractRepairDiagnostics.repairedStoryAngles).toBe(0);
  });
});
