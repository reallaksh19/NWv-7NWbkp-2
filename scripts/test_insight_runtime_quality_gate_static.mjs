import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const gate = read('src/insight/src/diagnostics/insightRuntimeQualityGate.ts');
const gateTest = read('src/insight/src/diagnostics/insightRuntimeQualityGate.cert.test.ts');
const page = read('src/pages/InsightPage.jsx');
const css = read('src/styles/InsightPage.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'recoverInsightRuntimeQuality', 'isInsightQualityAcceptable', 'makeInsightRecoveryConfig',
  'RECOVERY_CONFIG_OVERRIDES', 'runtimeQualityGate', 'relaxed-tree recovery'
]) {
  assert(gate.includes(token), `insightRuntimeQualityGate.ts missing token: ${token}`);
}

for (const token of [
  'Insight runtime quality gate certification',
  'recovers a weak single-child result',
  'visible angles', 'multiAngleCount'
]) {
  assert(gateTest.includes(token), `insightRuntimeQualityGate.cert.test.ts missing token: ${token}`);
}

for (const token of [
  'recoverInsightRuntimeQuality', 'runtimeQuality.result',
  'data-insight-runtime-quality-gate', 'post-pipeline-recovery', 'Runtime quality gate'
]) {
  assert(page.includes(token), `InsightPage.jsx missing runtime gate token: ${token}`);
}

for (const token of [
  '.insight-runtime-quality', '.insight-runtime-quality--recovered', '.insight-runtime-quality__meta'
]) {
  assert(css.includes(token), `InsightPage.css missing runtime gate CSS token: ${token}`);
}

assert(packageJson.includes('"test:insight-runtime-quality-gate"'), 'package.json must include test:insight-runtime-quality-gate');
assert((certGate.includes("['npm', ['run', 'test:insight-runtime-quality-gate']]") || certGate.includes('certification_manifest.json')), 'certification gate must run test:insight-runtime-quality-gate');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight runtime quality gate slice' }, null, 2));
console.log('PASS: Insight runtime quality gate static slice');
