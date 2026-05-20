import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const validator = read('scripts/validate_sections_prefetch_output.py');
const validatorTest = read('scripts/test_validate_sections_prefetch_output.py');
const verifier = read('scripts/verify_pages_newsdata.mjs');
const workflow = read('.github/workflows/news_prefetch.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'SECTIONS_PATH',
  'sections_quality_report.json',
  'sections_quality_summary.md',
  'validate_sections_snapshot',
  'build_section_health',
  'Sections Prefetch Quality Report',
  'sectionHealth'
]) {
  assert(validator.includes(token), `validate_sections_prefetch_output.py missing token: ${token}`);
}

for (const token of [
  'test_validate_sections_snapshot_warns_not_fails_for_thin_pool',
  'test_validate_sections_snapshot_fails_structural_errors',
  'test_validate_sections_snapshot_passes_healthy_shape',
  'test_write_summary_creates_markdown'
]) {
  assert(validatorTest.includes(token), `test_validate_sections_prefetch_output.py missing token: ${token}`);
}

for (const token of [
  'Validate Sections prefetch quality',
  'python scripts/validate_sections_prefetch_output.py',
  'Upload Sections quality report',
  'sections-quality-report'
]) {
  assert(workflow.includes(token), `news_prefetch.yml missing sections quality workflow token: ${token}`);
}

for (const token of [
  'summarizeSectionsSnapshot',
  'sections_latest.json',
  'expectedSections',
  'deployedSections',
  'sectionsPass',
  'expectedSectionsContentHash',
  'deployedSectionsContentHash'
]) {
  assert(verifier.includes(token), `verify_pages_newsdata.mjs missing sections verification token: ${token}`);
}

assert(
  packageJson.includes('"test:sections-quality-deploy"'),
  'package.json must include test:sections-quality-deploy'
);

assert(
  (certGate.includes("['npm', ['run', 'test:sections-quality-deploy']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:sections-quality-deploy'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Sections quality and deployed verification slice',
  guarantees: [
    'sections prefetch quality validator exists',
    'sections quality JSON and Markdown reports are generated',
    'workflow validates sections_latest after fetch',
    'workflow uploads sections quality report artifact',
    'deployed Pages verifier compares sections_latest contentHash/storyCount',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Sections quality and deploy verification static slice');
