import { describe, test, expect } from 'vitest';
import {
    buildTomorrowChip,
    buildOutdoorScore,
    summarizeCityWeekly,
    buildNextRiskSummary,
} from './weatherInsights.js';

function makeForecast(overrides = []) {
    const base = Array.from({ length: 7 }, (_, i) => ({
        dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Day${i}`,
        date: `2026-05-${19 + i}`,
        tempMax: 32 + i,
        tempMin: 24,
        precipProb: 10 + i * 5,
        precipSum: 0,
        uvMax: 6 + i,
        windMax: 15,
        weatherCode: 1,
        icon: '☀️',
        condition: 'Clear',
    }));
    overrides.forEach((ov, i) => { if (ov) Object.assign(base[i], ov); });
    return base;
}

describe('weatherInsights – Slice 59B', () => {
    test('buildTomorrowChip returns chip for city with forecast', () => {
        const cityData = { weeklyForecast: makeForecast() };
        const chip = buildTomorrowChip(cityData);
        expect(chip).not.toBeNull();
        expect(chip.label).toBe('Tomorrow');
        expect(typeof chip.risk).toBe('string');
    });

    test('buildTomorrowChip returns null without forecast', () => {
        expect(buildTomorrowChip({})).toBeNull();
        expect(buildTomorrowChip(null)).toBeNull();
    });

    test('buildTomorrowChip sets high risk for rain >= 60', () => {
        const cityData = { weeklyForecast: makeForecast([null, { precipProb: 70 }]) };
        const chip = buildTomorrowChip(cityData);
        expect(chip.risk).toBe('high');
    });

    test('buildOutdoorScore is 100 for ideal conditions', () => {
        const score = buildOutdoorScore({ precipProb: 0, tempMax: 28, uvMax: 4, windMax: 10 });
        expect(score).toBe(100);
    });

    test('buildOutdoorScore penalizes high rain', () => {
        const s1 = buildOutdoorScore({ precipProb: 0, tempMax: 28, uvMax: 4, windMax: 10 });
        const s2 = buildOutdoorScore({ precipProb: 80, tempMax: 28, uvMax: 4, windMax: 10 });
        expect(s2).toBeLessThan(s1);
    });

    test('buildOutdoorScore never goes below 0', () => {
        const score = buildOutdoorScore({ precipProb: 100, tempMax: 42, uvMax: 12, windMax: 60 });
        expect(score).toBeGreaterThanOrEqual(0);
    });

    test('summarizeCityWeekly returns best/rainiest/hottest/highestUv', () => {
        const cityData = { weeklyForecast: makeForecast() };
        const summary = summarizeCityWeekly(cityData);
        expect(summary).not.toBeNull();
        expect(summary.bestDay).toBeDefined();
        expect(summary.rainiestDay).toBeDefined();
        expect(summary.hottestDay).toBeDefined();
        expect(summary.highestUvDay).toBeDefined();
    });

    test('summarizeCityWeekly returns object with hasWeekly false without forecast', () => {
        expect(summarizeCityWeekly({})).toEqual(expect.objectContaining({ hasWeekly: false }));
        expect(summarizeCityWeekly(null)).toEqual(expect.objectContaining({ hasWeekly: false }));
    });

    test('buildNextRiskSummary returns rain/heat/uv/wind signals', () => {
        const cityData = { weeklyForecast: makeForecast() };
        const risk = buildNextRiskSummary(cityData);
        expect(risk).not.toBeNull();
        expect(typeof risk.rain).toBe('number');
        expect(typeof risk.heat).toBe('number');
        expect(typeof risk.uv).toBe('number');
    });

    test('buildNextRiskSummary stable=true when rain < 20', () => {
        const forecast = makeForecast([{ precipProb: 5 }, { precipProb: 8 }]);
        const risk = buildNextRiskSummary({ weeklyForecast: forecast });
        expect(risk.stable).toBe(true);
    });
});
