import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const recovery = read('src/insight/src/tree/angleDiversityRecovery.ts');
const recoveryTest = read('src/insight/src/tree/angleDiversityRecovery.cert.test.ts');
const treeTest = read('src/insight/src/tree/treeBuilderAngleRecovery.cert.test.ts');
const treeBuilder = read('src/insight/src/tree/treeBuilder.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'recoverAngleDiversity',
  'scoreAngleRecoveryCandidate',
  'TARGET_VISIBLE_ANGLE_COUNT',
  'new visible angle',
  'angle diversity recovery',
  'recoveredDiagnostics'
]) {
  assert(recovery.includes(token), `angleDiversityRecovery.ts missing token: ${token}`);
}

for (const token of [
  'Insight angle diversity recovery certification',
  'recovers missing visible angles',
  'does not recover unknown-only candidates'
]) {
  assert(recoveryTest.includes(token), `angleDiversityRecovery.cert.test.ts missing token: ${token}`);
}

for (const token of [
  'Tree builder angle recovery certification',
  'strict information gain rejects candidates',
  'angleRecovery.recoveredCount',
  'angleRecovery.afterAngleCount'
]) {
  assert(treeTest.includes(token), `treeBuilderAngleRecovery.cert.test.ts missing token: ${token}`);
}

for (const token of [
  'recoverAngleDiversity',
  'Angle diversity recovery fallback',
  'diagnostics.angleRecovery',
  'remaining.push(...angleRecovery.remaining)',
  'recordAdmittedChild(diagnostics, recovered'
]) {
  assert(treeBuilder.includes(token), `treeBuilder.ts missing angle recovery token: ${token}`);
}

assert(
  packageJson.includes('"test:insight-angle-recovery"'),
  'package.json must include test:insight-angle-recovery'
);

assert(
  (certGate.includes("['npm', ['run', 'test:insight-angle-recovery']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:insight-angle-recovery'
);

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight angle recovery fallback slice' }, null, 2));
console.log('PASS: Insight angle recovery static slice');
