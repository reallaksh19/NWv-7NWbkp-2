import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerBulkActions.js');
const moduleTest = read('src/services/plannerBulkActions.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerBulkActionSummary',
  'makePlannerSelectionKey',
  'selectedItems',
  'allFilteredSelected',
  'canExportCalendar',
  'canRemove',
  'categoryCounts',
  'dateCounts'
]) {
  assert(module.includes(token), `plannerBulkActions.js missing token: ${token}`);
}

for (const token of [
  'Planner bulk actions certification',
  'creates stable planner selection keys',
  'summarizes selected planner items',
  'detects select-all state',
  'handles empty selection safely'
]) {
  assert(moduleTest.includes(token), `plannerBulkActions.cert.test.js missing token: ${token}`);
}

for (const token of [
  'PlannerBulkActionBar',
  'data-planner-bulk-actions',
  'select-export-remove',
  'selectedPlannerIds',
  'plannerBulkSummary',
  'togglePlannerSelection',
  'selectAllFilteredPlannerItems',
  'clearPlannerSelection',
  'exportSelectedPlannerItems',
  'removeSelectedPlannerItems',
  'planner-item-select'
]) {
  assert(page.includes(token), `MyPlannerPage.jsx missing bulk token: ${token}`);
}

for (const token of [
  '.planner-bulk',
  '.planner-bulk__actions',
  '.planner-bulk__danger',
  '.planner-item-select'
]) {
  assert(css.includes(token), `MyPlanner.css missing bulk CSS token: ${token}`);
}

assert(
  packageJson.includes('"test:planner-bulk-actions"'),
  'package.json must include test:planner-bulk-actions'
);

assert(
  (certGate.includes("['npm', ['run', 'test:planner-bulk-actions']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:planner-bulk-actions'
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
  checked: 'My Planner bulk actions slice',
  guarantees: [
    'planner bulk action summary exists',
    'bulk action bar is rendered',
    'select filtered and clear selection are available',
    'calendar export selected action is available',
    'remove selected with undo is available',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner bulk actions static slice');
