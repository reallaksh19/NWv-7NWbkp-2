import { WAVE_63_SLICES, validateWave63Closure, buildWave63ClosureManifest } from '../src/services/insightWaveQualityRegister.js';

const all = WAVE_63_SLICES.map(s => s.id);
const result = validateWave63Closure(all);

if (!result.valid) {
  console.error(JSON.stringify({ status: 'FAIL', ...result }, null, 2));
  process.exit(1);
}

const manifest = buildWave63ClosureManifest(all, { note: 'verification run' });
console.log(JSON.stringify({ status: 'PASS', manifest }, null, 2));
console.log('PASS: Wave 63 closure register verified');
