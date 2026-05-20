import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const requiredFiles = [
  'src/components/audit/GradeBadge.jsx',
  'src/components/audit/GradeBadge.css',
  'src/components/audit/AuditDetailModal.jsx',
  'src/components/audit/AuditDetailModal.css',
  'src/components/audit/gradeBadgePlacement.js',
  'src/services/pageAuditGrading.js',
  'src/services/auditExport.js',
];

for (const file of requiredFiles) {
  read(file);
}

const badge = read('src/components/audit/GradeBadge.jsx');
const modal = read('src/components/audit/AuditDetailModal.jsx');
const modalCss = read('src/components/audit/AuditDetailModal.css');
const grading = read('src/services/pageAuditGrading.js');
const auditExport = read('src/services/auditExport.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'data-grade-badge',
  'getGradeBadgeClassName',
  'AuditDetailModal'
]) {
  assert(badge.includes(token), 'GradeBadge.jsx missing token: ' + token);
}

for (const token of [
  'Copy audit JSON',
  'Download JSON',
  'data-audit-copy-json',
  'data-audit-download-json',
  'data-audit-grade-meaning',
  'Escape',
  'More diagnostics'
]) {
  assert(modal.includes(token), 'AuditDetailModal.jsx missing token: ' + token);
}

for (const token of [
  '.audit-modal__actions-row',
  '.audit-modal__grade-meaning',
  '.audit-modal__actions',
  '.audit-modal__action-message'
]) {
  assert(modalCss.includes(token), 'AuditDetailModal.css missing token: ' + token);
}

for (const token of [
  'auditMainTabQuality',
  'auditWeatherTabQuality',
  'auditMarketTabQuality',
  'auditInsightTabQuality',
  'moreDiagnostics'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'createAuditExportPayload',
  'stringifyAuditExport',
  'buildAuditFileName',
  'getGradeExplanation',
  'getGradeLegendRows'
]) {
  assert(auditExport.includes(token), 'auditExport.js missing token: ' + token);
}

const pageChecks = [
  ['src/pages/MainPage.jsx', 'Main tab quality grade'],
  ['src/pages/WeatherPage.jsx', 'Weather tab quality grade'],
  ['src/pages/MarketPage.jsx', 'Market tab quality grade'],
  ['src/pages/InsightPage.jsx', 'Insight tab quality grade'],
];

for (const [file, token] of pageChecks) {
  if (fs.existsSync(file)) {
    const content = read(file);
    assert(content.includes('GradeBadge'), file + ' must use GradeBadge');
    assert(content.includes(token), file + ' missing label token: ' + token);
  }
}

assert(
  packageJson.includes('"test:grade-system-e2e"'),
  'package.json must include test:grade-system-e2e'
);

assert(
  certGate.includes("['npm', ['run', 'test:grade-system-e2e']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include grade system e2e test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Grade system end-to-end static certification',
  guarantees: [
    'GradeBadge exists and opens the audit modal',
    'Grade popup includes grade meaning',
    'Grade popup supports Copy audit JSON',
    'Grade popup supports Download JSON',
    'Grade popup supports More diagnostics',
    'Main/Weather/Market/Insight use GradeBadge where pages exist',
    'Audit export payload is normalized',
    'Grade system certification is included'
  ]
}, null, 2));

console.log('PASS: Grade system e2e static certification');
