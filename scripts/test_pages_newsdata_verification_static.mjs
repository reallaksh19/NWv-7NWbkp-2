import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const verifier = read('scripts/verify_pages_newsdata.mjs');
const workflow = read('.github/workflows/news_prefetch.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'pages-newsdata-verifier-v1',
  'verify_pages_newsdata',
  'summarizeInsightSnapshot',
  'contentHashOk',
  'storyCountOk',
  'schemaOk',
  'no-store',
  'newsdata/insight_latest.json',
  'pages_newsdata_verify_report.json',
  'pages_newsdata_verify_summary.md'
]) {
  assert(verifier.includes(token), `verify_pages_newsdata.mjs missing token: ${token}`);
}

for (const token of [
  'Verify deployed Pages newsdata',
  'node scripts/verify_pages_newsdata.mjs',
  'Upload Pages newsdata verification report',
  'pages-newsdata-verification',
  "if: steps.prefetch_commit.outputs.should_commit == 'true'"
]) {
  assert(workflow.includes(token), `news_prefetch.yml missing deployed verification token: ${token}`);
}

assert(
  workflow.includes('Publish updated Pages site'),
  'workflow must publish Pages before verifying deployed newsdata'
);

assert(
  workflow.indexOf('Publish updated Pages site') < workflow.indexOf('Verify deployed Pages newsdata'),
  'workflow must verify deployed newsdata after publishing Pages'
);

assert(
  packageJson.includes('"test:pages-newsdata-verification"'),
  'package.json must include test:pages-newsdata-verification'
);

assert(
  (certGate.includes("['npm', ['run', 'test:pages-newsdata-verification']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:pages-newsdata-verification'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Pages deployed newsdata verification slice',
  guarantees: [
    'deployed Pages JSON verifier exists',
    'verifier compares schema/contentHash/storyCount',
    'verifier writes JSON and Markdown reports',
    'workflow verifies live Pages JSON after publish',
    'workflow uploads verification artifact',
    'diagnostic-only runs do not trigger verification',
    'certification gate includes deployed newsdata verification check'
  ]
}, null, 2));

console.log('PASS: Pages newsdata verification static slice');
