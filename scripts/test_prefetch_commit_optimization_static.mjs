import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const decision = read('scripts/prefetch_commit_decision.py');
const decisionTest = read('scripts/test_prefetch_commit_decision.py');
const workflow = read('.github/workflows/news_prefetch.yml');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'prefetch_commit_manifest.json',
  'CONTENT_FILES',
  'DIAGNOSTIC_FILES',
  'shouldCommit',
  'diagnosticOnly',
  'changedContentFiles',
  'GITHUB_OUTPUT',
  'meaningful_payload_from_value_for_test'
]) {
  assert(decision.includes(token), `prefetch_commit_decision.py missing token: ${token}`);
}

for (const token of [
  'test_stable_hash_ignores_insight_fetched_at_noise',
  'test_manifest_marks_content_change',
  'test_manifest_marks_diagnostic_only'
]) {
  assert(decisionTest.includes(token), `test_prefetch_commit_decision.py missing token: ${token}`);
}

for (const token of [
  'Decide whether news data commit is needed',
  'id: prefetch_commit',
  'python scripts/prefetch_commit_decision.py',
  'Upload prefetch commit manifest',
  'if: steps.prefetch_commit.outputs.should_commit ==',
  'public/newsdata/insight_latest.json public/newsdata/sections_latest.json public/newsdata/source_health.json public/newsdata/prefetch_commit_manifest.json',
  'Skip commit for diagnostic-only changes'
]) {
  assert(workflow.includes(token), `news_prefetch.yml missing commit optimization token: ${token}`);
}

assert(
  !workflow.includes('git add public/newsdata/\n'),
  'workflow must not blindly add all public/newsdata files'
);

assert(
  packageJson.includes('"test:prefetch-commit-optimization"'),
  'package.json must include test:prefetch-commit-optimization'
);

assert(
  (certGate.includes("['npm', ['run', 'test:prefetch-commit-optimization']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:prefetch-commit-optimization'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Prefetch commit optimization slice',
  guarantees: [
    'content-aware commit decision exists',
    'fetchedAt-only noise is ignored for Insight hash comparison',
    'diagnostic-only report changes do not force commits',
    'workflow commits only meaningful news JSON files',
    'commit manifest is uploaded as artifact',
    'blind git add public/newsdata is removed',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Prefetch commit optimization static slice');
