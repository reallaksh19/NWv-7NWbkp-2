import { describe, expect, it } from 'vitest';
import {
  getSectionsSnapshotRuntimeSummary,
  selectPrefetchedSectionItems,
} from './sectionsSnapshotFetcher';

const snapshot = {
  schemaVersion: 2,
  fetchedAt: Date.now(),
  contentHash: 'abc123',
  sectionQuality: {
    tn: {
      storyCount: 2,
      sourceGroupCount: 2,
      thin: false,
    },
  },
  sections: {
    tn: [
      {
        id: 'a',
        title: 'Chennai rain update',
        summary: 'Schools monitor weather after heavy rain.',
        url: 'https://example.com/a',
        source: 'The Hindu Chennai',
        sourceGroup: 'the_hindu',
        publishedAt: Date.now() - 1000,
      },
      {
        id: 'b',
        title: 'Tamil Nadu transport update',
        summary: 'Officials announced route changes.',
        url: 'https://example.com/b',
        source: 'DT Next',
        sourceGroup: 'dtnext',
        publishedAt: Date.now() - 2000,
      },
    ],
  },
};

describe('Sections snapshot browser ingestion certification', () => {
  it('summarizes section snapshot runtime quality', () => {
    const summary = getSectionsSnapshotRuntimeSummary(snapshot);

    expect(summary.supported).toBe(true);
    expect(summary.schemaVersion).toBe(2);
    expect(summary.hasSectionQuality).toBe(true);
    expect(summary.totalStories).toBe(2);
  });

  it('maps chennai requests to tn prefetched section', () => {
    const result = selectPrefetchedSectionItems(snapshot, 'chennai', 10);

    expect(result.sourceSection).toBe('tn');
    expect(result.items.length).toBe(2);
    expect(result.quality.sourceGroupCount).toBe(2);
    expect(result.items[0]._prefetchedSection).toBe(true);
    expect(result.items[0].section).toBe('chennai');
  });

  it('returns empty result for missing sections without throwing', () => {
    const result = selectPrefetchedSectionItems(snapshot, 'sports', 10);

    expect(result.items).toEqual([]);
    expect(result.sourceSection).toBe('sports');
  });
});
