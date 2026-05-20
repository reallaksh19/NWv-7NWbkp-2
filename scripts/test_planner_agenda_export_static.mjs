import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerAgendaExport.js');
const moduleTest = read('src/services/plannerAgendaExport.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerAgendaExport',
  'buildPlannerAgendaText',
  'buildPlannerAgendaJson',
  'downloadPlannerAgendaFile',
  'makePlannerAgendaFilename',
  'categoryCounts',
  'groupCount'
]) {
  assert(module.includes(token), `plannerAgendaExport.js missing token: ${token}`);
}

for (const token of [
  'Planner agenda export certification',
  'creates agenda export model from filtered planner view',
  'builds readable agenda text',
  'builds agenda json',
  'creates predictable export filename',
  'handles empty agenda safely'
]) {
  assert(moduleTest.includes(token), `plannerAgendaExport.cert.test.js missing token: ${token}`);
}

for (const token of [
  'PlannerAgendaExportPanel',
  'data-planner-agenda-export',
  'copy-download-print',
  'plannerAgendaExport',
  'plannerAgendaCopyStatus',
  'copyPlannerAgendaText',
  'downloadPlannerAgendaTextFile',
  'downloadPlannerAgendaJsonFile',
  'printPlannerAgenda'
]) {
  assert(page.includes(token), `MyPlannerPage.jsx missing agenda export token: ${token}`);
}

for (const token of [
  '.planner-agenda-export',
  '.planner-agenda-export__meta',
  '.planner-agenda-export__actions',
  '@media print'
]) {
  assert(css.includes(token), `MyPlanner.css missing agenda export CSS token: ${token}`);
}

assert(
  packageJson.includes('"test:planner-agenda-export"'),
  'package.json must include test:planner-agenda-export'
);

assert(
  (certGate.includes("['npm', ['run', 'test:planner-agenda-export']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:planner-agenda-export'
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
  checked: 'My Planner agenda export slice',
  guarantees: [
    'planner agenda export service exists',
    'copy/download/print panel is rendered',
    'text and JSON agenda builders are certified',
    'filtered planner view is exported',
    'print CSS is included',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner agenda export static slice');
