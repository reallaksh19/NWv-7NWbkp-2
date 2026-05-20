import { describe, expect, it } from 'vitest';
import { runInsightPipeline } from './pipeline';
import { invalidateSlot } from '../cache/cacheManager';
import { DEFAULT_CONFIG } from '../types';
import type { InsightStory, SnapshotSlot } from '../types';

const BASE_TIME = 1_700_000_000_000;

function story(overrides: Partial<InsightStory>): InsightStory {
  const id = overrides.id || 'story';

  return {
    id,
    title: overrides.title || 'Port authority announces major logistics upgrade',
    summary: overrides.summary || 'The port authority announced a major logistics upgrade with official details.',
    source: overrides.source || 'Source A',
    sourceGroup: overrides.sourceGroup || 'source-a',
    url: overrides.url || `https://example.com/${id}`,
    publishedAt: overrides.publishedAt ?? BASE_TIME,
    category: overrides.category || 'infrastructure',
    region: overrides.region || 'IN',
    language: overrides.language || 'en',

    capturedAtSnapshot: overrides.capturedAtSnapshot || 'now',
    canonicalUrl: overrides.canonicalUrl || `https://example.com/${id}`,
    canonicalText: overrides.canonicalText || `${id} ${overrides.title || ''}`,
    canonicalTextHash: overrides.canonicalTextHash || `hash-${id}`,

    entities: overrides.entities || {
      people: [],
      orgs: ['Port Authority'],
      places: ['Chennai'],
      products: [],
      symbols: [],
    },

    keywords: overrides.keywords || ['port', 'logistics', 'infrastructure'],
    embedding: overrides.embedding || [1, 0, 0],
    eventVerbs: overrides.eventVerbs || ['announced'],
    numbers: overrides.numbers || ['500 crore'],

    sourceTier: overrides.sourceTier || 'A',
    sourceAuthority: overrides.sourceAuthority ?? 0.85,
    freshnessScore: overrides.freshnessScore ?? 0.85,
    rawProminence: overrides.rawProminence ?? 0.8,
    sentiment: overrides.sentiment ?? 0,
    factualDensity: overrides.factualDensity ?? 0.85,
    summaryQuality: overrides.summaryQuality ?? 0.85,

    angle: overrides.angle,

    ...overrides,
  };
}

function topStorySet(slot: SnapshotSlot): InsightStory[] {
  const slotOffset = {
    now: 0,
    minus4h: 4 * 60 * 60 * 1000,
    minus12h: 12 * 60 * 60 * 1000,
    minus24h: 23 * 60 * 60 * 1000,
  }[slot];

  const publishedAt = BASE_TIME - slotOffset;

  const common = {
    publishedAt,
    capturedAtSnapshot: slot,
    entities: {
      people: [],
      orgs: ['Port Authority'],
      places: ['Chennai'],
      products: [],
      symbols: [],
    },
    eventVerbs: ['announced'],
    embedding: [1, 0, 0],
    category: 'infrastructure',
    region: 'IN',
    sourceAuthority: 0.9,
    factualDensity: 0.9,
    summaryQuality: 0.9,
    freshnessScore: slot === 'now' ? 1 : 0.75,
  } satisfies Partial<InsightStory>;

  if (slot === 'minus24h') {
    return [
      story({
        ...common,
        id: 'port-base-minus24h',
        title: 'Port Authority announces major logistics upgrade',
        summary: 'The Port Authority announced a major logistics upgrade worth 500 crore in Chennai.',
        source: 'Reuters',
        sourceGroup: 'reuters_group',
        canonicalUrl: 'https://example.com/port-base-minus24h',
        canonicalTextHash: 'port-base-minus24h',
        rawProminence: 0.85,
        numbers: ['500 crore'],
        angle: 'base_report',
      }),
    ];
  }

  if (slot === 'minus12h') {
    return [
      story({
        ...common,
        id: 'port-background-minus12h',
        title: 'Explainer: timeline of the Chennai port logistics upgrade',
        summary: 'Here is the background, timeline and key points behind the Port Authority logistics upgrade.',
        source: 'Explainer Desk',
        sourceGroup: 'explainer_group',
        canonicalUrl: 'https://example.com/port-background-minus12h',
        canonicalTextHash: 'port-background-minus12h',
        rawProminence: 0.78,
        numbers: ['500 crore'],
        angle: 'background_context',
      }),
    ];
  }

  if (slot === 'minus4h') {
    return [
      story({
        ...common,
        id: 'port-official-minus4h',
        title: 'Officials said Chennai port upgrade will begin this quarter',
        summary: 'Officials said the ministry will monitor the Port Authority project and publish latest updates.',
        source: 'Official Wire',
        sourceGroup: 'official_group',
        canonicalUrl: 'https://example.com/port-official-minus4h',
        canonicalTextHash: 'port-official-minus4h',
        rawProminence: 0.9,
        numbers: ['500 crore', 'Q2'],
        angle: 'official_response',
      }),
    ];
  }

  return [
    story({
      ...common,
      id: 'port-market-now',
      title: 'Logistics stocks jumped after Port Authority upgrade plan',
      summary: 'Stocks jumped and investors reacted after the Port Authority announced the logistics upgrade.',
      source: 'Market Desk',
      sourceGroup: 'market_group',
      canonicalUrl: 'https://example.com/port-market-now',
      canonicalTextHash: 'port-market-now',
      rawProminence: 1,
      numbers: ['500 crore', '5%'],
      angle: 'market_reaction',
    }),
    story({
      ...common,
      id: 'port-reaction-now',
      title: 'Public backlash and residents reaction grows over port traffic',
      summary: 'Residents said social media criticism grew as locals reacted to traffic concerns near the Port Authority site.',
      source: 'Local Desk',
      sourceGroup: 'local_group',
      canonicalUrl: 'https://example.com/port-reaction-now',
      canonicalTextHash: 'port-reaction-now',
      rawProminence: 0.82,
      numbers: ['500 crore'],
      angle: 'reaction_public',
    }),
  ];
}

