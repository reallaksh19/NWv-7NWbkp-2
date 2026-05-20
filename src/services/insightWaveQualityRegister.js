// Wave 63 quality register — prevents UI-only improvement from being accepted as real quality work

export const WAVE_63_SLICES = [
  { id: '63A', name: 'Insight RCA Metrics', type: 'service' },
  { id: '63B', name: 'Angle-Diverse Child Selection', type: 'algorithm' },
  { id: '63C', name: 'Useful Variant Rescue', type: 'algorithm' },
  { id: '63D', name: 'Source Diversity Guard', type: 'algorithm' },
  { id: '63E', name: 'Parent Reranking', type: 'algorithm' },
  { id: '63F', name: 'Real Snapshot Quality Ratchet', type: 'quality_gate' },
  { id: '63G', name: 'Strict Ratchet Runtime + Workflow', type: 'infrastructure' },
  { id: '63H', name: 'Insight Quality Dashboard', type: 'ui' },
  { id: '63I', name: 'Wave Closure Manifest', type: 'closure' },
];

export function validateWave63Closure(completedSliceIds) {
  const required = new Set(WAVE_63_SLICES.map(s => s.id));
  const provided = new Set(completedSliceIds);
  const missing = [...required].filter(id => !provided.has(id));
  const uiOnly = WAVE_63_SLICES.filter(s => s.type === 'ui').map(s => s.id);

  const algorithmSlices = WAVE_63_SLICES.filter(s => s.type === 'algorithm').map(s => s.id);
  const algorithmComplete = algorithmSlices.every(id => provided.has(id));

  const valid = missing.length === 0 && algorithmComplete;

  return {
    valid,
    missing,
    algorithmComplete,
    uiOnlySlices: uiOnly,
    warning: !algorithmComplete
      ? 'Wave 63 cannot be closed with UI-only improvements — algorithm slices must be complete'
      : null,
  };
}

export function buildWave63ClosureManifest(completedSliceIds, rcaSummary) {
  const validation = validateWave63Closure(completedSliceIds);
  return {
    wave: 63,
    closedAt: new Date().toISOString(),
    valid: validation.valid,
    completedSlices: completedSliceIds,
    missingSlices: validation.missing,
    algorithmComplete: validation.algorithmComplete,
    rcaSummary: rcaSummary ?? null,
    warning: validation.warning,
  };
}
