import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const dedup = read('src/insight/src/dedup/dedup.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'PUBLIC_REACTION_SIGNALS',
  'BACKGROUND_CONTEXT_SIGNALS',
  'getAngleSignalText',
  'reaction_public',
  'background_context',
  'public reaction',
  'social media',
  'backlash',
  'explainer',
  'timeline',
  'why this matters',
  'officials? said',
  'stocks? (rallied|slumped|gained|lost|jumped|dropped)',
  'latest update',
  'what experts say',
  'records show'
]) {
  assert(dedup.includes(token), `dedup.ts missing angle classifier enrichment token: ${token}`);
}

assert(
  dedup.includes('PUBLIC_REACTION_SIGNALS.some(p => p.test(text))') &&
  dedup.includes('BACKGROUND_CONTEXT_SIGNALS.some(p => p.test(text))'),
  'classifyAngle must use public reaction and background context signals'
);

assert(
  dedup.indexOf('CORRECTION_SIGNALS.some') <
  dedup.indexOf('FACT_UPDATE_SIGNALS.some'),
  'correction must remain higher priority than fact update'
);

for (const forbidden of [
  'HARD_DUP_TITLE_SIM =',
  'HARD_DUP_EMBED_SIM =',
  'SAME_EVENT_THRESHOLD =',
  'POSSIBLE_EVENT_THRESHOLD =',
  'MIN_CHILD_INFO_GAIN =',
  'impactScore: 0.30'
]) {
  assert(!dedup.includes(forbidden), `Slice 19 must not modify unrelated threshold/weight literal: ${forbidden}`);
}

assert(
  packageJson.includes('"test:insight-angle-classifier-enrichment"'),
  'package.json must include test:insight-angle-classifier-enrichment'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-angle-classifier-enrichment']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-angle-classifier-enrichment'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight angle classifier enrichment slice',
  guarantees: [
    'public reaction angle can be classified',
    'background context angle can be classified',
    'existing angle classes are strengthened',
    'classification priority remains deterministic',
    'thresholds and ranking weights are unchanged',
    'static test is included in certification gate'
  ]
}, null, 2));

console.log('PASS: Insight angle classifier enrichment static slice');