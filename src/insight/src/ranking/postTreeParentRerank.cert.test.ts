import { describe, it, expect } from 'vitest';
import { computeDiversityAdjustedParentScore, rerankParentsAfterDiversityRepair } from './postTreeParentRerank';
import { InsightStory, InsightParent, DEFAULT_CONFIG } from '../types';

function makeStory(id: string, angle: string, sourceGroup: string): InsightStory {
  return { id, angle, sourceGroup, title: id, summary: '', source: '', url: '', publishedAt: 0, capturedAtSnapshot: 'now', canonicalUrl: '', canonicalText: '', embedding: [] } as any;
}

function makeParent(id: string, score: number, childIds: string[]): InsightParent {
  return { id, headline: id, score, childStoryIds: childIds, debug: {} } as any;
}

const cfg = { ...DEFAULT_CONFIG, weakTreeChildMin: 2, minSourcesPerTree: 2 };

describe('postTreeParentRerank', () => {
  it('applies diversity bonus for multi-angle parent', () => {
    const s1 = makeStory('s1', 'base_report', 'g1');
    const s2 = makeStory('s2', 'official_response', 'g2');
    const storiesById = new Map([['s1', s1], ['s2', s2]]);
    const parent = makeParent('p1', 0.5, ['s1', 's2']);
    const result = computeDiversityAdjustedParentScore(parent, storiesById, cfg);
    expect(result.diversityBonus).toBeGreaterThan(0);
    expect(result.finalScore).toBeGreaterThan(0.5);
  });

  it('applies weakness penalty for weak tree', () => {
    const s1 = makeStory('s1', 'base_report', 'g1');
    const storiesById = new Map([['s1', s1]]);
    const parent = makeParent('p1', 0.5, ['s1']);
    const result = computeDiversityAdjustedParentScore(parent, storiesById, cfg);
    expect(result.weaknessPenalty).toBeGreaterThan(0);
  });

  it('rerankParentsAfterDiversityRepair sorts by final score', () => {
    const s1 = makeStory('s1', 'base_report', 'g1');
    const s2 = makeStory('s2', 'official_response', 'g2');
    const storiesById = new Map([['s1', s1], ['s2', s2]]);
    const p1 = makeParent('p1', 0.3, ['s1']);          // weak
    const p2 = makeParent('p2', 0.2, ['s1', 's2']);    // diverse
    const reranked = rerankParentsAfterDiversityRepair([p1, p2], storiesById, cfg);
    expect(reranked[0].id).toBe('p2');
  });
});
