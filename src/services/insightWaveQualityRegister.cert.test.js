import { describe, it, expect } from 'vitest';
import {
  WAVE_63_SLICES,
  validateWave63Closure,
  buildWave63ClosureManifest,
} from './insightWaveQualityRegister.js';

const ALL_SLICE_IDS = WAVE_63_SLICES.map(s => s.id);

describe('insightWaveQualityRegister', () => {
  it('validates full closure successfully', () => {
    const result = validateWave63Closure(ALL_SLICE_IDS);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.algorithmComplete).toBe(true);
  });

  it('fails when algorithm slices are missing', () => {
    const withoutAlgorithm = ALL_SLICE_IDS.filter(id => !['63B', '63C', '63D', '63E'].includes(id));
    const result = validateWave63Closure(withoutAlgorithm);
    expect(result.algorithmComplete).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('algorithm slices must be complete');
  });

  it('UI-only closure is rejected', () => {
    const uiOnly = ['63H'];
    const result = validateWave63Closure(uiOnly);
    expect(result.valid).toBe(false);
  });

  it('buildWave63ClosureManifest includes wave number and closedAt', () => {
    const manifest = buildWave63ClosureManifest(ALL_SLICE_IDS, { grade: 'A' });
    expect(manifest.wave).toBe(63);
    expect(manifest.closedAt).toBeTruthy();
    expect(manifest.valid).toBe(true);
    expect(manifest.rcaSummary.grade).toBe('A');
  });

  it('WAVE_63_SLICES has all 9 slices', () => {
    expect(WAVE_63_SLICES).toHaveLength(9);
  });
});
