import { describe, expect, it } from 'vitest';
import {
  chooseBestChildCandidate,
  getCandidateDiversityScore,
} from './treeBuilder';
import { DEFAULT_CONFIG } from '../types';
import type { ChildCandidate, InsightStory } from '../types';

function story(id: string, angle: InsightStory['angle'], sourceGroup: string): InsightStory {
  return {
    id,
    title: id,
    summary: 'A compact certification summary with enough words for scoring purposes.',
    source: sourceGroup,
    sourceGroup,
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
      orgs: ['Org'],
      places: ['India'],
      products: [],
      symbols: [],
    },

    keywords: [],
    embedding: [1, 0, 0],
    eventVerbs: ['said'],
    numbers: [],

    sourceTier: 'A',
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,

    angle,
  };
}

function candidate(
  id: string,
  angle: InsightStory['angle'],
  sourceGroup: string,
  childScore: number,
  informationGain = 0.5
): ChildCandidate {
  const s = story(id, angle, sourceGroup);

  return {
    story: s,
    angle: angle || 'unknown',
    relevanceToParent: 0.8,
    informationGain,
    sourceDiversityBonus: 0,
    angleUniqueness: 0,
    childScore,
  };
}

describe('Insight child diversity tuning certification', () => {
  it('scores unseen angle and unseen source group higher for diversity', () => {
    const selected = [
      story('selected-base', 'base_report', 'source-a'),
    ];

    const same = candidate('same', 'base_report', 'source-a', 0.95);
    const newAngle = candidate('new-angle', 'official_response', 'source-a', 0.90);
    const newAngleAndSource = candidate('new-angle-source', 'market_reaction', 'source-b', 0.90);

    expect(getCandidateDiversityScore(same, selected)).toBe(0);
    expect(getCandidateDiversityScore(newAngle, selected)).toBe(2);
    expect(getCandidateDiversityScore(newAngleAndSource, selected)).toBe(3);
  });

  it('selects a diversity-improving candidate within REPLACE_MARGIN of top score', () => {
    const selected = [
      story('selected-base', 'base_report', 'source-a'),
    ];

    const highestScoreSameAngle = candidate('same-high', 'base_report', 'source-a', 0.91);
    const diverseWithinMargin = candidate('diverse-near', 'official_response', 'source-b', 0.86);
    const result = chooseBestChildCandidate(
      [highestScoreSameAngle, diverseWithinMargin],
      selected,
      DEFAULT_CONFIG
    );

    expect(DEFAULT_CONFIG.REPLACE_MARGIN).toBe(0.08);
    expect(result.story.id).toBe('diverse-near');
  });

  it('does not select diversity candidate outside REPLACE_MARGIN', () => {
    const selected = [
      story('selected-base', 'base_report', 'source-a'),
    ];

    const highestScoreSameAngle = candidate('same-high', 'base_report', 'source-a', 0.91);
    const diverseTooLow = candidate('diverse-low', 'official_response', 'source-b', 0.80);

    const result = chooseBestChildCandidate(
      [highestScoreSameAngle, diverseTooLow],
      selected,
      DEFAULT_CONFIG
    );

    expect(result.story.id).toBe('same-high');
  });

  it('keeps highest score for the first child because no diversity baseline exists', () => {
    const highest = candidate('highest', 'base_report', 'source-a', 0.91);
    const diverse = candidate('diverse', 'official_response', 'source-b', 0.89);

    const result = chooseBestChildCandidate(
      [highest, diverse],
      [],
      DEFAULT_CONFIG
    );

    expect(result.story.id).toBe('highest');
  });
});