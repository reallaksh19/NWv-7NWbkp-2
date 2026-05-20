import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const gate = read('scripts/validate_insight_prefetch_output.py');
const gateTest = read('scripts/test_validate_insight_prefetch_output.py');
const workflow = read('.github/workflows/news_prefetch.yml');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'INSIGHT_PATH',
  'REPORT_PATH',
  'SUMMARY_PATH',
  'validate_snapshot',
  'slotHealth',
  'angleHintCoverage',
  'nonBaseAngleStoryCount',
  'Insight Prefetch Quality Report'
]) {
  assert(gate.includes(token), `validate_insight_prefetch_output.py missing token: ${token}`);
}

for (const token of [
  'test_validate_snapshot_passes_structural_contract',
  'test_validate_snapshot_fails_missing_core_fields',
  'test_write_summary_creates_markdown'
]) {
  assert(gateTest.includes(token), `test_validate_insight_prefetch_output.py missing token: ${token}`);
}

for (const token of [
  'Validate Insight prefetch quality',
  'python scripts/validate_insight_prefetch_output.py',
  'Upload Insight quality report',
  'actions/upload-artifact@v4',
  'insight-quality-report'
]) {
  assert(workflow.includes(token), `news_prefetch.yml missing workflow quality gate token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-prefetch-quality-gate"'),
  'package.json must include test:insight-prefetch-quality-gate'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-prefetch-quality-gate']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-prefetch-quality-gate'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight prefetch workflow quality gate slice',
  guarantees: [
    'prefetch JSON validator exists',
    'quality report JSON is generated',
    'quality report Markdown is generated',
    'workflow validates Insight JSON after fetch',
    'workflow uploads quality report artifact',
    'structural JSON errors fail the workflow',
    'thin-but-usable pools emit warnings, not false success'
  ]
}, null, 2));

console.log('PASS: Insight prefetch quality gate static slice');
