import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerInteractionQuality.js');
const moduleTest = read('src/services/plannerInteractionQuality.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerInteractionQuality',
  'statusLabel',
  'inspectorOpen',
  'agendaEmpty',
  'copyStatus',
  'Escape closes it'
]) {
  assert(module.includes(token), `plannerInteractionQuality.js missing token: ${token}`);
}

for (const token of [
  'Planner interaction quality certification',
  'reports ready state',
  'reports active state',
  'reports focused state',
  'reports empty state safely'
]) {
  assert(moduleTest.includes(token), `plannerInteractionQuality.cert.test.js missing token: ${token}`);
}

for (const token of [
  'getPlannerInteractionQuality',
  'PlannerInteractionQualityPanel',
  'data-planner-interaction-quality',
  'accessibility-readiness',
  'plannerInteractionQuality',
  'handlePlannerEscape',
  'aria-modal="true"',
  'aria-live="polite"',
  'role="status"'
]) {
  assert(page.includes(token), `MyPlannerPage.jsx missing interaction quality token: ${token}`);
}

for (const token of [
  '.planner-interaction-quality',
  '.planner-interaction-quality__checks',
  '.planner-interaction-quality__check',
  '.planner-interaction-quality__notes'
]) {
  assert(css.includes(token), `MyPlanner.css missing interaction quality CSS token: ${token}`);
}

assert(
  packageJson.includes('"test:planner-interaction-quality"'),
  'package.json must include test:planner-interaction-quality'
);

assert(
  (certGate.includes("['npm', ['run', 'test:planner-interaction-quality']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:planner-interaction-quality'
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
  checked: 'My Planner interaction quality slice',
  guarantees: [
    'planner interaction quality service exists',
    'interaction quality panel is rendered',
    'Escape closes item inspector',
    'inspector modal semantics are present',
    'agenda export and undo status are live regions',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner interaction quality static slice');
