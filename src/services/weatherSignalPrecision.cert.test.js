import { describe, expect, it } from 'vitest';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  buildOutdoorScore,
  formatRainSignal,
  summarizeCityWeekly,
} from './weatherInsights';

describe('Weather signal precision certification', () => {
  it('formats rain probability and precipitation mm together', () => {
    expect(formatRainSignal(55, 2.1)).toBe('55% · 2.1mm');
    expect(formatRainSignal(null, null)).toBe('0% · 0.0mm');
  });

  it('builds next risk summary with precipitation mm', () => {
    const summary = buildNextRiskSummary({
      weeklyForecast: [
        { precipProb: 55, precipSum: 2.1, tempMax: 32, uvMax: 9, windMax: 18, humidityDay: 76 },
        { precipProb: 35, precipSum: 1.4, tempMax: 31, uvMax: 8, windMax: 22, humidityDay: 82 },
      ],
    });

    expect(summary.rain).toBe(55);
    expect(summary.precipMm).toBe(3.5);
    expect(summary.rainText).toBe('55% · 3.5mm');
    expect(summary.uv).toBe(9);
    expect(summary.humidity).toBe(82);
  });

  it('builds tomorrow chip with rain mm and risk', () => {
    const chip = buildTomorrowChip({
      weeklyForecast: [
        { precipProb: 10, precipSum: 0, tempMax: 30 },
        { precipProb: 80, precipSum: 12.4, tempMax: 29, condition: 'Rain' },
      ],
    });

    expect(chip.rain).toBe(80);
    expect(chip.precipMm).toBe(12.4);
    expect(chip.rainText).toBe('80% · 12.4mm');
    expect(chip.risk).toBe('high');
  });

  it('reduces outdoor score for rain mm and humidity', () => {
    const good = buildOutdoorScore({ precipProb: 5, precipSum: 0, tempMax: 29, uvMax: 4, humidityDay: 60 });
    const bad = buildOutdoorScore({ precipProb: 90, precipSum: 18, tempMax: 36, uvMax: 10, humidityDay: 90 });

    expect(good).toBeGreaterThan(bad);
  });

  it('uses rain mm to identify rainiest day', () => {
    const summary = summarizeCityWeekly({
      weeklyForecast: [
        { label: 'Today', precipProb: 60, precipSum: 1.0, tempMax: 31 },
        { label: 'Tomorrow', precipProb: 55, precipSum: 12.0, tempMax: 30 },
      ],
    });

    expect(summary.rainiestDay.label).toBe('Tomorrow');
  });
});
