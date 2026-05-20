import { describe, it, expect } from 'vitest';
import { buildInsightQualityDashboardData, getInsightQualityDashboardStatus } from './insightQualityDashboard.js';

const strongRca = {
  gradeCounts: { A: 8, B: 2, C: 0, D: 0, F: 0 },
  parentCount: 10,
  weakTreeCount: 0,
  singleAngleCount: 0,
  singleSourceCount: 0,
  rows: [],
};

const weakRca = {
  gradeCounts: { A: 0, B: 0, C: 2, D: 5, F: 3 },
  parentCount: 10,
  weakTreeCount: 5,
  singleAngleCount: 8,
  singleSourceCount: 6,
  rows: [],
};

describe('insightQualityDashboard', () => {
  it('grades A for 100% good parents', () => {
    const data = buildInsightQualityDashboardData(strongRca);
    expect(data.grade).toBe('A');
    expect(data.status).toBe('OK');
  });

  it('grades D/F for mostly weak parents', () => {
    const data = buildInsightQualityDashboardData(weakRca);
    expect(['D', 'F']).toContain(data.grade);
  });

  it('returns NO_DATA for null rca', () => {
    const data = buildInsightQualityDashboardData(null);
    expect(data.status).toBe('NO_DATA');
  });

  it('getInsightQualityDashboardStatus returns HEALTHY for grade A', () => {
    const data = buildInsightQualityDashboardData(strongRca);
    expect(getInsightQualityDashboardStatus(data)).toBe('HEALTHY');
  });

  it('getInsightQualityDashboardStatus returns DEGRADED for grade D', () => {
    const data = buildInsightQualityDashboardData(weakRca);
    expect(getInsightQualityDashboardStatus(data)).toBe('DEGRADED');
  });
});
