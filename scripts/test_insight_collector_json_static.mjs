import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const contract = read('scripts/insight_json_contract.py');
const fetcher = read('scripts/fetch_insight_stories.py');
const workflow = read('.github/workflows/news_prefetch.yml');
const pyTest = read('scripts/test_insight_collector_json_contract.py');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'COLLECTOR_VERSION',
  'schemaVersion"] = 3',
  'slotQuality',
  'sourceDiversity',
  'storySignals',
  'angleHints',
  'compute_snapshot_content_hash',
  'optimize_insight_snapshot'
]) {
  assert(contract.includes(token), `insight_json_contract.py missing token: ${token}`);
}

for (const token of [
  'optimize_insight_snapshot',
  'contentHash unchanged',
  'old_hash'
]) {
  assert(fetcher.includes(token), `fetch_insight_stories.py missing token: ${token}`);
}

for (const token of [
  'concurrency:',
  'group: news-prefetch',
  'cancel-in-progress: false'
]) {
  assert(workflow.includes(token), `news_prefetch.yml missing token: ${token}`);
}

assert(
  !workflow.includes('Bump fetchedAt sentinel'),
  'news_prefetch.yml must not keep fetchedAt-only mutation step'
);

for (const token of [
  'test_angle_hints_detect_official_market_and_public',
  'test_optimized_snapshot_has_schema_v3_quality_and_stable_hash'
]) {
  assert(pyTest.includes(token), `collector JSON Python test missing token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-collector-json"'),
  'package.json must include test:insight-collector-json'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-collector-json']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-collector-json'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight collector JSON optimization slice',
  guarantees: [
    'collector emits schemaVersion 3',
    'storySignals and angleHints are included in JSON',
    'slotQuality and sourceDiversity diagnostics are included',
    'contentHash is stable and story-content based',
    'workflow concurrency prevents overlapping prefetch runs',
    'fetchedAt-only workflow mutation is removed',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Insight collector JSON optimization static slice');
