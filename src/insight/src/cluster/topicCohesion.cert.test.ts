import { describe, expect, it } from "vitest";
import {
  getStoryTopicTokens,
  getTopicCohesionDiagnostics,
  hasSharedTopicSignature,
  topicTokenOverlap,
} from "./topicCohesion";
import { InsightStory } from "../types";

function story(id: string, title: string, summary: string, category = "national"): InsightStory {
  return {
    id,
    title,
    summary,
    source: "source",
    sourceGroup: "source_group",
    url: `https://example.com/${id}`,
    publishedAt: Date.parse("2026-01-01T00:00:00Z"),
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
    embedding: Array.from({ length: 200 }, (_, index) => index === 1 ? 1 : 0),
    eventVerbs: [],
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

describe("Insight topic cohesion certification", () => {
  it("extracts stable topic tokens from title, summary, entities, and keywords", () => {
    const tokens = getStoryTopicTokens(story(
      "a",
      "Acme Bank outage recovery reviewed by regulator",
      "Customers report failed payments after the outage"
    ));

    expect(tokens).toContain("acme");
    expect(tokens).toContain("bank");
    expect(tokens).toContain("outage");
  });

  it("detects shared topic signature across different story angles", () => {
    const official = story(
      "official",
      "Finance Ministry says Acme Bank outage is under review",
      "Officials said the regulator asked Acme Bank for a statement",
      "policy"
    );

    const market = story(
      "market",
      "Acme Bank shares fell as investors reacted to outage",
      "Market traders sold banking stocks after the payment outage",
      "business"
    );

    expect(topicTokenOverlap(official, market)).toBeGreaterThan(0.25);
    expect(hasSharedTopicSignature(official, market)).toBe(true);

    const diagnostics = getTopicCohesionDiagnostics(official, market);
    expect(diagnostics.sharedTopicSignature).toBe(true);
    expect(diagnostics.sharedTokens.length).toBeGreaterThanOrEqual(2);
  });

  it("does not force unrelated topics together", () => {
    const bank = story(
      "bank",
      "Acme Bank outage reviewed by regulator",
      "Officials asked the bank for a payments statement",
      "policy"
    );

    const sports = story(
      "sports",
      "City football final ends with late goal",
      "The team won the tournament after a dramatic match",
      "sports"
    );

    sports.entities.orgs = ["City Football Club"];
    sports.keywords = ["football", "final", "match"];

    expect(hasSharedTopicSignature(bank, sports)).toBe(false);
  });
});
