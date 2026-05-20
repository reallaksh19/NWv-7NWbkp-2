import { describe, expect, it } from 'vitest';
import {
  mergeTravelNewsIntoNewsData,
  normalizeTravelNewsPayload,
} from './travelNewsIngestion';
import { getTravelLocationProfile } from './travelLocationProfile';

const profile = getTravelLocationProfile({
  travelLocation: { city: 'Colombo' },
});

describe('Travel news ingestion certification', () => {
  it('normalizes travel JSON payload into story records', () => {
    const payload = normalizeTravelNewsPayload({
      stories: [
        {
          title: 'Colombo airport travel advisory issued',
          url: 'https://example.test/1',
          source: 'Test Source',
        },
      ],
    }, profile);

    expect(payload.locationKey).toBe('colombo');
    expect(payload.countryCode).toBe('LK');
    expect(payload.stories).toHaveLength(1);
    expect(payload.stories[0].city).toBe('Colombo');
    expect(payload.stories[0]._travelLocationScore).toBeGreaterThan(0);
  });

  it('dedupes and merges travel payload into newsData.travelLocal', () => {
    const merged = mergeTravelNewsIntoNewsData({
      travelLocal: [
        {
          title: 'Old Colombo travel advisory',
          url: 'https://example.test/old',
        },
      ],
    }, {
      stories: [
        {
          title: 'Colombo airport travel advisory issued',
          url: 'https://example.test/1',
        },
        {
          title: 'Colombo airport travel advisory issued duplicate',
          url: 'https://example.test/1',
        },
      ],
    }, profile);

    expect(merged.travelLocal.length).toBe(2);
    expect(merged.travelLocationPayload.locationKey).toBe('colombo');
  });
});
