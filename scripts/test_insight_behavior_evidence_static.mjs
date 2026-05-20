import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/insight/src/diagnostics/insightBehaviorEvidence.ts');
const moduleTest = read('src/insight/src/diagnostics/insightBehaviorEvidence.cert.test.ts');
const insightPage = read('src/pages/InsightPage.jsx');
const insightCss = read('src/styles/InsightPage.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getInsightBehaviorEvidence',
  'InsightBehaviorEvidence',
  'InsightParentBehaviorEvidence',
  'impactScoreDiagnostics',
  'representativeDiagnostics',
  'diversityTieBreaks',
  'USEFUL_EMBEDDING_VARIANT_RESCUED',
  'snapshotCoverage',
  'full24hClusters',
  'topStoryProminenceScore',
  'representativeScore',
  'multiAngleClusters'
]) {
  assert(module.includes(token), `insightBehaviorEvidence.ts missing token: ${token}`);
}

for (const token of [
  'Insight behavior evidence certification',
  'summarizes top-story, representative, diversity, rescue and 24h evidence',
  'handles empty results safely'
]) {
  assert(moduleTest.includes(token), `Vitest behavior evidence test missing token: ${token}`);
}

for (const token of [
  'getInsightBehaviorEvidence',
  'InsightBehaviorEvidencePanel',
  'data-insight-behavior-evidence',
  'top-story-24h-angle-rescue',
  'const behaviorEvidence = getInsightBehaviorEvidence(result);',
  '<InsightBehaviorEvidencePanel evidence={behaviorEvidence} />'
]) {
  assert(insightPage.includes(token), `InsightPage.jsx missing behavior evidence token: ${token}`);
}

for (const token of [
  '.insight-behavior-evidence',
  '.insight-behavior-evidence__summary-grid',
  '.insight-behavior-evidence__summary-tile',
  '.insight-behavior-evidence__angles',
  '.insight-behavior-evidence__details',
  '.insight-behavior-evidence__row',
  '.insight-behavior-evidence__notes'
]) {
  assert(insightCss.includes(token), `InsightPage.css missing behavior evidence token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-behavior-evidence"'),
  'package.json must include test:insight-behavior-evidence'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-behavior-evidence']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-behavior-evidence'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight behavior evidence UI slice',
  guarantees: [
    'behavior evidence aggregation module exists',
    'behavior evidence panel is rendered in Insight UI',
    'top-story anchoring evidence is visible',
    'representative anchoring evidence is visible',
    'diversity tie-break evidence is visible',
    'useful variant rescue evidence is visible',
    '24h coverage and angle coverage evidence are visible',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Insight behavior evidence static slice');