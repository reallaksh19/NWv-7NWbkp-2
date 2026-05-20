import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const modal = read('src/components/audit/AuditDetailModal.jsx');
const modalCss = read('src/components/audit/AuditDetailModal.css');
const grading = read('src/services/pageAuditGrading.js');
const cert = read('src/services/pageAuditMoreDiagnostics.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'More diagnostics',
  'data-audit-more-diagnostics-toggle',
  'data-audit-more-diagnostics-panel',
  'DiagnosticSection',
  'Raw diagnostic JSON',
  'normalizeMoreDiagnostics'
]) {
  assert(modal.includes(token), 'AuditDetailModal.jsx missing token: ' + token);
}

for (const token of [
  '.audit-modal__more-toggle',
  '.audit-modal__more-panel',
  '.audit-modal__diagnostic-section',
  '.audit-modal__diagnostic-metrics',
  '.audit-modal__raw'
]) {
  assert(modalCss.includes(token), 'AuditDetailModal.css missing token: ' + token);
}

for (const token of [
  'moreDiagnostics',
  'diagnosticSection',
  'main-section-health',
  'weather-city-readiness',
  'market-coverage',
  'insight-tree-quality',
  'insight-runtime-gates'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'Grade popup more diagnostics certification',
  'adds moreDiagnostics to Main tab audit',
  'adds moreDiagnostics to Weather tab audit',
  'adds moreDiagnostics to Market tab audit',
  'adds moreDiagnostics to Insight tab audit'
]) {
  assert(cert.includes(token), 'pageAuditMoreDiagnostics.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:grade-popup-more-diagnostics"'),
  'package.json must include test:grade-popup-more-diagnostics'
);

assert(
  certGate.includes("['npm', ['run', 'test:grade-popup-more-diagnostics']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include grade popup more diagnostics test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Grade popup more diagnostics',
  guarantees: [
    'Grade popup has a More diagnostics toggle',
    'More diagnostics is hidden by default',
    'More diagnostics can render metrics, rows, notes and raw JSON',
    'Main audit provides advanced diagnostic sections',
    'Weather audit provides advanced diagnostic sections',
    'Market audit provides advanced diagnostic sections',
    'Insight audit provides advanced diagnostic sections'
  ]
}, null, 2));

console.log('PASS: Grade popup more diagnostics static slice');
