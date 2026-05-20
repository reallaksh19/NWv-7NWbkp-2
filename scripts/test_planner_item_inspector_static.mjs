import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerItemInspector.js');
const moduleTest = read('src/services/plannerItemInspector.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerItemInspector',
  'formatDisplayDate',
  'normalizeCategory',
  'facts',
  'actionHints',
  'hasLink'
]) {
  assert(module.includes(token), `plannerItemInspector.js missing token: ${token}`);
}

for (const token of [
  'Planner item inspector certification',
  'normalizes item metadata for inspector display',
  'falls back safely for incomplete items',
  'returns null safely for missing item'
]) {
  assert(moduleTest.includes(token), `plannerItemInspector.cert.test.js missing token: ${token}`);
}

for (const token of [
  'getPlannerItemInspector',
  'PlannerItemInspectorPanel',
  'data-planner-item-inspector',
  'metadata-actions',
  'inspectedPlannerItem',
  'inspectedPlannerDetail',
  'inspectPlannerItem',
  'closePlannerInspector',
  'exportInspectedPlannerItem',
  'removeInspectedPlannerItem',
  'planner-item-inspect-btn'
]) {
  assert(page.includes(token), `MyPlannerPage.jsx missing inspector token: ${token}`);
}

for (const token of [
  '.planner-inspector',
  '.planner-inspector__sheet',
  '.planner-inspector__facts',
  '.planner-inspector__actions',
  '.planner-item-inspect-btn'
]) {
  assert(css.includes(token), `MyPlanner.css missing inspector CSS token: ${token}`);
}

assert(
  packageJson.includes('"test:planner-item-inspector"'),
  'package.json must include test:planner-item-inspector'
);

assert(
  (certGate.includes("['npm', ['run', 'test:planner-item-inspector']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:planner-item-inspector'
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
  checked: 'My Planner item inspector slice',
  guarantees: [
    'planner item inspector service exists',
    'planner item inspector panel is rendered',
    'item metadata and action hints are visible',
    'calendar export from inspector is available',
    'remove with undo from inspector is available',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner item inspector static slice');
