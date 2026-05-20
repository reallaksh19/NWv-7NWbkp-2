import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const workflow = read('.github/workflows/travel-local-news.yml');
const collector = read('scripts/collect_travel_local_news.mjs');
const workflowTest = read('src/services/travelNewsWorkflow.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'collect_travel_local_news.mjs',
  'travel-local-*.json',
  'TRAVEL_LOCATION_KEY',
  'workflow_dispatch',
]) {
  assert(workflow.includes(token), '.github/workflows/travel-local-news.yml missing token: ' + token);
}

for (const token of [
  'buildTravelNewsQueries',
  'getTravelLocationProfile',
  'travel-local-',
  'sourceMode',
  'github-rss-prefetch',
]) {
  assert(collector.includes(token), 'collect_travel_local_news.mjs missing token: ' + token);
}

for (const token of [
  'Travel news workflow certification',
  'GitHub Actions workflow file exists',
  'RSS collector script exists',
]) {
  assert(workflowTest.includes(token), 'travelNewsWorkflow.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:travel-news-workflow"'),
  'package.json must include test:travel-news-workflow'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-news-workflow']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include travel news workflow test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel news workflow',
  guarantees: [
    'GitHub Actions workflow exists',
    'RSS collector script exists',
    'Workflow references travel-local JSON pattern',
    'Collector uses profile-based queries'
  ]
}, null, 2));

console.log('PASS: Travel news workflow static slice');
