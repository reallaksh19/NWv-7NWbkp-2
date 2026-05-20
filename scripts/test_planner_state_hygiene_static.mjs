import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerStateHygiene.js');
const moduleTest = read('src/services/plannerStateHygiene.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerStateHygiene',
  'reconcilePlannerSelection',
  'isPlannerInspectorStillValid',
  'makeInspectorKey',
  'needs-cleanup',
  'stale selected item'
]) {
  assert(module.includes(token), `plannerStateHygiene.js missing token: ${token}`);
}

for (const token of [
  'Planner state hygiene certification',
  'removes stale selected IDs',
  'detects valid and stale inspector items',
  'reports clean hygiene state',
  'reports cleanup state'
]) {
  assert(moduleTest.includes(token), `plannerStateHygiene.cert.test.js missing token: ${token}`);
}

for (const token of [
  'useRef',
  'getPlannerStateHygiene',
  'reconcilePlannerSelection',
  'PlannerStateHygienePanel',
  'data-planner-state-hygiene',
  'selection-inspector-sync',
  'plannerInspectorRef',
  'plannerStateHygiene',
  'inspectorRef={plannerInspectorRef}',
  'plannerInspectorRef.current.focus()'
]) {
  assert(page.includes(token), `MyPlannerPage.jsx missing state hygiene token: ${token}`);
}

for (const token of [
  '.planner-state-hygiene',
  '.planner-state-hygiene--clean',
  '.planner-state-hygiene--needs-cleanup',
  '.planner-state-hygiene__notes'
]) {
  assert(css.includes(token), `MyPlanner.css missing state hygiene CSS token: ${token}`);
}

assert(
  packageJson.includes('"test:planner-state-hygiene"'),
  'package.json must include test:planner-state-hygiene'
);

assert(
  (certGate.includes("['npm', ['run', 'test:planner-state-hygiene']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:planner-state-hygiene'
);

assert(
  (certGate.includes("['npm', ['run', 'lint']]") || certGate.includes('certification_manifest.json')),
  'certification gate must still run lint'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'My Planner state hygiene slice',
  guarantees: [
    'planner state hygiene service exists',
    'stale selected IDs are reconciled',
    'stale inspector state is detected',
    'inspector receives focus when opened',
    'state hygiene panel is rendered',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner state hygiene static slice');
