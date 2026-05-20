import { describe, expect, it } from "vitest";
import { buildChildTree } from "./treeBuilder";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightParent,
  InsightStory,
} from "../types";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function embedding(seed: number): number[] {
  const vector = Array.from({ length: 200 }, () => 0);
  vector[seed % 200] = 1;
  vector[(seed + 11) % 200] = 0.5;
  return vector;
}

function makeStory(id: string, title: string, summary: string, sourceGroup: string, seed: number): InsightStory {
  return {
    id,
    title,
    summary,
    source: sourceGroup,
    sourceGroup,
    url: `https://example.com/${id}`,
    publishedAt: NOW,
    category: "national",
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
    embedding: embedding(seed),
    eventVerbs: ["announces"],
    numbers: [],
    sourceTier: "A",
    sourceAuthority: 0.82,
    freshnessScore: 0.86,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.7,
    summaryQuality: 0.9,
  };
}

function makeParent(stories: InsightStory[]): InsightParent {
  return {
    parentId: "parent-acme-outage",
    canonicalHeadline: "Acme Bank outage recovery",
    canonicalSummary: "Acme Bank outage has official, market, expert and public angles.",
    clusterStoryIds: stories.map(story => story.id),
    childStoryIds: [],
    hiddenDuplicateIds: [],
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: NOW,
    latestSeenAt: NOW,
    snapshotPresence: {
      now: true,
      minus4h: true,
      minus12h: false,
      minus24h: false,
    },
    impactScore: 0,
    persistenceScore: 0.8,
    sourceDiversityScore: 0.9,
    noveltyScore: 0.8,
    freshnessScore: 0.9,
    crossSnapshotMomentum: 0.8,
    editorialClarityScore: 0.9,
    regionBoost: 0,
    finalParentScore: 0,
    isRising: false,
    weakTree: false,
    debug: {
      clusterSize: stories.length,
      hiddenCount: 0,
      matchedSnapshots: ["now"],
      scoreBreakdown: {},
      replacements: [],
    },
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.95,
  WEAK_TREE_CHILD_MIN: 3,
  MIN_SOURCES_PER_TREE: 3,
  TIER_D_EXCLUDE: false,
};

describe("Tree builder angle recovery certification", () => {
  it("recovers visible angle diversity even when strict information gain rejects candidates", () => {
    const stories = [
      makeStory(
        "base",
        "Acme Bank announces payment outage recovery",
        "Acme Bank says payment services are being restored across India.",
        "wire_group",
        1
      ),
      makeStory(
        "official",
        "Finance Ministry says Acme Bank outage is under review",
        "Officials said the regulator asked Acme Bank for a statement and confirmed deposits remain protected.",
        "gov_group",
        2
      ),
      makeStory(
        "market",
        "Acme Bank shares fell as investors reacted to outage",
        "Shares fell 4 percent and investors sold banking stocks after the outage.",
        "market_group",
        3
      ),
      makeStory(
        "expert",
        "Analysts explain why Acme Bank outage matters",
        "Experts warn the outage could raise compliance costs and analysts say the incident has wider implications.",
        "analysis_group",
        4
      ),
      makeStory(
        "reaction",
        "Customers criticise Acme Bank after outage goes viral",
        "Users reacted on social media and residents said failed payments caused delays.",
        "reaction_group",
        5
      ),
    ];

    const parent = makeParent(stories);
    const hiddenIds = new Set<string>();

    const children = buildChildTree(parent, stories, cfg, hiddenIds);
    const angles = [...new Set(children.map(child => child.angle || "unknown"))];

    expect(children.length).toBeGreaterThanOrEqual(3);
    expect(angles.length).toBeGreaterThanOrEqual(3);
    expect(angles).toContain("official_response");
    expect(angles).toContain("market_reaction");
    expect(parent.debug.childSelectionDiagnostics.angleRecovery.recoveredCount).toBeGreaterThanOrEqual(1);
    expect(parent.debug.childSelectionDiagnostics.angleRecovery.afterAngleCount).toBeGreaterThanOrEqual(3);
  });
});
