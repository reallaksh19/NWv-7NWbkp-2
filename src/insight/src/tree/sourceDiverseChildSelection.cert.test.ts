import { describe, it, expect } from 'vitest';
import { enforceSourceDiverseChildSelection } from './sourceDiverseChildSelection';
import { InsightStory, InsightParent, DEFAULT_CONFIG } from '../types';

function makeStory(id: string, sourceGroup: string, angle = 'base_report'): InsightStory {
  return { id, sourceGroup, angle, title: id, summary: '', source: '', url: '', publishedAt: 0, capturedAtSnapshot: 'now', canonicalUrl: '', canonicalText: '', embedding: [] } as any;
}

function makeParent(childIds: string[]): InsightParent {
  return { id: 'p1', headline: 'Test', childStoryIds: childIds, score: 1, debug: {} } as any;
}

const cfg = { ...DEFAULT_CONFIG, minSourcesPerTree: 2 };

describe('sourceDiverseChildSelection', () => {
  it('returns repairApplied false when sources are sufficient', () => {
    const s1 = makeStory('s1', 'reuters_group');
    const s2 = makeStory('s2', 'bbc_group');
    const storiesById = new Map([['s1', s1], ['s2', s2]]);
    const parent = makeParent(['s1', 's2']);
    const result = enforceSourceDiverseChildSelection(parent, storiesById, [s1, s2], cfg);
    expect(result.repairApplied).toBe(false);
  });

  it('adds a new-source candidate when source is deficient', () => {
    const s1 = makeStory('s1', 'reuters_group');
    const s2 = makeStory('s2', 'bbc_group');
    const storiesById = new Map([['s1', s1], ['s2', s2]]);
    const parent = makeParent(['s1']);
    const result = enforceSourceDiverseChildSelection(parent, storiesById, [s2], cfg);
    expect(result.repairApplied).toBe(true);
    expect(result.addedIds).toContain('s2');
  });

  it('does not invent unavailable source groups', () => {
    const s1 = makeStory('s1', 'reuters_group');
    const storiesById = new Map([['s1', s1]]);
    const parent = makeParent(['s1']);
    const result = enforceSourceDiverseChildSelection(parent, storiesById, [], cfg);
    expect(result.repairApplied).toBe(false);
    expect(result.availableSourceGroupCount).toBe(0);
  });
});
