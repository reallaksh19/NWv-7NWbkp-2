import { describe, it, expect } from 'vitest';
import {
  buildInsightQualityRca,
  buildInsightClusterRcaRow,
  buildInsightImprovementPlan,
  buildInsightRcaMoreDiagnostics,
} from './insightQualityRca.js';

const cfg = { weakTreeChildMin: 2, minSourcesPerTree: 2 };

function makeParent(id, childIds, debug = {}) {
  return { id, headline: `Parent ${id}`, childStoryIds: childIds, debug };
}

function makeStory(id, angle, sourceGroup) {
  return { id, angle, sourceGroup, title: id };
}

describe('insightQualityRca', () => {
  it('grades a strong parent as A', () => {
    const storiesById = new Map([
      ['s1', makeStory('s1', 'base_report', 'reuters_group')],
      ['s2', makeStory('s2', 'official_response', 'bbc_group')],
      ['s3', makeStory('s3', 'expert_analysis', 'guardian_group')],
    ]);
    const parent = makeParent('p1', ['s1', 's2', 's3']);
    const row = buildInsightClusterRcaRow(parent, storiesById, cfg);
    expect(row.grade).toBe('A');
    expect(row.weakTree).toBe(false);
    expect(row.rcaCauses).toHaveLength(0);
  });

  it('flags weak tree as D', () => {
    const storiesById = new Map([
      ['s1', makeStory('s1', 'base_report', 'reuters_group')],
    ]);
    const parent = makeParent('p1', ['s1']);
    const row = buildInsightClusterRcaRow(parent, storiesById, cfg);
    expect(row.grade).toBe('D');
    expect(row.weakTree).toBe(true);
    expect(row.rcaCauses).toContain('WEAK_TREE');
  });

  it('buildInsightQualityRca returns grade counts', () => {
    const storiesById = new Map([
      ['s1', makeStory('s1', 'base_report', 'g1')],
      ['s2', makeStory('s2', 'official_response', 'g2')],
      ['s3', makeStory('s3', 'expert_analysis', 'g3')],
    ]);
    const parents = [makeParent('p1', ['s1', 's2', 's3'])];
    const rca = buildInsightQualityRca(parents, storiesById, cfg);
    expect(rca.gradeCounts.A).toBe(1);
    expect(rca.parentCount).toBe(1);
  });

  it('buildInsightImprovementPlan returns actions for weak trees', () => {
    const rca = {
      gradeCounts: { A: 0, B: 0, C: 0, D: 2, F: 0 },
      weakTreeCount: 2,
      singleSourceCount: 1,
      singleAngleCount: 1,
      parentCount: 2,
    };
    const plan = buildInsightImprovementPlan(rca);
    expect(plan.actions.some(a => a.action === 'REPAIR_WEAK_TREES')).toBe(true);
  });

  it('buildInsightRcaMoreDiagnostics returns summary fields', () => {
    const rca = buildInsightQualityRca([], new Map(), cfg);
    const diag = buildInsightRcaMoreDiagnostics(rca);
    expect(diag).toHaveProperty('totalParents');
    expect(diag).toHaveProperty('gradeCounts');
    expect(diag).toHaveProperty('capturedAt');
  });
});
