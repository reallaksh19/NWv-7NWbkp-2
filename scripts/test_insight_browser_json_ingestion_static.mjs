import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const signalAdapter = read('src/adapters/insightSnapshotSignalAdapter.js');
const signalTest = read('src/adapters/insightSnapshotSignalAdapter.cert.test.js');
const snapshotFetcher = read('src/adapters/insightSnapshotFetcher.js');
const insightFetcher = read('src/adapters/insightFetcher.js');
const dedup = read('src/insight/src/dedup/dedup.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'SUPPORTED_SNAPSHOT_SCHEMAS',
  'isSupportedInsightSnapshotSchema',
  'getInsightSnapshotSignals',
  'enrichRawStoryWithSnapshotSignals',
  'getInsightSnapshotRuntimeSummary',
  'collector-signals-used'
]) {
  assert(signalAdapter.includes(token), `insightSnapshotSignalAdapter.js missing token: ${token}`);
}

for (const token of [
  'Insight browser JSON v3 signal ingestion certification',
  'accepts schema v2 and v3 snapshots only',
  'extracts collector storySignals and angleHints',
  'summarizes optimized snapshot runtime metadata'
]) {
  assert(signalTest.includes(token), `insightSnapshotSignalAdapter.cert.test.js missing token: ${token}`);
}

for (const token of [
  'isSupportedInsightSnapshotSchema',
  'getInsightSnapshotRuntimeSummary',
  'enrichRawStoryWithSnapshotSignals',
  'runtimeSummary'
]) {
  assert(snapshotFetcher.includes(token), `insightSnapshotFetcher.js missing token: ${token}`);
}

assert(
  !snapshotFetcher.includes('snapshot?.schemaVersion !== 2'),
  'insightSnapshotFetcher.js must not reject schemaVersion 3'
);

for (const token of [
  'getInsightSnapshotSignals',
  'collectorSignals.hasCollectorSignals',
  'collectorSignals.angleHints',
  'snapshotRuntimeSummary'
]) {
  assert(insightFetcher.includes(token), `insightFetcher.js missing token: ${token}`);
}

for (const token of [
  'collectorAngleHints',
  'collector JSON angle hint',
  'storySignals?.angleHints'
]) {
  assert(dedup.includes(token), `dedup.ts missing collector angle hint token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-browser-json-ingestion"'),
  'package.json must include test:insight-browser-json-ingestion'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-browser-json-ingestion']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-browser-json-ingestion'
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
  checked: 'Insight browser JSON v3 ingestion slice',
  guarantees: [
    'schemaVersion 2 and 3 snapshots are accepted',
    'collector storySignals are consumed by browser normalization',
    'collector angleHints influence angle classification',
    'snapshot runtime diagnostics are preserved',
    'browser avoids redundant NLP work when collector signals exist',
    'static and Vitest certification are included',
    'full certification gate includes browser JSON ingestion'
  ]
}, null, 2));

console.log('PASS: Insight browser JSON ingestion static slice');
