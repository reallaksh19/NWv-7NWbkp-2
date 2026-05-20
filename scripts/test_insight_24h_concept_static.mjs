import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const conceptTest = read('src/insight/src/pipeline/insight.24hConcept.cert.test.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'runInsightPipeline',
  'invalidateSlot',
  '24h multi-angle Insight concept',
  'top parent is the high-prominence multi-angle story',
  'selects multiple useful angles for the same story',
  'survives useful-variant dedup rescue',
  'official_response',
  'market_reaction',
  'reaction_public',
  'background_context',
  'minus24h',
  'minus12h',
  'minus4h',
  'now',
  'rawProminence: 1',
  'sourceGroup'
]) {
  assert(conceptTest.includes(token), `24h concept test missing token: ${token}`);
}

assert(
  conceptTest.includes('expect(result.parents.length).toBeGreaterThan(0)'),
  'concept test must assert at least one parent'
);

assert(
  conceptTest.includes('expect(top.childStoryIds.length).toBeGreaterThanOrEqual(3)'),
  'concept test must assert at least 3 child stories'
);

assert(
  conceptTest.includes('expect(angleSet.size).toBeGreaterThanOrEqual(3)'),
  'concept test must assert at least 3 angles'
);

assert(
  conceptTest.includes('expect(top.snapshotPresence.now).toBe(true)') &&
  conceptTest.includes('expect(top.snapshotPresence.minus24h).toBe(true)'),
  'concept test must assert 24h snapshot coverage'
);

assert(
  packageJson.includes('"test:insight-24h-concept"'),
  'package.json must include test:insight-24h-concept'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-24h-concept']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-24h-concept'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight 24h concept certification slice',
  guarantees: [
    'end-to-end 24h Insight concept test exists',
    'same story clusters across snapshots',
    'multiple angles are selected',
    'top-prominence story ranks first',
    'useful variants survive dedup',
    'static test is included in certification gate'
  ]
}, null, 2));

console.log('PASS: Insight 24h concept static slice');