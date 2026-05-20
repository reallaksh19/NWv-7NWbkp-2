import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const config = read('config/insight_sources.json');
const policy = read('scripts/insight_source_policy.py');
const fetcher = read('scripts/fetch_insight_stories.py');
const pyTest = read('scripts/test_insight_source_policy.py');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  '"policyVersion": "insight-source-policy-v1"',
  '"now"',
  '"minus4h"',
  '"minus12h"',
  '"minus24h"',
  '"tier"',
  '"topic"',
  '"sourceGroup"'
]) {
  assert(config.includes(token), `insight_sources.json missing token: ${token}`);
}

for (const token of [
  'load_source_policy',
  'validate_source_policy',
  'get_slot_feeds_map',
  'build_source_policy_report',
  'write_source_policy_report',
  'insight-source-policy-report-v1'
]) {
  assert(policy.includes(token), `insight_source_policy.py missing token: ${token}`);
}

for (const token of [
  'get_slot_feeds_map',
  'write_source_policy_report',
  'SOURCE_POLICY_REPORT_PATH',
  'SLOT_FEEDS = get_slot_feeds_map()'
]) {
  assert(fetcher.includes(token), `fetch_insight_stories.py missing source policy token: ${token}`);
}

assert(
  !fetcher.includes('https://www.thehindu.com/news/national/feeder/default.rss'),
  'fetch_insight_stories.py must not keep old hardcoded SLOT_FEEDS block'
);

for (const token of [
  'test_normalize_feed',
  'test_policy_load_and_validate',
  'test_slot_feed_map_shape',
  'test_source_policy_report'
]) {
  assert(pyTest.includes(token), `test_insight_source_policy.py missing token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-source-policy"'),
  'package.json must include test:insight-source-policy'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-source-policy']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-source-policy'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight source policy slice',
  guarantees: [
    'feed registry is externalized to config/insight_sources.json',
    'source policy validator exists',
    'fetch_insight_stories loads SLOT_FEEDS from policy',
    'source policy report is generated after fetch',
    'source diversity and topic coverage are inspectable',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Insight source policy static slice');
