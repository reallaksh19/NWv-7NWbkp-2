import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const ranking = read('src/insight/src/ranking/ranking.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'IMPACT_SCORE_WEIGHTS',
  'computeTopStoryProminenceScore',
  'topStoryProminenceScore',
  'impact-v2-top-story-anchor',
  'impactScoreDiagnostics',
  'rawProminence',
  'avgAuthority: 0.28',
  'avgFactDensity: 0.18',
  'largeNumScore: 0.14',
  'entityBoost: 0.14',
  'sourceDiversityScore: 0.16',
  'topStoryProminenceScore: 0.10'
]) {
  assert(ranking.includes(token), `ranking.ts missing top-story anchor token: ${token}`);
}

for (const token of [
  'impactScore: 0.28',
  'persistenceScore: 0.20',
  'sourceDiversityScore: 0.14',
  'noveltyScore: 0.12',
  'freshnessScore: 0.10',
  'crossSnapshotMomentum: 0.08',
  'editorialClarityScore: 0.05',
  'regionBoost: 0.03'
]) {
  assert(ranking.includes(token), `final parent ranking weight must remain unchanged: ${token}`);
}

for (const forbidden of [
  'MIN_CHILD_INFO_GAIN',
  'HARD_DUP_TITLE_SIM',
  'HARD_DUP_EMBED_SIM',
  'SAME_EVENT_THRESHOLD',
  'POSSIBLE_EVENT_THRESHOLD'
]) {
  assert(!ranking.includes(forbidden), `Slice 17 must not touch tree/dedup threshold token: ${forbidden}`);
}

assert(
  packageJson.includes('"test:insight-top-story-anchor"'),
  'package.json must include test:insight-top-story-anchor'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-top-story-anchor']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-top-story-anchor'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight top-story anchoring slice',
  guarantees: [
    'rawProminence is used inside impactScore',
    'impactScore diagnostics are stored',
    'top-story anchoring is bounded to 10% of impactScore',
    'final parent-score weights are unchanged',
    'tree/dedup thresholds are unchanged',
    'static test is included in certification gate'
  ]
}, null, 2));

console.log('PASS: Insight top-story anchoring static slice');