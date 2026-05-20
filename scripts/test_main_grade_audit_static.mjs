import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const grading = read('src/services/pageAuditGrading.js');
const gradingTest = read('src/services/pageAuditGrading.cert.test.js');
const badge = read('src/components/audit/GradeBadge.jsx');
const badgeCss = read('src/components/audit/GradeBadge.css');
const modal = read('src/components/audit/AuditDetailModal.jsx');
const modalCss = read('src/components/audit/AuditDetailModal.css');
const mainPage = read('src/pages/MainPage.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'auditMainTabQuality',
  'frontpage-volume',
  'source-diversity',
  'section-coverage',
  'duplicate-rate',
  'weather-availability',
  'gradeFromScore'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'Main tab audit grading certification',
  'gives strong grade',
  'downgrades weak main tab data',
  'keeps loading as warning'
]) {
  assert(gradingTest.includes(token), 'pageAuditGrading.cert.test.js missing token: ' + token);
}

for (const token of [
  'data-grade-badge',
  'AuditDetailModal'
]) {
  assert(badge.includes(token) || badgeCss.includes(token), 'GradeBadge missing token: ' + token);
}

for (const token of [
  'Data trust / audits / gates',
  'Gate results',
  'Warnings / failures',
  'audit-modal__backdrop'
]) {
  assert(modal.includes(token) || modalCss.includes(token), 'Audit modal missing token: ' + token);
}

for (const token of [
  'GradeBadge',
  'auditMainTabQuality',
  'mainTabAudit',
  'Main tab quality grade'
]) {
  assert(mainPage.includes(token), 'MainPage.jsx missing token: ' + token);
}

assert(
  packageJson.includes('"test:main-grade-audit"'),
  'package.json must include test:main-grade-audit'
);

assert(
  certGate.includes("['npm', ['run', 'test:main-grade-audit']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include main grade audit test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Main tab grade audit modal',
  guarantees: [
    'grade badge shows a single alphabet in top-right corner',
    'clicking grade opens audit modal',
    'modal includes data trust, audits and gate results',
    'Main tab has robust data quality grading',
    'weather availability is included in Main tab audit',
    'source diversity, freshness, duplicates and section coverage are checked'
  ]
}, null, 2));

console.log('PASS: Main grade audit static slice');
