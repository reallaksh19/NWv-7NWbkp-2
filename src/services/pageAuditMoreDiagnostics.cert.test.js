import { describe, expect, it } from 'vitest';
import {
  auditInsightTabQuality,
  auditMainTabQuality,
  auditMarketTabQuality,
  auditWeatherTabQuality,
} from './pageAuditGrading';

function story(id, sourceGroup, publishedAt = Date.now()) {
  return {
    id,
    title: 'Story ' + id,
    sourceGroup,
    publishedAt,
  };
}

describe('Grade popup more diagnostics certification', () => {
  it('adds moreDiagnostics to Main tab audit', () => {
    const now = Date.now();
    const audit = auditMainTabQuality({
      now,
      newsData: {
        frontPage: Array.from({ length: 10 }, (_, index) => story('top-' + index, 'src_' + index, now)),
        india: [story('i1', 'a', now), story('i2', 'b', now), story('i3', 'c', now)],
        chennai: [story('c1', 'd', now), story('c2', 'e', now), story('c3', 'f', now)],
        local: [story('l1', 'g', now), story('l2', 'h', now), story('l3', 'i', now)],
        world: [story('w1', 'j', now), story('w2', 'k', now), story('w3', 'l', now)],
      },
      weatherData: {
        chennai: { current: { temp: 32 } },
        trichy: { current: { temp: 33 } },
        muscat: { current: { temp: 34 } },
      },
    });

    expect(Array.isArray(audit.moreDiagnostics)).toBe(true);
    expect(audit.moreDiagnostics.length).toBeGreaterThanOrEqual(2);
    expect(audit.moreDiagnostics.some(section => section.id === 'main-section-health')).toBe(true);
  });

  it('adds moreDiagnostics to Weather tab audit', () => {
    const audit = auditWeatherTabQuality({
      weatherData: {
        chennai: { current: { temp: 32 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
        trichy: { current: { temp: 33 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
      },
      cities: ['chennai', 'trichy'],
      activeCity: 'chennai',
    });

    expect(audit.moreDiagnostics.some(section => section.id === 'weather-city-readiness')).toBe(true);
    expect(audit.moreDiagnostics.some(section => section.id === 'weather-source-trust')).toBe(true);
  });

  it('adds moreDiagnostics to Market tab audit', () => {
    const audit = auditMarketTabQuality({
      marketData: {
        indices: [{ name: 'NIFTY' }, { name: 'SENSEX' }, { name: 'BANK' }, { name: 'MIDCAP' }],
        movers: {
          gainers: [{ symbol: 'A' }],
          losers: [{ symbol: 'B' }],
        },
        sectorals: [{ name: 'IT' }],
        commodities: [{ name: 'Gold' }],
      },
      sourceHealth: {
        nse: { ok: true },
      },
      lastFetch: Date.now(),
    });

    expect(audit.moreDiagnostics.some(section => section.id === 'market-coverage')).toBe(true);
    expect(audit.moreDiagnostics.some(section => section.id === 'market-source-health')).toBe(true);
  });

  it('adds moreDiagnostics to Insight tab audit', () => {
    const result = {
      parents: [
        { parentId: 'p1', canonicalHeadline: 'Parent 1', childStoryIds: ['s1', 's2'], clusterStoryIds: ['s1', 's2'], weakTree: false },
      ],
      storiesById: new Map([
        ['s1', { id: 's1', sourceGroup: 'a', angle: 'base_report' }],
        ['s2', { id: 's2', sourceGroup: 'b', angle: 'official_response' }],
      ]),
    };

    const audit = auditInsightTabQuality({
      result,
      diagnostics: { signalScore: 80 },
      behaviorEvidence: { status: 'pass', summaryTitle: 'Behavior evidence passed' },
      source: 'fixture',
    });

    expect(audit.moreDiagnostics.some(section => section.id === 'insight-tree-quality')).toBe(true);
    expect(audit.moreDiagnostics.some(section => section.id === 'insight-runtime-gates')).toBe(true);
  });
});
