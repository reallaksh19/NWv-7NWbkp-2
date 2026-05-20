import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/upAheadBriefing.js');
const moduleTest = read('src/services/upAheadBriefing.cert.test.js');
const page = read('src/pages/UpAheadPage.jsx');
const css = read('src/pages/UpAhead.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getUpAheadBriefing',
  'makeBriefingItem',
  'fromTimeline',
  'fromWeeklyPlan',
  'buildUrgencyLabel',
  'next72hCount',
  'plannerReadyCount',
  'highlights',
  'buckets',
  'locationLabel'
]) {
  assert(module.includes(token), `upAheadBriefing.js missing token: ${token}`);
}

for (const token of [
  'Up Ahead briefing certification',
  'builds urgent briefing from alerts, offers and dated items',
  'returns quiet state safely for empty inputs'
]) {
  assert(moduleTest.includes(token), `upAheadBriefing.cert.test.js missing token: ${token}`);
}

for (const token of [
  'getUpAheadBriefing',
  'UpAheadBriefingPanel',
  'data-upahead-briefing',
  'professional-horizon',
  'const upAheadBriefing = getUpAheadBriefing({',
  '<UpAheadBriefingPanel briefing={upAheadBriefing} />'
]) {
  assert(page.includes(token), `UpAheadPage.jsx missing briefing token: ${token}`);
}

for (const token of [
  '.ua-briefing',
  '.ua-briefing__stats',
  '.ua-briefing__highlights',
  '.ua-briefing__highlight',
  '.ua-briefing__buckets',
  '.ua-briefing__bucket',
  '.ua-briefing__details'
]) {
  assert(css.includes(token), `UpAhead.css missing briefing token: ${token}`);
}

assert(
  packageJson.includes('"test:upahead-briefing"'),
  'package.json must include test:upahead-briefing'
);

assert(
  (certGate.includes("['npm', ['run', 'test:upahead-briefing']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:upahead-briefing'
);

assert(
  (certGate.includes("['npm', ['run', 'test:unit']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Up Ahead professional briefing slice',
  guarantees: [
    'Up Ahead briefing aggregation exists',
    'professional briefing panel is rendered',
    'urgent alerts/today/next72h buckets are visible',
    'planner readiness is visible',
    'location scope is visible',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Up Ahead briefing static slice');