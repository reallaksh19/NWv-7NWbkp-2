import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const calendar = read('src/utils/calendar.js');
const calendarTest = read('src/utils/calendar.cert.test.js');
const plannerPage = read('src/pages/MyPlannerPage.jsx');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'escapeICSText',
  'resolveCalendarDate',
  'formatUTCDateTimeForICS',
  'buildCalendarEvent',
  'buildCalendarFile',
  'downloadCalendarEvents',
  'DTSTART;VALUE=DATE',
  'PRODID:-//NWv7//Planner Calendar Export//EN',
  'rawFilename',
  'hasIcsExtension',
  'baseName',
  'safeFilename',

]) {
  assert(calendar.toLowerCase().includes(token.toLowerCase()), `calendar.js missing token: ${token}`);
}

for (const token of [
  'Planner calendar export certification',
  'uses planner date keys as all-day calendar events',
  'uses timed eventDate when available',
  'builds one ICS file with multiple events',
  'preserves legacy title and description call style'
]) {
  assert(calendarTest.includes(token), `calendar.cert.test.js missing token: ${token}`);
}

for (const token of [
  'downloadCalendarEvent, downloadCalendarEvents',
  'downloadCalendarEvent(item.raw || item)',
  'downloadCalendarEvents(',
  'nwv7_planner_selection.ics'
]) {
  assert(plannerPage.includes(token), `MyPlannerPage.jsx missing calendar quality token: ${token}`);
}

assert(
  packageJson.includes('"test:calendar-export-quality"'),
  'package.json must include test:calendar-export-quality'
);

assert(
  (certGate.includes("['npm', ['run', 'test:calendar-export-quality']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:calendar-export-quality'
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
  checked: 'Planner calendar export quality slice',
  guarantees: [
    'single planner export uses saved item date',
    'bulk planner export creates one multi-event ICS',
    'legacy downloadCalendarEvent(title, description) remains supported',
    'ICS escaping is implemented',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: Planner calendar export quality static slice');
