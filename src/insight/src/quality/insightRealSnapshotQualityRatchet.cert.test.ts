import { describe, it, expect } from 'vitest';
import { runInsightRealSnapshotQualityRatchet } from './insightRealSnapshotQualityRatchet';

describe('insightRealSnapshotQualityRatchet', () => {
  it('passes for grade A with multi-angle top parent', () => {
    const result = runInsightRealSnapshotQualityRatchet({
      grade: 'A',
      parents: [{ weakTree: false, angles: ['base_report', 'official_response'] }],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails for grade D', () => {
    const result = runInsightRealSnapshotQualityRatchet({ grade: 'D', parents: [] });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('Grade D');
  });

  it('fails for grade F', () => {
    const result = runInsightRealSnapshotQualityRatchet({ grade: 'F', parents: [] });
    expect(result.passed).toBe(false);
  });

  it('fails for single-angle top parent', () => {
    const result = runInsightRealSnapshotQualityRatchet({
      grade: 'A',
      parents: [{ weakTree: false, angles: ['base_report'] }],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('single angle');
  });

  it('fails for weak tree top parent', () => {
    const result = runInsightRealSnapshotQualityRatchet({
      grade: 'B',
      parents: [{ weakTree: true, angles: ['base_report', 'official_response'] }],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('weak tree');
  });
});
