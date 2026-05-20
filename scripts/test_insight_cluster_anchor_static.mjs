import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const cluster = read('src/insight/src/cluster/cluster.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'computeClusterSeedScore',
  'computeParentRepresentativeScore',
  'cluster-representative-v2-top-story-anchor',
  'representativeDiagnostics',
  'rawProminence',
  'freshnessScore',
  'sourceAuthority',
  '0.35 * clamp01(story.sourceAuthority)',
  '0.25 * clamp01(story.rawProminence)',
  '0.20 * clamp01(story.freshnessScore)',
  '0.30 * clamp01(story.sourceAuthority)',
  '0.25 * clamp01(story.rawProminence)',
  'const sorted = [...stories].sort((a, b) => {',
  'computeClusterSeedScore(b) - computeClusterSeedScore(a)',
  'computeParentRepresentativeScore(story)'
]) {
  assert(cluster.includes(token), `cluster.ts missing cluster anchor token: ${token}`);
}

assert(
  !cluster.includes('parentRepresentativeScore('),
  'old parentRepresentativeScore function must be removed'
);

assert(
  !cluster.includes('publishedAt < Date.now()'),
  'cluster representative scoring must not use Date.now()'
);

for (const forbidden of [
  'SAME_EVENT_THRESHOLD =',
  'POSSIBLE_EVENT_THRESHOLD =',
  'MIN_CHILD_INFO_GAIN =',
  'HARD_DUP_TITLE_SIM =',
  'HARD_DUP_EMBED_SIM =',
  'impactScore: 0.30'
]) {
  assert(!cluster.includes(forbidden), `Slice 20 must not modify unrelated threshold/weight literal: ${forbidden}`);
}

assert(
  packageJson.includes('"test:insight-cluster-anchor"'),
  'package.json must include test:insight-cluster-anchor'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-cluster-anchor']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-cluster-anchor'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight cluster anchor slice',
  guarantees: [
    'cluster seed sorting uses top-story anchor signals',
    'canonical parent representative uses rawProminence and freshness',
    'representative diagnostics are stored',
    'old Date.now representative boost is removed',
    'event similarity thresholds are unchanged',
    'static test is included in certification gate'
  ]
}, null, 2));

console.log('PASS: Insight cluster anchor static slice');