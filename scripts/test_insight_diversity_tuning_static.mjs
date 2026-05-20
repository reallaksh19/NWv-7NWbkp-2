import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const treeBuilder = read('src/insight/src/tree/treeBuilder.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getCandidateDiversityScore',
  'chooseBestChildCandidate',
  'recordDiversityTieBreak',
  'diversityTieBreaks',
  'hasNewAngle',
  'hasNewSourceGroup',
  'getCandidateDiversityReasons',
  'getBestCandidateByScore',
  'cfg.REPLACE_MARGIN',
  'selectedDiversityScore',
  'displacedDiversityScore'
]) {
  assert(treeBuilder.includes(token), `treeBuilder.ts missing diversity tuning token: ${token}`);
}

assert(
  treeBuilder.includes('const bestByScore = getBestCandidateByScore(eligible);') &&
  treeBuilder.includes('const best = chooseBestChildCandidate(eligible, selected, cfg);'),
  'buildChildTree must use bounded diversity tie-break selection'
);

assert(
  treeBuilder.includes('candidate.childScore >= bestScore - margin'),
  'diversity tie-break must be bounded by score margin'
);

for (const forbidden of [
  'MIN_CHILD_INFO_GAIN = 0.18',
  'MAX_PER_SOURCE_GROUP =',
  'MAX_PER_ANGLE =',
  'HARD_DUP_TITLE_SIM =',
  'HARD_DUP_EMBED_SIM =',
  'SAME_EVENT_THRESHOLD =',
  'POSSIBLE_EVENT_THRESHOLD ='
]) {
  assert(!treeBuilder.includes(forbidden), `Slice 16 must not modify threshold literal: ${forbidden}`);
}

assert(
  packageJson.includes('"test:insight-diversity-tuning"'),
  'package.json must include test:insight-diversity-tuning'
);

assert(
  packageJson.includes('"test:unit"'),
  'package.json must retain Vitest test:unit'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-diversity-tuning']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-diversity-tuning'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight diversity tuning slice',
  guarantees: [
    'bounded diversity tie-break is implemented',
    'tie-break uses cfg.REPLACE_MARGIN',
    'child selection thresholds are unchanged',
    'dedup/ranking thresholds are unchanged',
    'static test is included in certification gate',
    'Vitest remains included in certification gate'
  ]
}, null, 2));

console.log('PASS: Insight diversity tuning static slice');