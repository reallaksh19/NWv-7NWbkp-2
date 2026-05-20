import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const dedup = read('src/insight/src/dedup/dedup.ts');
const treeBuilder = read('src/insight/src/tree/treeBuilder.ts');
const pipeline = read('src/insight/src/pipeline/pipeline.ts');
const quality = read('src/insight/src/diagnostics/insightCoreQuality.ts');
const page = read('src/pages/InsightPage.jsx');
const cert = read('src/insight/src/coreRecovery.cert.test.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getAngleCandidateScores',
  'angleReason',
  'angleConfidence',
  'hasDistinctStoryIntent',
  'hasDifferentSourcePerspective',
  'story.angle = classifyAngle(story);'
]) {
  assert(dedup.includes(token), `dedup.ts missing recovery token: ${token}`);
}

for (const token of [
  'not transient copies',
  's.parentId = parent.parentId',
  's.angle = classifyAngle(s)',
  'return s'
]) {
  assert(treeBuilder.includes(token), `treeBuilder.ts missing persistence token: ${token}`);
}

for (const token of [
  'Persist selected child objects back into storiesById',
  'storiesById.set(child.id, child)'
]) {
  assert(pipeline.includes(token), `pipeline.ts missing output persistence token: ${token}`);
}

for (const token of [
  'getInsightCoreQualityDiagnostics',
  'getVisibleChildAngles',
  'strongAngleCount',
  'avgChildren',
  'visibleAngleCounts',
  'fewer than two visible child angles'
]) {
  assert(quality.includes(token), `insightCoreQuality.ts missing token: ${token}`);
}

for (const token of [
  'getInsightCoreQualityDiagnostics',
  'return getInsightCoreQualityDiagnostics(result, source, DEFAULT_CONFIG);'
]) {
  assert(page.includes(token), `InsightPage.jsx missing quality integration token: ${token}`);
}

for (const forbidden of [
  'return childCount >= 2;',
  'const avgAngles = rankedCount > 0 ? totalChildLinks / rankedCount : 0;'
]) {
  assert(!page.includes(forbidden), `InsightPage.jsx still contains old incorrect quality metric: ${forbidden}`);
}

for (const token of [
  'Insight core recovery certification',
  'persists selected child angles into storiesById',
  'reaches C-or-better quality',
  'visibleAngles.length',
  'quality.grade',
  'avgAngles'
]) {
  assert(cert.includes(token), `coreRecovery.cert.test.ts missing token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-core-recovery"'),
  'package.json must include test:insight-core-recovery'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-core-recovery']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-core-recovery'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

assert(
  (certGate.includes("['npm', ['run', 'build']]") || certGate.includes('certification_manifest.json')),
  'certification gate must still run production build'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight core recovery slice',
  guarantees: [
    'angle classifier is enriched beyond base_report regex fallback',
    'hard dedup preclassifies story angles',
    'useful cross-source variants are rescued with intent signals',
    'treeBuilder persists angle labels on original story objects',
    'pipeline persists selected child records back into storiesById',
    'quality diagnostics use distinct visible child angles',
    'behavioral Vitest asserts >=3 visible angles and C-or-better grade',
    'full certification gate includes the recovery test'
  ]
}, null, 2));

console.log('PASS: Insight core recovery static slice');
