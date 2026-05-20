import { describe, it, expect } from 'vitest';
import { rescueUsefulVariantsBeforeDuplicateFreeze } from './usefulVariantRescue';
import { InsightStory, DEFAULT_CONFIG } from '../types';

function makeStory(id: string, angle: string, sourceGroup: string, numericFacts?: string[]): InsightStory {
  return { id, angle, sourceGroup, numericFacts, title: id, summary: '', source: '', url: '', publishedAt: 0, capturedAtSnapshot: 'now', canonicalUrl: '', canonicalText: '', embedding: [] } as any;
}

const cfg = { ...DEFAULT_CONFIG, maxChildrenPerParent: 8 };

describe('usefulVariantRescue', () => {
  it('rescues a new-angle candidate', () => {
    const existing = [makeStory('s1', 'base_report', 'g1')];
    const storiesById = new Map(existing.map(s => [s.id, s]));
    const candidate = makeStory('s2', 'official_response', 'g2');
    const result = rescueUsefulVariantsBeforeDuplicateFreeze([candidate], ['s1'], storiesById, cfg);
    expect(result.rescueCount).toBe(1);
    expect(result.rescuedIds).toContain('s2');
    expect(result.reasonsByStoryId['s2']).toContain('NEW_ANGLE');
  });

  it('rescues a new-source candidate', () => {
    const existing = [makeStory('s1', 'base_report', 'g1')];
    const storiesById = new Map(existing.map(s => [s.id, s]));
    const candidate = makeStory('s2', 'base_report', 'g2');
    const result = rescueUsefulVariantsBeforeDuplicateFreeze([candidate], ['s1'], storiesById, cfg);
    expect(result.rescueCount).toBe(1);
    expect(result.reasonsByStoryId['s2']).toContain('NEW_SOURCE');
  });

  it('does not rescue duplicate angle+source', () => {
    const existing = [makeStory('s1', 'base_report', 'g1')];
    const storiesById = new Map(existing.map(s => [s.id, s]));
    const candidate = makeStory('s2', 'base_report', 'g1');
    const result = rescueUsefulVariantsBeforeDuplicateFreeze([candidate], ['s1'], storiesById, cfg);
    expect(result.rescueCount).toBe(0);
  });
});
