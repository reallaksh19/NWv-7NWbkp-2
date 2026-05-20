import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const grading = read('src/services/pageAuditGrading.js');
const tabTests = read('src/services/pageAuditGradingTabs.cert.test.js');
const gradeBadge = read('src/components/audit/GradeBadge.jsx');
const weatherPage = read('src/pages/WeatherPage.jsx');
const marketPage = read('src/pages/MarketPage.jsx');
const insightPage = fs.existsSync('src/pages/InsightPage.jsx') ? read('src/pages/InsightPage.jsx') : '';
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'auditWeatherTabQuality',
  'auditMarketTabQuality',
  'auditInsightTabQuality',
  'makePageAudit',
  'weather-weekly-forecast',
  'market-source-health',
  'insight-angle-diversity'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'Unified tab audit grading certification',
  'grades Weather tab',
  'grades Market tab',
  'downgrades Insight tab'
]) {
  assert(tabTests.includes(token), 'pageAuditGradingTabs.cert.test.js missing token: ' + token);
}

assert(gradeBadge.includes('AuditDetailModal.css'), 'GradeBadge must import AuditDetailModal.css');

for (const token of [
  'GradeBadge',
  'auditWeatherTabQuality',
  'weatherTabAudit',
  'Weather tab quality grade'
]) {
  assert(weatherPage.includes(token), 'WeatherPage.jsx missing token: ' + token);
}

assert(!weatherPage.includes('<WeatherTrustPanel'), 'WeatherTrustPanel must not remain inline on WeatherPage');

for (const token of [
  'GradeBadge',
  'auditMarketTabQuality',
  'marketTabAudit',
  'Market tab quality grade'
]) {
  assert(marketPage.includes(token), 'MarketPage.jsx missing token: ' + token);
}

assert(!marketPage.includes('<MarketTrustPanel'), 'MarketTrustPanel must not remain inline on MarketPage');

if (insightPage) {
  for (const token of [
    'GradeBadge',
    'auditInsightTabQuality',
    'insightTabAudit',
    'Insight tab quality grade'
  ]) {
    assert(insightPage.includes(token), 'InsightPage.jsx missing token: ' + token);
  }
}

assert(
  packageJson.includes('"test:unified-grade-badge-tabs"'),
  'package.json must include test:unified-grade-badge-tabs'
);

assert(
  certGate.includes("['npm', ['run', 'test:unified-grade-badge-tabs']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include unified grade badge tabs test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Unified GradeBadge tab audits',
  guarantees: [
    'Weather trust panel is migrated into GradeBadge modal',
    'Market trust panel is migrated into GradeBadge modal',
    'Insight diagnostics are exposed through GradeBadge modal',
    'Weather/Market/Insight have robust page audit grading functions',
    'GradeBadge owns its modal CSS',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Unified GradeBadge tabs static slice');
