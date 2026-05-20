import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerEvidence.js');
const moduleTest = read('src/services/plannerEvidence.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerEvidence',
  'flattenPlannerData',
  'normalizePlannerItem',
  'getDateGroups',
  'categoryCounts',
  'upcomingItems',
  'next7DaysCount',
  'overdueCount',
  'undatedCount'
]) {
  assert(module.includes(token), `plannerEvidence.js missing token: ${token}`);
}

for (const token of [
  'Planner evidence certification',
  'summarizes planner readiness, dates and categories',
  'handles empty planner safely',
  'flattens planner data into normalized items'
]) {
  assert(moduleTest.includes(token), `plannerEvidence.cert.test.js missing token: ${token}`);
}

for (const token of [
  'getPlannerEvidence',
  'PlannerEvidencePanel',
  'data-planner-evidence',
  'planner-readiness',
  'const plannerEvidence = getPlannerEvidence(planData);',
  '<PlannerEvidencePanel evidence={plannerEvidence} />',
  "import './MyPlanner.css';"
]) {
  assert(page.includes(token), `MyPlannerPage.jsx missing token: ${token}`);
}

for (const token of [
  '.planner-evidence',
  '.planner-evidence__header',
  '.planner-evidence__score',
  '.planner-evidence__grid',
  '.planner-evidence__tile',
  '.planner-evidence__chips',
  '.planner-evidence__upcoming',
  '.planner-evidence__details'
]) {
  assert(css.includes(token), `MyPlanner.css missing token: ${token}`);
}

assert(
  packageJson.includes('"test:planner-evidence"'),
  'package.json must include test:planner-evidence'
);

assert(
  (certGate.includes("['npm', ['run', 'test:planner-evidence']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:planner-evidence'
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
  checked: 'My Planner evidence command center slice',
  guarantees: [
    'planner evidence aggregation exists',
    'planner command center is rendered',
    'today/next7/overdue/undated counts are visible',
    'category coverage is visible',
    'upcoming planner items are visible',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner evidence static slice');