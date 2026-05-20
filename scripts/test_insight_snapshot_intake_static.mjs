import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const intake = read('src/adapters/insightSnapshotIntake.js');
const intakeTest = read('src/adapters/insightSnapshotIntake.cert.test.js');
const fetcher = read('src/adapters/insightSnapshotFetcher.js');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'normalizeSnapshotStory', 'getSnapshotPoolHealth', 'selectSnapshotStoriesForSlot',
  'getSnapshotIntakeSummary', 'minStoriesPerSlot', 'fallbackReason', '_snapshotIntake'
]) {
  assert(intake.includes(token), `insightSnapshotIntake.js missing token: ${token}`);
}

for (const token of [
  'Insight snapshot intake recovery certification',
  'normalizes snapshot stories', 'fills thin now slot', 'reports pool health'
]) {
  assert(intakeTest.includes(token), `insightSnapshotIntake.cert.test.js missing token: ${token}`);
}

for (const token of [
  'selectSnapshotStoriesForSlot', 'getSnapshotIntakeSummary',
  '_snapshotIntakeSummary', 'minStoriesPerSlot: 12', 'maxStoriesPerSlot: 40'
]) {
  assert(fetcher.includes(token), `insightSnapshotFetcher.js missing intake token: ${token}`);
}

assert(!fetcher.includes('slice(0, 12)'), 'insightSnapshotFetcher.js must not keep old now-only slice(0, 12) fallback');

assert(packageJson.includes('"test:insight-snapshot-intake"'), 'package.json must include test:insight-snapshot-intake');
assert((certGate.includes("['npm', ['run', 'test:insight-snapshot-intake']]") || certGate.includes('certification_manifest.json')), 'certification gate must run test:insight-snapshot-intake');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight snapshot intake recovery slice' }, null, 2));
console.log('PASS: Insight snapshot intake static slice');
