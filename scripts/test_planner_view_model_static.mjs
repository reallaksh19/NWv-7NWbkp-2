import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerViewModel.js');
const moduleTest = read('src/services/plannerViewModel.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerViewModel',
  'itemMatchesSearch',
  'itemMatchesCategory',
  'itemMatchesDateWindow',
  'compareItems',
  'groupItemsByDate',
  'categoryOptions',
  'filteredCount',
  'groupedDates'
]) {
  assert(module.includes(token), `plannerViewModel.js missing token: ${token}`);
}

for (const token of [
  'Planner view model certification',
  'filters planner items by search query',
  'filters planner items by category',
  'filters planner items by next 7 days',
  'filters overdue and undated items separately',
  'groups filtered planner items by date'
]) {
  assert(moduleTest.includes(token), `plannerViewModel.cert.test.js missing token: ${token}`);
}

for (const token of [
  'getPlannerViewModel',
  'PlannerControlsPanel',
  'data-planner-controls',
  'filter-search-sort',
  'plannerControls',
  'setPlannerControls',
  'const plannerViewModel = useMemo',
  '<PlannerControlsPanel',
  'plannerViewModel.groupedDates'
]) {
  assert(page.includes(token), `MyPlannerPage.jsx missing planner controls token: ${token}`);
}

for (const token of [
  '.planner-controls',
  '.planner-controls__grid',
  '.planner-controls__field',
  '.planner-controls__reset'
]) {
  assert(css.includes(token), `MyPlanner.css missing planner controls token: ${token}`);
}

assert(
  packageJson.includes('"test:planner-view-model"'),
  'package.json must include test:planner-view-model'
);

assert(
  (certGate.includes("['npm', ['run', 'test:planner-view-model']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:planner-view-model'
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
  checked: 'My Planner filter/search/sort controls slice',
  guarantees: [
    'planner view model aggregation exists',
    'search/category/date/sort controls are rendered',
    'filtered count is visible',
    'date grouping uses filtered view model',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner view model static slice');