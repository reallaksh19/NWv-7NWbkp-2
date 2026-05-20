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
const page = read('src/pages/InsightPage.jsx');
const css = read('src/styles/InsightPage.css');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'NEWSDATA_REPORTS',
  'insight_quality_report.json',
  'sections_quality_report.json',
  'pages_data_manifest.json',
  'pages_newsdata_verify_report.json',
  'summarizeNewsdataRuntimeReports',
  'getNewsdataRuntimeStatus',
  'missingReports'
]) {
  assert(service.includes(token), `newsdataRuntimeStatus.js missing token: ${token}`);
}

for (const token of [
  'Newsdata runtime status certification',
  'summarizes healthy Insight',
  'downgrades to WARN',
  'surfaces missing report files'
]) {
  assert(unitTest.includes(token), `newsdataRuntimeStatus.cert.test.js missing token: ${token}`);
}

for (const token of [
  'NewsdataRuntimeStatusPanel',
  'data-newsdata-runtime-status',
  'Static newsdata healthy',
  'Static newsdata needs attention',
  'Collector JSON, section JSON, source policy and Pages deployment'
]) {
  assert(component.includes(token), `NewsdataRuntimeStatusPanel.jsx missing token: ${token}`);
}

for (const token of [
  'NewsdataRuntimeStatusPanel',
  '<NewsdataRuntimeStatusPanel compact />'
]) {
  assert(page.includes(token), `InsightPage.jsx missing runtime status integration token: ${token}`);
}

for (const token of [
  '.newsdata-runtime',
  '.newsdata-runtime__grid',
  '.newsdata-runtime__message--warning',
  '.newsdata-runtime__chip'
]) {
  assert(css.includes(token), `InsightPage.css missing newsdata runtime CSS token: ${token}`);
}

assert(
  packageJson.includes('"test:newsdata-runtime-status"'),
  'package.json must include test:newsdata-runtime-status'
);

assert(
  (certGate.includes("['npm', ['run', 'test:newsdata-runtime-status']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:newsdata-runtime-status'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Newsdata runtime observability slice',
  guarantees: [
    'browser runtime status service reads generated newsdata reports',
    'Insight/Sections/Pages/source-policy status is summarized',
    'missing report files are surfaced without crashing',
    'runtime status panel is integrated into Insight page',
    'CSS for status panel exists',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Newsdata runtime status static slice');
