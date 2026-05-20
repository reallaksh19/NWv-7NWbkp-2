import { describe, expect, it } from "vitest";
import { recoverAngleDiversity, scoreAngleRecoveryCandidate } from "./angleDiversityRecovery";
import {
  ChildCandidate,
  InsightConfig,
  InsightStory,
  DEFAULT_CONFIG,
} from "../types";

function story(id: string, angle: any, sourceGroup: string): InsightStory {
  return {
    id,
    title: `${angle} title for Acme Bank story`,
    summary: `${angle} summary includes official market analyst explainer public reaction signals and 4 percent data.`,
    source: sourceGroup,
    sourceGroup,
    url: `https://example.com/${id}`,
    publishedAt: Date.parse("2026-01-01T00:00:00Z"),
    category: "news",
    region: "India",
    language: "en",
    capturedAtSnapshot: "now",
    canonicalUrl: `https://example.com/${id}`,
    canonicalText: id,
    canonicalTextHash: `hash-${id}`,
    entities: {
      people: [],
      orgs: ["Acme Bank"],
      places: ["India"],
      products: [],
      symbols: [],
    },
    keywords: ["acme", "bank", "policy"],
    embedding: Array.from({ length: 200 }, (_, index) => index === id.length ? 1 : 0),
    eventVerbs: ["announces"],
    numbers: ["4 percent"],
    sourceTier: "A",
    sourceAuthority: 0.85,
    freshnessScore: 0.9,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.9,
    angle,
  };
}

function candidate(item: InsightStory): ChildCandidate {
  return {
    story: item,
    angle: item.angle || "unknown",
    relevanceToParent: 0.8,
    informationGain: 0.05,
    sourceDiversityBonus: 0,
    angleUniqueness: 1,
    childScore: 0.62,
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  MAX_CHILDREN_PER_PARENT: 7,
  MAX_PER_SOURCE_GROUP: 2,
};

describe("Insight angle diversity recovery certification", () => {
  it("scores new-angle recovery candidates above repeated angles", () => {
    const selected = [story("base", "base_report", "wire")];
    const newAngle = candidate(story("official", "official_response", "gov"));
    const repeatedAngle = candidate(story("base-2", "base_report", "wire2"));

    const newScore = scoreAngleRecoveryCandidate(newAngle, selected, cfg);
    const repeatedScore = scoreAngleRecoveryCandidate(repeatedAngle, selected, cfg);

    expect(newScore.score).toBeGreaterThan(repeatedScore.score);
    expect(newScore.reasons.join(" ")).toContain("new visible angle");
  });

  it("recovers missing visible angles from remaining candidates", () => {
    const selected = [story("base", "base_report", "wire")];

    const remaining = [
      candidate(story("official", "official_response", "gov")),
      candidate(story("market", "market_reaction", "market")),
      candidate(story("expert", "expert_analysis", "analysis")),
    ];

    const result = recoverAngleDiversity(selected, remaining, cfg, 3);

    expect(result.beforeAngleCount).toBe(1);
    expect(result.afterAngleCount).toBeGreaterThanOrEqual(3);
    expect(result.recoveredCount).toBeGreaterThanOrEqual(2);
    expect(selected.map(item => item.angle)).toContain("official_response");
    expect(selected.map(item => item.angle)).toContain("market_reaction");
    expect(result.recoveredDiagnostics.length).toBe(result.recoveredCount);
  });

  it("does not recover unknown-only candidates", () => {
    const selected = [story("base", "base_report", "wire")];
    const remaining = [candidate(story("unknown", "unknown", "unknown-source"))];

    const result = recoverAngleDiversity(selected, remaining, cfg, 3);

    expect(result.recoveredCount).toBe(0);
    expect(result.afterAngleCount).toBe(1);
  });
});
