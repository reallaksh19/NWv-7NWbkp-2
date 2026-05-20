import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEATHER_CITIES,
  WEATHER_LOCATION_REGISTRY,
  buildWeatherSettingsWithCities,
  getConfiguredWeatherCities,
  getWeatherLocationLabel,
} from './weatherLocations';
import {
  formatRainPair,
  getWeatherCityRows,
  normalizeForecastDay,
} from './weatherDataAdapters';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  summarizeAllCitiesWeekly,
} from './weatherInsights';
import {
  shouldShowOnThisDay,
} from './displayPreferences';

describe('Weather final closure certification', () => {
  it('keeps Colombo in default and registry-backed weather locations', () => {
    expect(DEFAULT_WEATHER_CITIES).toContain('colombo');
    expect(WEATHER_LOCATION_REGISTRY.colombo).toMatchObject({
      key: 'colombo',
      display: 'Colombo',
      country: 'Sri Lanka',
    });
    expect(getWeatherLocationLabel('colombo')).toBe('Colombo');
  });

  it('keeps customized weather city settings canonical', () => {
    const settings = buildWeatherSettingsWithCities({}, ['Colombo', 'Muscat']);
    expect(settings.weather.cities).toEqual(['colombo', 'muscat']);

    const configured = getConfiguredWeatherCities(settings);
    expect(configured).toContain('colombo');
    expect(configured).toContain('muscat');
  });

  it('normalizes weekly forecast fields required by Weather tab UI', () => {
    const day = normalizeForecastDay({
      label: 'Today',
      high: 28,
      low: 24,
      rainProb: 92,
      rainMm: 20.3,
      realFeelDay: 33,
      humidityDay: 88,
      uvIndex: 8,
      windKph: 18,
    });

    expect(day.high).toBe(28);
    expect(day.low).toBe(24);
    expect(day.rainProb).toBe(92);
    expect(day.rainMm).toBe(20.3);
    expect(day.realFeelDay).toBe(33);
    expect(day.humidityDay).toBe(88);
    expect(formatRainPair(day)).toBe('92% · 20.3mm');
  });

  it('supports WeatherPage style weekly city rows', () => {
    const rows = getWeatherCityRows({
      settings: {
        weather: {
          cities: ['colombo'],
          locationConfigVersion: 'weather-locations-v3-colombo-ux',
        },
      },
      weatherData: {
        colombo: {
          name: 'Colombo',
          sourceMode: 'live-multi-model',
          weeklyForecast: [
            { label: 'Today', high: 28, low: 24, rainProb: 92, rainMm: 20.3, realFeelDay: 33, humidityDay: 88 },
          ],
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].city).toBe('colombo');
    expect(rows[0].forecast[0].rainMm).toBe(20.3);
  });

  it('keeps QuickWeather risk/tomorrow summaries precise', () => {
    const cityData = {
      weeklyForecast: [
        { label: 'Today', high: 28, low: 24, rainProb: 92, rainMm: 20.3, humidityDay: 88 },
        { label: 'Tomorrow', high: 29, low: 25, rainProb: 55, rainMm: 2.1, humidityDay: 82 },
      ],
    };

    const risk = buildNextRiskSummary(cityData);
    const tomorrow = buildTomorrowChip(cityData);

    expect(risk.rainText).toBe('92% · 22.4mm');
    expect(tomorrow.rainText).toBe('55% · 2.1mm');
    expect(tomorrow.detail).toContain('55% · 2.1mm');
  });

  it('keeps planning summary functions available', () => {
    const summaries = summarizeAllCitiesWeekly({
      colombo: {
        name: 'Colombo',
        weeklyForecast: [
          { label: 'Today', high: 28, low: 24, rainProb: 92, rainMm: 20.3 },
          { label: 'Tomorrow', high: 29, low: 25, rainProb: 55, rainMm: 2.1 },
        ],
      },
    }, ['colombo']);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].hasWeekly).toBe(true);
    expect(summaries[0].rainiestDay.label).toBe('Today');
  });

  it('keeps On This Day off by default', () => {
    expect(shouldShowOnThisDay({})).toBe(false);
  });
});
