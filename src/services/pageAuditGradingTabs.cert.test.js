import { describe, expect, it } from 'vitest';
import {
  auditInsightTabQuality,
  auditMarketTabQuality,
  auditWeatherTabQuality,
} from './pageAuditGrading';

describe('Unified tab audit grading certification', () => {
  it('grades Weather tab using city, weekly and source-mode gates', () => {
    const audit = auditWeatherTabQuality({
      weatherData: {
        chennai: { current: { temp: 32 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
        trichy: { current: { temp: 34 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
        muscat: { current: { temp: 35 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
      },
      cities: ['chennai', 'trichy', 'muscat'],
      activeCity: 'chennai',
    });

    expect(['A', 'B']).toContain(audit.grade);
    expect(audit.target).toBe('weather-tab');
    expect(audit.gates.some(gate => gate.id === 'weather-weekly-forecast')).toBe(true);
  });

  it('grades Market tab using market coverage and source health gates', () => {
    const audit = auditMarketTabQuality({
      marketData: {
        indices: [{ name: 'NIFTY' }, { name: 'SENSEX' }, { name: 'BANK' }, { name: 'MIDCAP' }],
        movers: {
          gainers: [{ symbol: 'A' }],
          losers: [{ symbol: 'B' }],
        },
        sectorals: [{ name: 'IT' }],
        commodities: [{ name: 'Gold' }],
        currencies: [{ name: 'USDINR' }],
      },
      sourceHealth: {
        a: { ok: true },
        b: { ok: true },
      },
      lastFetch: Date.now(),
    });

    expect(['A', 'B']).toContain(audit.grade);
    expect(audit.target).toBe('market-tab');
    expect(audit.gates.some(gate => gate.id === 'market-source-health')).toBe(true);
  });

  it('downgrades Insight tab when no multi-angle clusters exist', () => {
    const result = {
      parents: [
        { parentId: 'p1', childStoryIds: ['s1'], clusterStoryIds: ['s1'], weakTree: true },
      ],
      storiesById: new Map([
        ['s1', { id: 's1', sourceGroup: 'single', angle: 'base_report' }],
      ]),
    };

    const audit = auditInsightTabQuality({ result, source: 'fixture' });

    expect(['C', 'D', 'F']).toContain(audit.grade);
    expect(audit.target).toBe('insight-tab');
    expect(audit.gates.some(gate => gate.id === 'insight-angle-diversity')).toBe(true);
  });
});
