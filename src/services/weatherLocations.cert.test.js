import { describe, test, expect } from 'vitest';
import {
    DEFAULT_WEATHER_CITIES,
    WEATHER_LOCATION_REGISTRY,
    resolveRegistryKey,
    getConfiguredWeatherCities,
    buildWeatherSettingsWithCities,
} from './weatherLocations.js';

describe('weatherLocations – Slice 59A', () => {
    test('DEFAULT_WEATHER_CITIES includes colombo', () => {
        expect(DEFAULT_WEATHER_CITIES).toContain('colombo');
    });

    test('DEFAULT_WEATHER_CITIES includes chennai, trichy, muscat', () => {
        expect(DEFAULT_WEATHER_CITIES).toContain('chennai');
        expect(DEFAULT_WEATHER_CITIES).toContain('trichy');
        expect(DEFAULT_WEATHER_CITIES).toContain('muscat');
    });

    test('WEATHER_LOCATION_REGISTRY has lat/lon for each default city', () => {
        for (const city of DEFAULT_WEATHER_CITIES) {
            expect(WEATHER_LOCATION_REGISTRY[city]).toBeDefined();
            expect(typeof WEATHER_LOCATION_REGISTRY[city].lat).toBe('number');
            expect(typeof WEATHER_LOCATION_REGISTRY[city].lon).toBe('number');
        }
    });

    test('resolveRegistryKey handles canonical name', () => {
        expect(resolveRegistryKey('colombo')).toBe('colombo');
        expect(resolveRegistryKey('chennai')).toBe('chennai');
    });

    test('resolveRegistryKey handles alias', () => {
        expect(resolveRegistryKey('madras')).toBe('chennai');
        expect(resolveRegistryKey('kolamba')).toBe('colombo');
    });

    test('resolveRegistryKey returns null for unknown', () => {
        expect(resolveRegistryKey('unknowncityxyz')).toBeNull();
    });

    test('getConfiguredWeatherCities returns defaults when settings empty', () => {
        expect(getConfiguredWeatherCities({})).toEqual(DEFAULT_WEATHER_CITIES);
        expect(getConfiguredWeatherCities(null)).toEqual(DEFAULT_WEATHER_CITIES);
    });

    test('getConfiguredWeatherCities returns settings cities', () => {
        const settings = { weather: { cities: ['chennai', 'muscat'] } };
        const result = getConfiguredWeatherCities(settings);
        expect(result).toContain('chennai');
        expect(result).toContain('muscat');
    });

    test('getConfiguredWeatherCities migrates missing colombo for small lists', () => {
        const settings = { weather: { cities: ['chennai', 'trichy'] } };
        const result = getConfiguredWeatherCities(settings);
        expect(result).toContain('colombo');
    });

    test('buildWeatherSettingsWithCities produces correct shape', () => {
        const next = buildWeatherSettingsWithCities({ weather: { tempUnit: 'celsius' } }, ['chennai']);
        expect(next.weather.cities).toEqual(['chennai']);
        expect(next.weather.tempUnit).toBe('celsius');
    });
});
