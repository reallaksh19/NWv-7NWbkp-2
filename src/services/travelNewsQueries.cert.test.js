import { describe, expect, it } from 'vitest';
import {
  buildAllTravelNewsSourcePolicies,
  buildTravelNewsQueries,
  buildTravelNewsSourcePolicy,
  resolveTravelNewsPolicyKey,
  __travelNewsQueryTestUtils,
} from './travelNewsQueries';
import { getTravelLocationProfile } from './travelLocationProfile';

describe('Travel news query certification', () => {
  it('builds Colombo/Sri Lanka RSS queries using LK edition', () => {
    const profile = getTravelLocationProfile({
      travelLocation: { city: 'columbo' },
    });

    const queries = buildTravelNewsQueries(profile);

    expect(queries.length).toBeGreaterThanOrEqual(6);
    expect(queries[0].locationKey).toBe('colombo');
    expect(queries[0].country).toBe('LK');
    expect(queries[0].url).toContain('gl=LK');
    expect(queries[0].url).toContain('ceid=LK:en');
    expect(queries.map(item => item.query).join(' ')).toContain('Colombo');
  });

  it('builds a source policy for runtime/GitHub prefetch', () => {
    const policy = buildTravelNewsSourcePolicy({
      travelLocation: { city: 'Colombo' },
    });

    expect(policy.schemaVersion).toBe(1);
    expect(policy.type).toBe('travel-location-news-policy');
    expect(policy.generatedFor.key).toBe('colombo');
    expect(policy.generatedFor.countryCode).toBe('LK');
    expect(policy.queries.some(query => query.priority === 'high')).toBe(true);
  });

  it('builds all registered travel policies', () => {
    const policies = buildAllTravelNewsSourcePolicies();
    expect(policies.some(policy => policy.generatedFor.key === 'colombo')).toBe(true);
  });

  it('resolves common typo to policy key', () => {
    expect(resolveTravelNewsPolicyKey('Columbo')).toBe('colombo');
  });

  it('builds expected Google News RSS URL', () => {
    const url = __travelNewsQueryTestUtils.buildGoogleNewsRssUrl('Colombo travel advisory', {
      country: 'LK',
      lang: 'en',
    });

    expect(url).toContain('news.google.com/rss/search');
    expect(url).toContain('Colombo%20travel%20advisory');
    expect(url).toContain('ceid=LK:en');
  });
});
