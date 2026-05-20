import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const workflow = fs.existsSync('.github/workflows/news_prefetch.yml')
  ? read('.github/workflows/news_prefetch.yml')
  : '';
const manifest = fs.existsSync('scripts/certification_manifest.json')
  ? read('scripts/certification_manifest.json')
  : '';
const validator = fs.existsSync('scripts/validate_certification_manifest.mjs')
  ? read('scripts/validate_certification_manifest.mjs')
  : '';

const script = packageJson.scripts?.['test:real-insight-snapshot-quality'] || '';

assert(
  script.includes('scripts/test_real_insight_snapshot_quality_static.mjs'),
  'test:real-insight-snapshot-quality must run static guard'
);

assert(
  script.includes('vitest run'),
  'test:real-insight-snapshot-quality must execute Vitest benchmark'
);

assert(
  script.includes('src/insight/src/quality/insightRealSnapshotQuality.cert.test.ts'),
  'test:real-insight-snapshot-quality must target real Insight snapshot Vitest file'
);

if (manifest) {
  assert(
    manifest.includes('test:real-insight-snapshot-quality'),
    'certification_manifest.json must include real snapshot benchmark command'
  );
}

if (validator) {
  assert(
    validator.includes('test:real-insight-snapshot-quality'),
    'validate_certification_manifest.mjs must require real snapshot benchmark command'
  );
}

if (workflow) {
  assert(
    workflow.includes('Upload real Insight quality benchmark report') ||
    workflow.includes('real-insight-quality-report'),
    'news_prefetch workflow must upload real Insight benchmark report artifact'
  );
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Real Insight benchmark execution slice',
  guarantees: [
    'real snapshot npm script runs static guard',
    'real snapshot npm script runs Vitest benchmark',
    'real snapshot benchmark file is targeted explicitly',
    'certification manifest includes real benchmark where present',
    'workflow artifact upload is expected where workflow exists'
  ]
}, null, 2));

console.log('PASS: Real Insight benchmark execution static slice');
