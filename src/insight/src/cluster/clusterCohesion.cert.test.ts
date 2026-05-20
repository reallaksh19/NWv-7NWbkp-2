import { describe, expect, it } from "vitest";
import { clusterIntoParentEvents } from "./cluster";
import { eventSimilarity, applyClusterOverrides } from "../dedup/dedup";
import { DEFAULT_CONFIG, InsightConfig, InsightStory } from "../types";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function embedding(seed: number): number[] {
  const vector = Array.from({ length: 200 }, () => 0);
  vector[seed % 200] = 1;
  vector[(seed + 29) % 200] = 0.25;
  return vector;
}

function story(
  id: string,
  title: string,
  summary: string,
  sourceGroup: string,
  category: string,
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
    category,
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
    eventVerbs: [],
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

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  SAME_EVENT_THRESHOLD: 0.88,
  POSSIBLE_EVENT_THRESHOLD: 0.75,
  TIER_D_EXCLUDE: false,
};

describe("Insight cluster cohesion certification", () => {
  it("topic cohesion raises cross-source angle variants into the same event cluster", () => {
    const base = story(
      "base",
      "Acme Bank payment outage recovery begins",
      "Acme Bank says failed payments are being restored across India.",
      "wire_group",
      "national",
      1
    );

    const official = story(
      "official",
      "Finance Ministry says Acme Bank outage is under review",
      "Officials said the regulator asked Acme Bank for a statement on payment failures.",
      "gov_group",
      "policy",
      41
    );

    const market = story(
      "market",
      "Acme Bank shares fell as investors reacted to outage",
      "Investors sold banking stocks after the Acme Bank payment outage.",
      "market_group",
      "business",
      82
    );

    const raw = eventSimilarity(official, base);
    const rule = applyClusterOverrides(official, base, raw, cfg);

    expect(rule).toBe("SAME");

    const clusters = clusterIntoParentEvents([base, official, market], cfg);

    expect(clusters.length).toBe(1);
    expect(clusters[0].stories.length).toBe(3);
  });

  it("does not cluster unrelated same-day stories only because they are fresh", () => {
    const bank = story(
      "bank",
      "Acme Bank payment outage recovery begins",
      "Acme Bank says failed payments are being restored across India.",
      "wire_group",
      "national",
      1
    );

    const sports = story(
      "sports",
      "City football final ends with late goal",
      "The team won the tournament after a dramatic match.",
      "sports_group",
      "sports",
      99
    );

    sports.entities.orgs = ["City Football Club"];
    sports.keywords = ["football", "final", "match"];

    const clusters = clusterIntoParentEvents([bank, sports], cfg);

    expect(clusters.length).toBe(2);
  });
});
