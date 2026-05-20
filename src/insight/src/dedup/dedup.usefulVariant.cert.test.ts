import { describe, expect, it } from 'vitest';
import {
  createDuplicateDiagnostics,
  removeHardDuplicates,
  shouldKeepUsefulVariantOverEmbeddingDuplicate,
} from './dedup';
import { DEFAULT_CONFIG } from '../types';
import type { InsightStory } from '../types';

function story(overrides: Partial<InsightStory>): InsightStory {
  const id = overrides.id || 'story';

  return {
    id,
    title: 'Company announces investment plan',
    summary: 'The company announced a new investment plan with official details.',
    source: 'Source A',
    sourceGroup: 'source-a',
    url: `https://example.com/${id}`,
    publishedAt: Date.now(),
    category: 'business',
    region: 'IN',
    language: 'en',

    capturedAtSnapshot: 'now',
    canonicalUrl: `https://example.com/${id}`,
    canonicalText: id,
    canonicalTextHash: id,

    entities: {
      people: [],
      orgs: ['Company'],
      places: ['India'],
      products: [],
      symbols: [],
    },

    keywords: [],
    embedding: [1, 0, 0],
    eventVerbs: ['announced'],
    numbers: ['100 crore'],

    sourceTier: 'A',
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,

    angle: 'base_report',

    ...overrides,
  };
}

describe('Insight useful variant rescue certification', () => {
  it('rescues a cross-source distinct-angle embedding match', () => {
    const existing = story({
      id: 'existing',
      title: 'Company announces investment plan',
      summary: 'The company announced a new investment plan with official details.',
      source: 'Source A',
      sourceGroup: 'source-a',
      canonicalUrl: 'https://example.com/existing',
      canonicalTextHash: 'hash-existing',
      embedding: [1, 0, 0],
      numbers: ['100 crore'],
    });

    const candidate = story({
      id: 'candidate',
      title: 'Shares rose after investment plan',
      summary: 'Shares rose after the company announced the investment plan and market reaction improved.',
      source: 'Source B',
      sourceGroup: 'source-b',
      canonicalUrl: 'https://example.com/candidate',
      canonicalTextHash: 'hash-candidate',
      embedding: [1, 0, 0],
      numbers: ['100 crore', '5%'],
    });

    expect(shouldKeepUsefulVariantOverEmbeddingDuplicate(candidate, existing)).toBe(true);

    const hiddenIds = new Set<string>();
    const diagnostics = createDuplicateDiagnostics();

    const kept = removeHardDuplicates(
      [existing, candidate],
      DEFAULT_CONFIG,
      hiddenIds,
      diagnostics
    );

    expect(kept.map(item => item.id)).toContain('existing');
    expect(kept.map(item => item.id)).toContain('candidate');
    expect(hiddenIds.has('candidate')).toBe(false);
    expect(diagnostics.reasonCounts.USEFUL_EMBEDDING_VARIANT_RESCUED).toBe(1);
  });

  it('does not rescue same canonical URL duplicates', () => {
    const existing = story({
      id: 'existing',
      canonicalUrl: 'https://example.com/same',
      canonicalTextHash: 'hash-existing',
      embedding: [1, 0, 0],
    });

    const candidate = story({
      id: 'candidate',
      sourceGroup: 'source-b',
      canonicalUrl: 'https://example.com/same',
      canonicalTextHash: 'hash-candidate',
      embedding: [1, 0, 0],
    });

    expect(shouldKeepUsefulVariantOverEmbeddingDuplicate(candidate, existing)).toBe(false);

    const hiddenIds = new Set<string>();
    const diagnostics = createDuplicateDiagnostics();

    const kept = removeHardDuplicates(
      [existing, candidate],
      DEFAULT_CONFIG,
      hiddenIds,
      diagnostics
    );

    expect(kept.length).toBe(1);
    expect(hiddenIds.size).toBe(1);
    expect(diagnostics.reasonCounts.CANONICAL_URL_DUPLICATE).toBe(1);
  });

  it('does not rescue same-source embedding duplicates', () => {
    const existing = story({
      id: 'existing',
      sourceGroup: 'source-a',
      canonicalUrl: 'https://example.com/existing',
      canonicalTextHash: 'hash-existing',
      embedding: [1, 0, 0],
    });

    const candidate = story({
      id: 'candidate',
      sourceGroup: 'source-a',
      canonicalUrl: 'https://example.com/candidate',
      canonicalTextHash: 'hash-candidate',
      embedding: [1, 0, 0],
      title: 'Shares rose after investment plan',
      summary: 'Shares rose after the investment plan.',
      numbers: ['100 crore', '5%'],
    });

    expect(shouldKeepUsefulVariantOverEmbeddingDuplicate(candidate, existing)).toBe(false);

    const hiddenIds = new Set<string>();
    const diagnostics = createDuplicateDiagnostics();

    const kept = removeHardDuplicates(
      [existing, candidate],
      DEFAULT_CONFIG,
      hiddenIds,
      diagnostics
    );

    expect(kept.length).toBe(1);
    expect(hiddenIds.size).toBe(1);
    expect(diagnostics.reasonCounts.HARD_EMBEDDING_SIMILARITY).toBe(1);
  });
});