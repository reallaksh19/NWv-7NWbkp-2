import { describe, expect, it } from 'vitest';
import {
  computeClusterSeedScore,
  computeParentRepresentativeScore,
  createCanonicalParent,
} from './cluster';
import { DEFAULT_CONFIG } from '../types';
import type { InsightStory } from '../types';

function story(overrides: Partial<InsightStory>): InsightStory {
  const id = overrides.id || 'story';

  return {
    id,
    title: overrides.title || id,
    summary: overrides.summary || 'A compact certification story summary.',
    source: overrides.source || 'Source A',
    sourceGroup: overrides.sourceGroup || 'source-a',
    url: `https://example.com/${id}`,
    publishedAt: overrides.publishedAt ?? 1000,
    category: 'news',
    region: 'IN',
    language: 'en',

    capturedAtSnapshot: overrides.capturedAtSnapshot || 'now',
    canonicalUrl: `https://example.com/${id}`,
    canonicalText: id,
    canonicalTextHash: id,

    entities: {
      people: [],
      orgs: ['Org'],
      places: ['India'],
      products: [],
      symbols: [],
    },

    keywords: [],
    embedding: [1, 0, 0],
    eventVerbs: ['announced'],
    numbers: [],

    sourceTier: 'A',
    sourceAuthority: overrides.sourceAuthority ?? 0.8,
    freshnessScore: overrides.freshnessScore ?? 0.8,
    rawProminence: overrides.rawProminence ?? 0.8,
    sentiment: 0,
    factualDensity: overrides.factualDensity ?? 0.8,
    summaryQuality: overrides.summaryQuality ?? 0.8,

    angle: 'base_report',

    ...overrides,
  };
}

describe('Insight cluster top-story anchoring certification', () => {
  it('raises cluster seed score for higher rawProminence and freshness', () => {
    const low = story({
      id: 'low',
      sourceAuthority: 0.8,
      rawProminence: 0.1,
      freshnessScore: 0.1,
    });

    const high = story({
      id: 'high',
      sourceAuthority: 0.8,
      rawProminence: 1.0,
      freshnessScore: 1.0,
    });

    expect(computeClusterSeedScore(high)).toBeGreaterThan(computeClusterSeedScore(low));
  });

  it('parent representative score uses rawProminence and freshness', () => {
    const low = story({
      id: 'low',
      sourceAuthority: 0.9,
      rawProminence: 0.1,
      freshnessScore: 0.1,
    });

    const high = story({
      id: 'high',
      sourceAuthority: 0.9,
      rawProminence: 1.0,
      freshnessScore: 1.0,
    });

    expect(computeParentRepresentativeScore(high)).toBeGreaterThan(computeParentRepresentativeScore(low));
  });

  it('canonical parent headline uses the better representative story', () => {
    const olderLowProminence = story({
      id: 'older-low',
      title: 'Older low prominence headline',
      sourceAuthority: 0.85,
      rawProminence: 0.1,
      freshnessScore: 0.2,
      summaryQuality: 0.7,
      factualDensity: 0.7,
      publishedAt: 1000,
    });

    const freshTopStory = story({
      id: 'fresh-top',
      title: 'Fresh top story headline',
      sourceAuthority: 0.85,
      rawProminence: 1.0,
      freshnessScore: 1.0,
      summaryQuality: 0.7,
      factualDensity: 0.7,
      publishedAt: 2000,
    });

    const parent = createCanonicalParent({
      id: 'cluster_test',
      stories: [olderLowProminence, freshTopStory],
      centroidEmbedding: [1, 0, 0],
    } as any, DEFAULT_CONFIG);

    expect(parent.canonicalHeadline).toBe('Fresh top story headline');
    expect((parent.debug as any).representativeDiagnostics.formulaVersion).toBe(
      'cluster-representative-v2-top-story-anchor'
    );
    expect((parent.debug as any).representativeDiagnostics.representativeId).toBe('fresh-top');
  });
});