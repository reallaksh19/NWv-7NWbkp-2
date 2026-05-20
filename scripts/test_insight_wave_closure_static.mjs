import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(existsSync('src/services/insightWaveQualityRegister.js'), 'Missing insightWaveQualityRegister.js');
assert(existsSync('src/services/insightWaveQualityRegister.cert.test.js'), 'Missing test');
assert(existsSync('scripts/verify_insight_wave_closure_register.mjs'), 'Missing verifier');

const mod = await import('../src/services/insightWaveQualityRegister.js');
assert(Array.isArray(mod.WAVE_63_SLICES), 'WAVE_63_SLICES must be array');
assert(mod.WAVE_63_SLICES.length === 9, 'Must have 9 slices');
assert(typeof mod.validateWave63Closure === 'function', 'Missing validateWave63Closure');
assert(typeof mod.buildWave63ClosureManifest === 'function', 'Missing buildWave63ClosureManifest');

console.log(JSON.stringify({ status: 'PASS', checked: 'insight-wave-closure' }, null, 2));
console.log('PASS: Wave closure static');
