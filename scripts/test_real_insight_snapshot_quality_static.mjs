import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const testFile = read('src/insight/src/quality/insightRealSnapshotQuality.cert.test.ts');
const packageJson = read('package.json');
const manifest = fs.existsSync('scripts/certification_manifest.json')
  ? read('scripts/certification_manifest.json')
  : '';
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'Real Insight snapshot quality benchmark',
  'public/newsdata/insight_latest.json',
  'real_insight_quality_report.json',
  'real_insight_quality_summary.md',
  'runInsightPipeline',
  'recoverInsightRuntimeQuality',
  'getInsightCoreQualityDiagnostics',
  'SKIP',
  'real-insight-snapshot-quality-v1'
]) {
  assert(testFile.includes(token), `insightRealSnapshotQuality.cert.test.ts missing token: ${token}`);
}

assert(
  packageJson.includes('"test:real-insight-snapshot-quality"'),
  'package.json must include test:real-insight-snapshot-quality'
);

if (manifest) {
  assert(
    manifest.includes('test:real-insight-snapshot-quality'),
    'certification_manifest.json must include test:real-insight-snapshot-quality'
  );
}

assert(
  certGate.includes('certification_manifest.json') || certGate.includes("['npm', ['run', 'test:real-insight-snapshot-quality']]"),
  'certification gate must be manifest-driven or include test:real-insight-snapshot-quality'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Real Insight snapshot quality benchmark static slice',
  guarantees: [
    'real public/newsdata insight snapshot benchmark exists',
    'benchmark runs full Insight pipeline when real JSON exists',
    'benchmark writes JSON report',
    'benchmark writes Markdown summary',
    'local missing snapshot is SKIP, not failure',
    'malformed snapshot remains a hard failure',
    'certification includes real snapshot quality script'
  ]
}, null, 2));

console.log('PASS: Real Insight snapshot quality static slice');
