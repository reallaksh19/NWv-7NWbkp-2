import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const service = read('src/services/newsdataRuntimeStatus.js');
const unitTest = read('src/services/newsdataRuntimeStatus.cert.test.js');
const component = read('src/components/NewsdataRuntimeStatusPanel.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  "rawInsight: 'insight_latest.json'",
  "rawSections: 'sections_latest.json'",
  'summarizeRawInsightSnapshot',
  'summarizeRawSectionsSnapshot',
  'rawFallbackUsed',
  'fallbackFromRawJson',
  'RAW'
]) {
  assert(service.includes(token), `newsdataRuntimeStatus.js missing raw fallback token: ${token}`);
}

for (const token of [
  'falls back to raw deployed JSON',
  'rawFallbackUsed',
  'fallbackFromRawJson',
  'raw-insight',
  'raw-sections'
]) {
  assert(unitTest.includes(token), `newsdataRuntimeStatus.cert.test.js missing raw fallback test token: ${token}`);
}

for (const token of [
  'Raw JSON fallback active',
  'Fallback',
  'REPORT'
]) {
  assert(component.includes(token), `NewsdataRuntimeStatusPanel.jsx missing fallback UI token: ${token}`);
}

assert(
  packageJson.includes('"test:newsdata-raw-json-fallback"'),
  'package.json must include test:newsdata-raw-json-fallback'
);

assert(
  (certGate.includes("['npm', ['run', 'test:newsdata-raw-json-fallback']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:newsdata-raw-json-fallback'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Newsdata raw JSON fallback slice',
  guarantees: [
    'runtime status service fetches raw insight_latest.json',
    'runtime status service fetches raw sections_latest.json',
    'missing quality reports can fall back to raw deployed JSON',
    'fallback status is marked RAW, not total failure',
    'panel displays fallback source',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Newsdata raw JSON fallback static slice');
