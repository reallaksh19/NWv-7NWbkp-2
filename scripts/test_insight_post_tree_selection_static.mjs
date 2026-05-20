import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const pipeline = read('src/insight/src/pipeline/pipeline.ts');
const unitTest = read('src/insight/src/pipeline/postTreeSelection.cert.test.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'computePostTreeQualityScore', 'postTreeQualityDiagnostics', 'visibleAngleCount',
  'singleAnglePenalty', 'weakTreePenalty', 'strongAngleBonus',
  'selectTopParentsWithWeakTreeCheck', 'strongTrees', 'weakTrees'
]) {
  assert(pipeline.includes(token), `pipeline.ts missing post-tree selection token: ${token}`);
}

for (const token of [
  'Insight post-tree selection certification',
  'multi-angle trees than single-angle thin trees',
  'selects the multi-angle parent',
  'pre-tree ranking placed it lower',
  'visibleAngleCount'
]) {
  assert(unitTest.includes(token), `postTreeSelection.cert.test.ts missing token: ${token}`);
}

assert(packageJson.includes('"test:insight-post-tree-selection"'), 'package.json must include test:insight-post-tree-selection');
assert((certGate.includes("['npm', ['run', 'test:insight-post-tree-selection']]") || certGate.includes('certification_manifest.json')), 'certification gate must run test:insight-post-tree-selection');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight post-tree quality selection slice' }, null, 2));
console.log('PASS: Insight post-tree selection static slice');
