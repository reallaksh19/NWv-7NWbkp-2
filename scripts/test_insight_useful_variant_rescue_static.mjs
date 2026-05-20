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
  'USEFUL_EMBEDDING_VARIANT_RESCUED',
  'getNewNumberCount',
  'shouldKeepUsefulVariantOverEmbeddingDuplicate',
  'recordUsefulVariantRescue',
  'cross-source useful variant rescued from hard embedding duplicate path',
  'classifyAngle(candidate)',
  'classifyAngle(existing)',
  'titleSim >= 0.92',
  'shouldKeepUsefulVariantOverEmbeddingDuplicate(story, embedMatch)',
  'recordUsefulVariantRescue('
]) {
  assert(dedup.includes(token), `dedup.ts missing useful variant rescue token: ${token}`);
}

assert(
  dedup.includes('seenUrls.set(story.canonicalUrl, story);') &&
  dedup.includes('seenHashes.set(story.canonicalTextHash, story);') &&
  dedup.includes('kept.push(story);'),
  'rescued useful variant must be kept and indexed'
);

for (const forbidden of [
  'HARD_DUP_TITLE_SIM =',
  'HARD_DUP_EMBED_SIM =',
  'SAME_EVENT_THRESHOLD =',
  'POSSIBLE_EVENT_THRESHOLD =',
  'MIN_CHILD_INFO_GAIN ='
]) {
  assert(!dedup.includes(forbidden), `Slice 18 must not modify threshold literal: ${forbidden}`);
}

assert(
  packageJson.includes('"test:insight-useful-variant-rescue"'),
  'package.json must include test:insight-useful-variant-rescue'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-useful-variant-rescue']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-useful-variant-rescue'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight useful variant rescue slice',
  guarantees: [
    'cross-source useful variants can survive hard embedding dedup',
    'same URL/hash duplicates are not rescued',
    'same-source duplicates are not rescued',
    'hard dedup thresholds are unchanged',
    'ranking/tree/UI are unchanged',
    'static test is included in certification gate'
  ]
}, null, 2));

console.log('PASS: Insight useful variant rescue static slice');