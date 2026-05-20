import { describe, expect, it } from 'vitest';
import {
  buildTravelLocationSettings,
  getTravelEditionOptions,
  getTravelLocationProfile,
  normalizeTravelLocation,
  resolveTravelLocationKey,
} from './travelLocationProfile';

describe('Travel location profile certification', () => {
  it('accepts Colombo and common misspelling Columbo', () => {
    expect(resolveTravelLocationKey('Colombo')).toBe('colombo');
    expect(resolveTravelLocationKey('columbo')).toBe('colombo');
    expect(resolveTravelLocationKey('Sri Lanka')).toBe('colombo');
  });

  it('normalizes travel location strings', () => {
    expect(normalizeTravelLocation('  Sri-Lanka  ')).toBe('sri lanka');
  });

  it('builds canonical travel location settings', () => {
    const settings = buildTravelLocationSettings({}, { city: 'Columbo' });
    expect(settings.travelLocation.city).toBe('colombo');
    expect(settings.travelLocation.prioritizeStories).toBe(true);
  });

  it('uses manual travel location before weather location', () => {
    const profile = getTravelLocationProfile({
      weather: { activeCity: 'muscat' },
      travelLocation: { city: 'colombo' },
    });

    expect(profile.key).toBe('colombo');
    expect(profile.countryCode).toBe('LK');
    expect(profile.source).toBe('manual');
  });

  it('can derive from active weather city', () => {
    const profile = getTravelLocationProfile({
      weather: { activeCity: 'columbo' },
    });

    expect(profile.key).toBe('colombo');
    expect(profile.source).toBe('weather-active-city');
  });

  it('returns correct Sri Lanka news edition', () => {
    const profile = getTravelLocationProfile({
      travelLocation: { city: 'colombo' },
    });

    expect(getTravelEditionOptions(profile)).toEqual({
      country: 'LK',
      lang: 'en',
      timeRange: '30d',
    });
  });
});
