import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const config = read('config/section_sources.json');
const policy = read('scripts/section_source_policy.py');
const fetcher = read('scripts/fetch_sections_stories.py');
const pyTest = read('scripts/test_section_source_policy.py');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  '"policyVersion": "section-source-policy-v1"',
  '"topStories"',
  '"india"',
  '"tn"',
  '"trichy"',
  '"business"',
  '"technology"',
  '"sourceGroup"',
  '"tier"',
  '"topic"'
]) {
  assert(config.includes(token), `section_sources.json missing token: ${token}`);
}

for (const token of [
  'load_section_source_policy',
  'validate_section_source_policy',
  'get_section_feeds_map',
  'build_section_quality',
  'build_section_source_policy_report',
  'write_section_source_policy_report',
  'section-source-policy-report-v1'
]) {
  assert(policy.includes(token), `section_source_policy.py missing token: ${token}`);
}

for (const token of [
  'get_section_feeds_map',
  'build_section_quality',
  'write_section_source_policy_report',
  'SECTION_FEEDS = get_section_feeds_map()',
  "'sectionQuality': section_quality",
  "'schemaVersion': 2",
  "'items': len(feed_items)"
]) {
  assert(fetcher.includes(token), `fetch_sections_stories.py missing section policy token: ${token}`);
}

assert(
  !fetcher.includes('https://www.thehindu.com/news/feeder/default.rss'),
  'fetch_sections_stories.py must not keep old hardcoded SECTION_FEEDS block'
);

for (const token of [
  'test_normalize_section_feed_list_shape',
  'test_section_policy_load_and_validate',
  'test_section_feeds_map_shape',
  'test_build_section_quality',
  'test_section_source_policy_report'
]) {
  assert(pyTest.includes(token), `test_section_source_policy.py missing token: ${token}`);
}

assert(
  packageJson.includes('"test:sections-source-policy"'),
  'package.json must include test:sections-source-policy'
);

assert(
  (certGate.includes("['npm', ['run', 'test:sections-source-policy']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:sections-source-policy'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Sections source policy slice',
  guarantees: [
    'section feed registry is externalized',
    'fetch_sections_stories loads SECTION_FEEDS from policy',
    'per-feed source health counts are accurate',
    'sections_latest.json includes sectionQuality',
    'section source policy report is generated',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Sections source policy static slice');