function noiseStories(slot: SnapshotSlot): InsightStory[] {
  return [
    story({
      id: `noise-${slot}-weather`,
      title: 'Small local weather advisory issued',
      summary: 'A local weather advisory was issued with limited disruption expected.',
      source: 'Weather Desk',
      sourceGroup: `weather_group_${slot}`,
      canonicalUrl: `https://example.com/noise-${slot}-weather`,
      canonicalTextHash: `noise-${slot}-weather`,
      publishedAt: BASE_TIME,
      capturedAtSnapshot: slot,
      entities: {
        people: [],
        orgs: ['Weather Office'],
        places: ['Trichy'],
        products: [],
        symbols: [],
      },
      eventVerbs: ['issued'],
      embedding: [0, 1, 0],
      numbers: [],
      rawProminence: 0.12,
      sourceAuthority: 0.55,
      freshnessScore: 0.5,
      factualDensity: 0.45,
      summaryQuality: 0.5,
    }),
  ];
}

function resetInsightCache(): void {
  invalidateSlot('now');
  invalidateSlot('minus4h');
  invalidateSlot('minus12h');
  invalidateSlot('minus24h');
}

describe('24h multi-angle Insight concept', () => {
  it('top parent is the high-prominence multi-angle story', async () => {
    resetInsightCache();

    const result = await runInsightPipeline(async (slot: SnapshotSlot) => {
      return [
        ...topStorySet(slot),
        ...noiseStories(slot),
      ];
    }, DEFAULT_CONFIG);

    expect(result.parents.length).toBeGreaterThan(0);

    const top = result.parents[0];

    expect(top.canonicalHeadline.toLowerCase()).toContain('port');
    expect(top.snapshotPresence.now).toBe(true);
    expect(top.snapshotPresence.minus4h).toBe(true);
    expect(top.snapshotPresence.minus12h).toBe(true);
    expect(top.snapshotPresence.minus24h).toBe(true);
    expect(top.clusterStoryIds.length).toBeGreaterThanOrEqual(5);
    expect((top.debug as any).impactScoreDiagnostics.topStoryProminenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it('selects multiple useful angles for the same story', async () => {
    resetInsightCache();

    const result = await runInsightPipeline(async (slot: SnapshotSlot) => {
      return [
        ...topStorySet(slot),
        ...noiseStories(slot),
      ];
    }, DEFAULT_CONFIG);

    const top = result.parents[0];

    expect(top.childStoryIds.length).toBeGreaterThanOrEqual(3);

    const children = top.childStoryIds
      .map(id => result.storiesById.get(id))
      .filter(Boolean) as InsightStory[];

    const angleSet = new Set(children.map(story => story.angle || 'unknown'));

    expect(angleSet.size).toBeGreaterThanOrEqual(3);
    expect(angleSet.has('official_response')).toBe(true);
    expect(
      angleSet.has('market_reaction') ||
      angleSet.has('reaction_public') ||
      angleSet.has('background_context')
    ).toBe(true);
  });

  it('survives useful-variant dedup rescue in a same-embedding cluster', async () => {
    resetInsightCache();

    const result = await runInsightPipeline(async (slot: SnapshotSlot) => {
      return [
        ...topStorySet(slot),
        ...noiseStories(slot),
      ];
    }, DEFAULT_CONFIG);

    const allKeptIds = new Set(result.storiesById.keys());

    expect(allKeptIds.has('port-market-now')).toBe(true);
    expect(allKeptIds.has('port-official-minus4h')).toBe(true);
    expect(allKeptIds.has('port-background-minus12h')).toBe(true);
  });
});