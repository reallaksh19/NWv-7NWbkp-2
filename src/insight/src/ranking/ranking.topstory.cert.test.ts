import { describe, expect, it } from 'vitest';
import {
  computeFinalParentScore,
  computeImpactScore,
  computeTopStoryProminenceScore,
} from './ranking';
import type { InsightParent, InsightStory } from '../types';

function story(id: string, rawProminence: number): InsightStory {
  return {
    id,
    title: id,
    summary: 'A compact certification story summary.',
    source: 'source-a',
    sourceGroup: 'source-a',
    url: `https://example.com/${id}`,
    publishedAt: Date.now(),
    category: 'news',
    region: 'IN',
    language: 'en',

    capturedAtSnapshot: 'now',
    canonicalUrl: `https://example.com/${id}`,
    canonicalText: id,
    canonicalTextHash: id,

    entities: {
      people: [],
      orgs: ['Ministry'],
      places: ['India'],
      products: [],
      symbols: [],
    },

    keywords: [],
    embedding: [1, 0, 0],
    eventVerbs: ['announced'],
    numbers: ['1 million'],

    sourceTier: 'A',
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,

    angle: 'base_report',
  };
}

function parent(): InsightParent {
  return {
    parentId: 'parent-1',
    canonicalHeadline: 'Top story anchor',
    canonicalSummary: 'Summary',

    clusterStoryIds: [],
    childStoryIds: [],
    hiddenDuplicateIds: [],

    keyEntities: ['Ministry'],
    keyPlaces: ['India'],
    keyVerbs: ['announced'],
    keyNumbers: ['1 million'],

    firstSeenAt: 0,
    latestSeenAt: 0,

    snapshotPresence: {
      now: true,
      minus4h: false,
      minus12h: false,
      minus24h: false,
    },

    impactScore: 0,
    persistenceScore: 0.7,
    sourceDiversityScore: 0.6,
    noveltyScore: 0.5,
    freshnessScore: 0.4,
    crossSnapshotMomentum: 0.3,
    editorialClarityScore: 0.9,
    regionBoost: 0.03,
    finalParentScore: 0,

    isRising: false,
    weakTree: false,

    debug: {
      clusterSize: 0,
      hiddenCount: 0,
      matchedSnapshots: [],
      scoreBreakdown: {},
      replacements: [],
    },
  };
}

describe('Insight top-story anchoring certification', () => {
  it('computes prominence from max and average rawProminence', () => {
    const stories = [
      story('low', 0.2),
      story('high', 1.0),
    ];

    const prominence = computeTopStoryProminenceScore(stories);

    // 0.6 * max(1.0) + 0.4 * avg(0.6) = 0.84
    expect(prominence).toBeCloseTo(0.84, 8);
  });

  it('clamps rawProminence into the 0..1 range', () => {
    const stories = [
      story('negative', -5),
      story('too-high', 5),
    ];

    const prominence = computeTopStoryProminenceScore(stories);

    expect(prominence).toBeGreaterThanOrEqual(0);
    expect(prominence).toBeLessThanOrEqual(1);
  });

  it('higher rawProminence increases impactScore when all other signals match', () => {
    const lowParent = parent();
    const highParent = parent();

    const lowImpact = computeImpactScore(lowParent, [
      story('low-a', 0.1),
      story('low-b', 0.1),
    ]);

    const highImpact = computeImpactScore(highParent, [
      story('high-a', 1.0),
      story('high-b', 1.0),
    ]);

    expect(highImpact).toBeGreaterThan(lowImpact);
    expect((highParent.debug as any).impactScoreDiagnostics.formulaVersion).toBe('impact-v2-top-story-anchor');
    expect((highParent.debug as any).impactScoreDiagnostics.topStoryProminenceScore).toBe(1);
  });

  it('does not change final parent-score weights', () => {
    const p = parent();

    p.impactScore = 0.8;
    const score = computeFinalParentScore(p);

    const expected =
      0.28 * p.impactScore +
      0.20 * p.persistenceScore +
      0.14 * p.sourceDiversityScore +
      0.12 * p.noveltyScore +
      0.10 * p.freshnessScore +
      0.08 * p.crossSnapshotMomentum +
      0.05 * p.editorialClarityScore +
      0.03 * p.regionBoost;

    expect(score).toBeCloseTo(expected, 10);
  });
});