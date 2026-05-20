import { describe, expect, it } from 'vitest';
import { computeFinalParentScore } from './ranking';
import type { InsightParent } from '../types';

function makeParent(overrides: Partial<InsightParent> = {}): InsightParent {
  return {
    parentId: 'parent-1',
    canonicalHeadline: 'Certification story',
    canonicalSummary: 'Certification summary',

    clusterStoryIds: [],
    childStoryIds: [],
    hiddenDuplicateIds: [],

    keyEntities: [],
    keyPlaces: [],
    keyVerbs: [],
    keyNumbers: [],

    firstSeenAt: 0,
    latestSeenAt: 0,

    snapshotPresence: {
      now: true,
      minus4h: false,
      minus12h: false,
      minus24h: false
    },

    impactScore: 0.8,
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
      replacements: []
    },

    ...overrides
  };
}

describe('Insight ranking certification', () => {
  it('preserves the final parent score formula weights', () => {
    const parent = makeParent();

    const score = computeFinalParentScore(parent);

    const expected =
      0.28 * parent.impactScore +
      0.20 * parent.persistenceScore +
      0.14 * parent.sourceDiversityScore +
      0.12 * parent.noveltyScore +
      0.10 * parent.freshnessScore +
      0.08 * parent.crossSnapshotMomentum +
      0.05 * parent.editorialClarityScore +
      0.03 * parent.regionBoost;

    expect(score).toBeCloseTo(expected, 10);
    expect(parent.debug.scoreBreakdown.finalParentScore).toBeCloseTo(expected, 10);
  });

  it('attaches ranking reason diagnostics without changing scoreBreakdown', () => {
    const parent = makeParent();

    const score = computeFinalParentScore(parent);
    const debug = parent.debug as any;

    expect(debug.scoreBreakdown.impactScore).toBe(parent.impactScore);
    expect(debug.scoreBreakdown.persistenceScore).toBe(parent.persistenceScore);
    expect(debug.scoreBreakdown.sourceDiversityScore).toBe(parent.sourceDiversityScore);
    expect(debug.scoreBreakdown.finalParentScore).toBe(score);

    expect(debug.rankingContributionBreakdown).toBeTruthy();
    expect(Array.isArray(debug.rankingContributionBreakdown)).toBe(true);
    expect(debug.rankingContributionBreakdown.length).toBe(8);

    expect(debug.rankingReasonLabels).toBeTruthy();
    expect(Array.isArray(debug.rankingReasonLabels)).toBe(true);
    expect(debug.rankingReasonLabels.length).toBe(3);

    expect(debug.rankingFormulaDiagnostics).toBeTruthy();
    expect(debug.rankingFormulaDiagnostics.formulaVersion).toBe('ranking-v1-weighted-contributions');
    expect(debug.rankingFormulaDiagnostics.formulaDelta).toBeLessThan(0.0002);
  });

  it('keeps weighted contribution sum close to final score', () => {
    const parent = makeParent({
      impactScore: 1,
      persistenceScore: 0.5,
      sourceDiversityScore: 0.25,
      noveltyScore: 0.75,
      freshnessScore: 0.6,
      crossSnapshotMomentum: 0.4,
      editorialClarityScore: 0.2,
      regionBoost: 0.03
    });

    const score = computeFinalParentScore(parent);
    const diagnostics = (parent.debug as any).rankingFormulaDiagnostics;

    expect(diagnostics.contributionSum).toBeCloseTo(score, 4);
    expect(diagnostics.formulaDelta).toBeLessThan(0.0002);
  });
});