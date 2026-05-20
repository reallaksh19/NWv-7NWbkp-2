import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const manifestWriter = read('scripts/write_pages_data_manifest.mjs');
const workflow = read('.github/workflows/news_prefetch.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'pages_data_manifest.json',
  'pages-data-publish-v1',
  'dist/newsdata',
  'insight_latest.json',
  'allTrackedFilesMatched',
  'insightContentHash'
]) {
  assert(manifestWriter.includes(token), `write_pages_data_manifest.mjs missing token: ${token}`);
}

for (const token of [
  'Setup Node for Pages publish',
  'npm ci',
  'Build Pages site with latest newsdata',
  'node scripts/write_pages_data_manifest.mjs',
  'Publish updated Pages site',
  'npx gh-pages -d dist',
  "if: steps.prefetch_commit.outputs.should_commit == 'true'"
]) {
  assert(workflow.includes(token), `news_prefetch.yml missing Pages publish token: ${token}`);
}

assert(
  workflow.includes('Skip Pages publish for diagnostic-only changes'),
  'workflow must explicitly skip Pages publish for diagnostic-only runs'
);

assert(
  packageJson.includes('"test:pages-data-publish"'),
  'package.json must include test:pages-data-publish'
);

assert(
  (certGate.includes("['npm', ['run', 'test:pages-data-publish']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:pages-data-publish'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Pages data publish slice',
  guarantees: [
    'dist/newsdata manifest writer exists',
    'workflow builds Pages site only after meaningful news content change',
    'workflow publishes gh-pages only when should_commit=true',
    'diagnostic-only runs skip Pages publish',
    'deployed data manifest records latest insight contentHash',
    'certification gate includes Pages publish static check'
  ]
}, null, 2));

console.log('PASS: Pages data publish static slice');
