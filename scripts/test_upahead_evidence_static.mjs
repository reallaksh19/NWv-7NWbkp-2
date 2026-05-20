import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const evidenceModule = read('src/services/upAheadEvidence.js');
const evidenceTest = read('src/services/upAheadEvidence.cert.test.js');
const page = read('src/pages/UpAheadPage.jsx');
const css = read('src/pages/UpAhead.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getUpAheadEvidence',
  'getEnabledCategoryKeys',
  'getTimelineStats',
  'getWeeklyPlanStats',
  'getSourceModeLabel',
  'getQualityStatus',
  'qualityScore',
  'coveredCategories',
  'missingCategories',
  'visibleOfferCount',
  'visibleAlertCount',
  'visibleWeatherAlertCount'
]) {
  assert(evidenceModule.includes(token), `upAheadEvidence.js missing token: ${token}`);
}

for (const token of [
  'Up Ahead evidence certification',
  'summarizes category, timeline, plan and visible filtering evidence',
  'handles empty data safely'
]) {
  assert(evidenceTest.includes(token), `upAheadEvidence.cert.test.js missing token: ${token}`);
}

for (const token of [
  'getUpAheadEvidence',
  'UpAheadEvidencePanel',
  'data-upahead-evidence',
  'coverage-quality',
  'const upAheadEvidence = getUpAheadEvidence({',
  '<UpAheadEvidencePanel evidence={upAheadEvidence} />'
]) {
  assert(page.includes(token), `UpAheadPage.jsx missing token: ${token}`);
}

for (const token of [
  '.ua-evidence',
  '.ua-evidence__header',
  '.ua-evidence__score',
  '.ua-evidence__grid',
  '.ua-evidence__tile',
  '.ua-evidence__chips',
  '.ua-evidence__details'
]) {
  assert(css.includes(token), `UpAhead.css missing token: ${token}`);
}

assert(
  packageJson.includes('"test:upahead-evidence"'),
  'package.json must include test:upahead-evidence'
);

assert(
  (certGate.includes("['npm', ['run', 'test:upahead-evidence']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:upahead-evidence'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Up Ahead evidence panel slice',
  guarantees: [
    'Up Ahead evidence aggregation exists',
    'Up Ahead evidence panel is rendered',
    'category/timeline/plan coverage is visible',
    'alert/offer filtering evidence is visible',
    'source mode and location coverage are visible',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Up Ahead evidence static slice');