import { describe, it, expect } from 'vitest';
import { enforceAngleDiverseChildSelection, orderAngleDiverseChildrenForDisplay } from './angleDiverseChildSelection';
import { InsightStory, InsightParent, InsightConfig, DEFAULT_CONFIG } from '../types';

function makeStory(id: string, angle: string, sourceGroup = 'g1'): InsightStory {
  return { id, angle, sourceGroup, title: id, summary: '', source: '', url: '', publishedAt: 0, capturedAtSnapshot: 'now', canonicalUrl: '', canonicalText: '', embedding: [] } as any;
}

function makeParent(childIds: string[]): InsightParent {
  return { id: 'p1', headline: 'Test', childStoryIds: childIds, score: 1, debug: {} } as any;
}

const cfg: InsightConfig = { ...DEFAULT_CONFIG, maxPerAngle: 2 } as any;

describe('angleDiverseChildSelection', () => {
  it('returns repairApplied false when no angle is overloaded', () => {
    const stories = [makeStory('s1', 'base_report'), makeStory('s2', 'official_response')];
    const storiesById = new Map(stories.map(s => [s.id, s]));
    const parent = makeParent(['s1', 's2']);
    const result = enforceAngleDiverseChildSelection(parent, storiesById, stories, cfg);
    expect(result.repairApplied).toBe(false);
  });

  it('repairs overloaded angle by replacing excess with diverse candidates', () => {
    const s1 = makeStory('s1', 'base_report');
    const s2 = makeStory('s2', 'base_report');
    const s3 = makeStory('s3', 'base_report'); // overload
    const s4 = makeStory('s4', 'official_response');
    const storiesById = new Map([['s1', s1], ['s2', s2], ['s3', s3], ['s4', s4]]);
    const parent = makeParent(['s1', 's2', 's3']);
    const result = enforceAngleDiverseChildSelection(parent, storiesById, [s4], cfg);
    expect(result.repairApplied).toBe(true);
    expect(result.removedIds).toContain('s3');
  });

  it('orderAngleDiverseChildrenForDisplay sorts by angle display order', () => {
    const s1 = makeStory('s1', 'official_response');
    const s2 = makeStory('s2', 'base_report');
    const storiesById = new Map([['s1', s1], ['s2', s2]]);
    const ordered = orderAngleDiverseChildrenForDisplay(['s1', 's2'], storiesById);
    expect(ordered[0]).toBe('s2');
  });
});
