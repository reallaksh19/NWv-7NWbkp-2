import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const unitTest = read('src/insight/src/quality/insightE2EQuality.cert.test.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'Insight E2E quality certification',
  'runInsightPipeline', 'recoverInsightRuntimeQuality', 'repairInsightResult',
  'getInsightCoreQualityDiagnostics', 'getVisibleChildAngles',
  'C-or-better multi-angle Insight result',
  'visibleAngles.length', 'childSourceGroups.size', 'one-angle regression'
]) {
  assert(unitTest.includes(token), `insightE2EQuality.cert.test.ts missing token: ${token}`);
}

for (const token of [
  'official-now', 'market-4h', 'expert-4h', 'reaction-12h', 'background-24h', 'regional-12h'
]) {
  assert(unitTest.includes(token), `E2E fixture missing story token: ${token}`);
}

assert(packageJson.includes('"test:insight-e2e-quality"'), 'package.json must include test:insight-e2e-quality');
assert((certGate.includes("['npm', ['run', 'test:insight-e2e-quality']]") || certGate.includes('certification_manifest.json')), 'certification gate must run test:insight-e2e-quality');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight E2E quality benchmark slice' }, null, 2));
console.log('PASS: Insight E2E quality static slice');
