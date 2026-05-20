import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightStory,
  SnapshotSlot,
} from "./types";
import { runInsightPipeline } from "./pipeline/pipeline";
import { invalidateSlot } from "./cache/cacheManager";
import { classifyAngle } from "./dedup/dedup";
import { getInsightCoreQualityDiagnostics, getVisibleChildAngles } from "./diagnostics/insightCoreQuality";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function embedding(seed: number): number[] {
  const vector = Array.from({ length: 200 }, (_, index) => 0);
  vector[seed % 200] = 1;
  vector[(seed + 17) % 200] = 0.5;
  vector[(seed + 53) % 200] = 0.25;
  return vector;
}

function makeStory(partial: Partial<InsightStory> & {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceGroup: string;
  slot: SnapshotSlot;
  seed: number;
}): InsightStory {
  return {
    id: partial.id,
    title: partial.title,
    summary: partial.summary,
    source: partial.source,
    sourceGroup: partial.sourceGroup,
    url: partial.url || `https://example.com/${partial.id}`,
    publishedAt: partial.publishedAt || NOW,
    category: partial.category || "national",
    region: partial.region || "India",
    language: "en",
    capturedAtSnapshot: partial.slot,
    canonicalUrl: partial.canonicalUrl || `https://example.com/${partial.id}`,
    canonicalText: `${partial.title} ${partial.summary}`,
    canonicalTextHash: partial.canonicalTextHash || `hash-${partial.id}`,
    entities: partial.entities || {
      people: [],
      orgs: ["Acme Bank"],
      places: ["India"],
      products: [],
      symbols: [],
    },
    keywords: partial.keywords || ["acme", "bank", "policy"],
    embedding: partial.embedding || embedding(partial.seed),
    eventVerbs: partial.eventVerbs || ["announces"],
    numbers: partial.numbers || [],
    sourceTier: partial.sourceTier || "A",
    sourceAuthority: partial.sourceAuthority ?? 0.82,
    freshnessScore: partial.freshnessScore ?? 0.86,
    rawProminence: partial.rawProminence ?? 0.8,
    sentiment: partial.sentiment ?? 0,
    factualDensity: partial.factualDensity ?? 0.75,
    summaryQuality: partial.summaryQuality ?? 0.9,
    angle: partial.angle,
    bucket: partial.bucket,
    parentId: partial.parentId,
  };
}

const fixtureStories = [
  makeStory({
    id: "base-1",
    title: "Acme Bank announces national digital payments outage recovery",
    summary: "Acme Bank says services are being restored across India after a payments outage affected customers.",
    source: "News Wire",
    sourceGroup: "wire_group",
    slot: "now",
    seed: 1,
    numbers: ["2 hours"],
  }),
  makeStory({
    id: "official-1",
    title: "Finance Ministry says Acme Bank outage is being reviewed",
    summary: "Officials said the regulator asked Acme Bank for a statement and confirmed customer deposits remain protected.",
    source: "Government Desk",
    sourceGroup: "gov_group",
    slot: "now",
    seed: 2,
    category: "policy",
  }),
  makeStory({
    id: "market-1",
    title: "Acme Bank shares fell as investors reacted to outage",
    summary: "Shares fell 4 percent in intraday trading while investors sold banking stocks after the outage.",
    source: "Market Desk",
    sourceGroup: "market_group",
    slot: "minus4h",
    seed: 3,
    category: "business",
    numbers: ["4 percent"],
  }),
  makeStory({
    id: "expert-1",
    title: "Analysts explain why Acme Bank outage matters",
    summary: "Experts warn the outage could raise compliance costs and analysts say the incident has wider implications.",
    source: "Analysis Desk",
    sourceGroup: "analysis_group",
    slot: "minus4h",
    seed: 4,
    category: "analysis",
  }),
  makeStory({
    id: "reaction-1",
    title: "Customers criticise Acme Bank after outage goes viral",
    summary: "Users reacted on social media and residents said payment failures caused delays at shops.",
    source: "Social Desk",
    sourceGroup: "reaction_group",
    slot: "minus12h",
    seed: 5,
    category: "society",
  }),
  makeStory({
    id: "background-1",
    title: "Explainer: what led to Acme Bank payment outage",
    summary: "A timeline explains how it started, key points, and why this matters for digital banking.",
    source: "Explainer Desk",
    sourceGroup: "explainer_group",
    slot: "minus24h",
    seed: 6,
    category: "explainer",
  }),
];

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  TOP_PARENTS: 3,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.12,
  WEAK_TREE_CHILD_MIN: 3,
  MIN_SOURCES_PER_TREE: 3,
  TIER_D_EXCLUDE: false,
};

function resetInsightCache() {
  for (const slot of ["now", "minus4h", "minus12h", "minus24h"] as SnapshotSlot[]) {
    invalidateSlot(slot);
  }
}

describe("Insight core recovery certification", () => {
  it("classifies real story-angle variants beyond base_report", () => {
    const angles = fixtureStories.map(story => classifyAngle(story));

    expect(angles).toContain("official_response");
    expect(angles).toContain("market_reaction");
    expect(angles).toContain("expert_analysis");
    expect(angles).toContain("reaction_public");
    expect(angles).toContain("background_context");
  });

  it("persists selected child angles into storiesById and reaches C-or-better quality", async () => {
    resetInsightCache();

    const result = await runInsightPipeline(async slot => (
      fixtureStories.filter(story => story.capturedAtSnapshot === slot)
    ), cfg);

    expect(result.parents.length).toBeGreaterThanOrEqual(1);

    const topParent = result.parents[0];
    const childStories = topParent.childStoryIds
      .map(id => result.storiesById.get(id))
      .filter(Boolean) as InsightStory[];

    const visibleAngles = getVisibleChildAngles(topParent, result.storiesById);

    expect(childStories.length).toBeGreaterThanOrEqual(4);
    expect(visibleAngles.length).toBeGreaterThanOrEqual(3);
    expect(childStories.some(story => !story.angle || story.angle === "unknown")).toBe(false);

    const quality = getInsightCoreQualityDiagnostics(result, "live", cfg);
    const gradeOrder = ["F", "D", "C", "B", "A"];

    expect(gradeOrder.indexOf(quality.grade)).toBeGreaterThanOrEqual(gradeOrder.indexOf("C"));
    expect(quality.multiAngleCount).toBeGreaterThanOrEqual(1);
    expect(quality.avgAngles).toBeGreaterThanOrEqual(3);
  });
});
