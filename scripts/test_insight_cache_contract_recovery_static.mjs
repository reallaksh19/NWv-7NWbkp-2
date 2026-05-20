import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const repair = read('src/insight/src/diagnostics/insightResultRepair.ts');
const repairTest = read('src/insight/src/diagnostics/insightResultRepair.cert.test.ts');
const page = read('src/pages/InsightPage.jsx');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'INSIGHT_OUTPUT_CONTRACT_VERSION', 'repairInsightResult', 'repairInsightStoryAngle',
  'outputContractRepairDiagnostics', 'repairedStoryAngles', 'parentsStillSingleAngle', 'classifyAngle'
]) {
  assert(repair.includes(token), `insightResultRepair.ts missing token: ${token}`);
}

for (const token of [
  'Insight result repair certification', 'backfills missing child angles',
  'object-shaped cached storiesById', 'already-current contract results'
]) {
  assert(repairTest.includes(token), `insightResultRepair.cert.test.ts missing token: ${token}`);
}

for (const token of [
  'INSIGHT_OUTPUT_CONTRACT_VERSION', 'repairInsightResult', 'CACHE_SCHEMA_VERSION',
  'schemaVersion !== CACHE_SCHEMA_VERSION', 'localStorage.removeItem(CACHE_KEY)',
  'data: repaired', 'repairInsightResult(await runInsightPipeline'
]) {
  assert(page.includes(token), `InsightPage.jsx missing cache contract token: ${token}`);
}

assert(packageJson.includes('"test:insight-cache-contract"'), 'package.json must include test:insight-cache-contract');
assert((certGate.includes("['npm', ['run', 'test:insight-cache-contract']]") || certGate.includes('certification_manifest.json')), 'certification gate must run test:insight-cache-contract');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight cache/output contract recovery slice' }, null, 2));
console.log('PASS: Insight cache contract recovery static slice');
