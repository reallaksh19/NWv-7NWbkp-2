/**
 * Travel local E2E closure certification.
 * Validates the full pipeline: profile → queries → ingestion → priority → UI quality.
 */

import { describe, expect, it } from 'vitest';
import { getTravelLocationProfile, resolveTravelLocationKey } from './travelLocationProfile';
import { buildTravelNewsQueries, buildTravelNewsSourcePolicy } from './travelNewsQueries';
import { normalizeTravelNewsPayload, mergeTravelNewsIntoNewsData } from './travelNewsIngestion';
import { applyTravelLocationPriority, rankStoriesForLocation } from './storyLocationPriority';
import { auditTravelLocalStories } from './travelLocalUiQuality';

describe('Travel local E2E closure certification', () => {
  it('Columbo typo flows end-to-end through all pipeline stages', () => {
    // Stage 1: Alias resolution
    const key = resolveTravelLocationKey('Columbo');
    expect(key).toBe('colombo');

    // Stage 2: Profile
    const profile = getTravelLocationProfile({ travelLocation: { city: 'Columbo' } });
    expect(profile.key).toBe('colombo');
    expect(profile.countryCode).toBe('LK');
    expect(profile.prioritizeStories).toBe(true);

    // Stage 3: Queries
    const queries = buildTravelNewsQueries(profile);
    expect(queries[0].country).toBe('LK');
    expect(queries[0].url).toContain('ceid=LK:en');

    // Stage 4: Source policy
    const policy = buildTravelNewsSourcePolicy(profile);
    expect(policy.generatedFor.key).toBe('colombo');

    // Stage 5: Ingestion
    const payload = normalizeTravelNewsPayload({
      stories: [
        { title: 'Colombo port gets new crane facility', url: 'https://example.test/port' },
        { title: 'Sri Lanka cricket board announces new Colombo stadium', url: 'https://example.test/cricket' },
      ],
    }, profile);
    expect(payload.locationKey).toBe('colombo');
    expect(payload.stories.length).toBe(2);

    // Stage 6: Merge into newsData
    const merged = mergeTravelNewsIntoNewsData({}, payload, profile);
    expect(merged.travelLocal.length).toBeGreaterThan(0);

    // Stage 7: Priority application
    const newsData = {
      frontPage: [
        { id: 'g1', title: 'Global market update' },
        { id: 'c1', title: 'Colombo port gets new crane facility' },
      ],
    };
    const prioritized = applyTravelLocationPriority(newsData, profile);
    expect(prioritized.frontPage[0].id).toBe('c1');

    // Stage 8: UI quality audit
    const ranked = rankStoriesForLocation(newsData, profile, { limit: 10 });
    const audit = auditTravelLocalStories(ranked, profile);
    expect(audit.pass).toBe(true);
    expect(audit.validStoryCount).toBeGreaterThan(0);
  });

  it('all registered travel locations have valid profiles and queries', () => {
    const locations = ['colombo', 'chennai', 'trichy', 'muscat'];

    for (const locationKey of locations) {
      const profile = getTravelLocationProfile({ travelLocation: { city: locationKey } });
      expect(profile.key).toBe(locationKey);
      expect(profile.countryCode).toBeTruthy();
      expect(profile.storyKeywords.length).toBeGreaterThan(0);

      const queries = buildTravelNewsQueries(profile);
      expect(queries.length).toBeGreaterThanOrEqual(6);
      expect(queries.some(q => q.priority === 'high')).toBe(true);
    }
  });
});
