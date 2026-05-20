import { describe, expect, it } from 'vitest';
import {
  formatRainPair,
  getWeatherCityRows,
  normalizeForecastDay,
} from './weatherDataAdapters';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  summarizeAllCitiesWeekly,
  summarizeCityWeekly,
} from './weatherInsights';

describe('Weather integration hardening certification', () => {
  it('normalizes forecast aliases into a stable shape', () => {
    const day = normalizeForecastDay({
      tempMax: 31,
      tempMin: 25,
      precipProb: 92,
      precipSum: 20.3,
      apparentMax: 35,
      humidityMean: 86,
      uvMax: 8,
      windMax: 22,
    });

    expect(day.high).toBe(31);
    expect(day.low).toBe(25);
    expect(day.rainProb).toBe(92);
    expect(day.rainMm).toBe(20.3);
    expect(day.realFeelDay).toBe(35);
    expect(day.humidityDay).toBe(86);
    expect(formatRainPair(day)).toBe('92% · 20.3mm');
  });

  it('builds city rows from WeatherPage style weatherData/settings props', () => {
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
          weeklyForecast: [{ high: 30, low: 25, rainProb: 70, rainMm: 8 }],
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].cityName).toBe('Colombo');
    expect(rows[0].forecast[0].rainMm).toBe(8);
  });

  it('keeps summarizeCityWeekly backwards compatible', () => {
    const cityData = {
      name: 'Colombo',
      weeklyForecast: [
        { label: 'Today', high: 30, low: 25, rainProb: 20, rainMm: 0 },
        { label: 'Tomorrow', high: 29, low: 24, rainProb: 92, rainMm: 20.3 },
      ],
    };

    const oldStyle = summarizeCityWeekly('colombo', cityData);
    const newStyle = summarizeCityWeekly(cityData);

    expect(oldStyle.hasWeekly).toBe(true);
    expect(oldStyle.rainiestDay.label).toBe('Tomorrow');
    expect(newStyle.rainiestDay.label).toBe('Tomorrow');
  });

  it('keeps summarizeAllCitiesWeekly available for WeatherPlanningSummary', () => {
    const summaries = summarizeAllCitiesWeekly({
      colombo: {
        weeklyForecast: [{ high: 30, low: 25, rainProb: 10, rainMm: 0 }],
      },
    }, ['colombo']);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].hasWeekly).toBe(true);
  });

  it('builds QuickWeather risk and tomorrow summaries with mm', () => {
    const cityData = {
      weeklyForecast: [
        { label: 'Today', high: 31, low: 25, rainProb: 55, rainMm: 2.1 },
        { label: 'Tomorrow', high: 29, low: 24, rainProb: 92, rainMm: 20.3 },
      ],
    };

    const risk = buildNextRiskSummary(cityData);
    const tomorrow = buildTomorrowChip(cityData);

    expect(risk.rainText).toBe('92% · 22.4mm');
    expect(tomorrow.rainText).toBe('92% · 20.3mm');
  });
});
