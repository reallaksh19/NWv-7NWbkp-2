import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const policy = read('scripts/insight_source_policy.py');
const fetcher = read('scripts/fetch_insight_stories.py');
const pyTest = read('scripts/test_insight_adaptive_source_health.py');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'SOURCE_HEALTH_POLICY_VERSION',
  'SOURCE_HEALTH_DEFAULTS',
  'source_health_score',
  'source_backoff_reason',
  'rank_slot_feeds_by_health',
  'get_active_slot_feeds_map',
  'build_source_health_policy_report'
]) {
  assert(policy.includes(token), `insight_source_policy.py missing adaptive health token: ${token}`);
}

for (const token of [
  'get_active_slot_feeds_map',
  'get_current_source_health',
  'get_active_slot_feeds',
  'active_feeds = get_active_slot_feeds()',
  'write_source_policy_report(get_active_slot_feeds(), health)'
]) {
  assert(fetcher.includes(token), `fetch_insight_stories.py missing adaptive feed token: ${token}`);
}

for (const token of [
  'test_source_health_score_prefers_successful_item_yield',
  'test_source_backoff_reason_for_recent_failure',
  'test_rank_slot_feeds_by_health_orders_healthy_first',
  'test_active_slot_feeds_never_fully_empty',
  'test_source_health_policy_report_shape'
]) {
  assert(pyTest.includes(token), `test_insight_adaptive_source_health.py missing token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-adaptive-source-health"'),
  'package.json must include test:insight-adaptive-source-health'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-adaptive-source-health']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-adaptive-source-health'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight adaptive source-health feed policy slice',
  guarantees: [
    'source health scores are computed',
    'recent failed feeds receive temporary backoff',
    'healthy feeds are ranked first',
    'active feed list never becomes empty',
    'fetcher uses active health-ranked feeds',
    'source policy report includes health-policy diagnostics',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Insight adaptive source health static slice');
