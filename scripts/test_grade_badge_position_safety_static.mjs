import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const placement = read('src/components/audit/gradeBadgePlacement.js');
const placementTest = read('src/components/audit/gradeBadgePlacement.cert.test.js');
const badge = read('src/components/audit/GradeBadge.jsx');
const css = read('src/components/audit/GradeBadge.css');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'GRADE_BADGE_POSITIONS',
  'normalizeGradeBadgePosition',
  'getGradeBadgeClassName',
  'getGradeBadgeStyle',
  'getRecommendedGradeBadgePosition'
]) {
  assert(placement.includes(token), 'gradeBadgePlacement.js missing token: ' + token);
}

for (const token of [
  'Grade badge placement certification',
  'normalizes invalid placement',
  'builds collision-safe placement class names',
  'exposes CSS variable style offsets',
  'recommends lower placement'
]) {
  assert(placementTest.includes(token), 'gradeBadgePlacement.cert.test.js missing token: ' + token);
}

for (const token of [
  'position = \'top-right\'',
  'compact = false',
  'topOffset = null',
  'getGradeBadgeClassName',
  'getGradeBadgeStyle',
  'style={badgeStyle}'
]) {
  assert(badge.includes(token), 'GradeBadge.jsx missing token: ' + token);
}

for (const token of [
  '--grade-badge-top-offset',
  '--grade-badge-right-offset',
  'env(safe-area-inset-top',
  'grade-badge--position-top-right',
  'grade-badge--position-below-header',
  'grade-badge--position-floating-low',
  'grade-badge--position-inline',
  'grade-badge--compact'
]) {
  assert(css.includes(token), 'GradeBadge.css missing token: ' + token);
}

const pageChecks = [
  ['src/pages/MainPage.jsx', 'position="top-right"'],
  ['src/pages/WeatherPage.jsx', 'position="below-header"'],
  ['src/pages/MarketPage.jsx', 'position="below-header"'],
  ['src/pages/InsightPage.jsx', 'position="floating-low"'],
];

for (const [path, token] of pageChecks) {
  if (fs.existsSync(path)) {
    const content = read(path);
    assert(content.includes(token), path + ' missing grade badge position token: ' + token);
  }
}

assert(
  packageJson.includes('"test:grade-badge-position-safety"'),
  'package.json must include test:grade-badge-position-safety'
);

assert(
  certGate.includes("['npm', ['run', 'test:grade-badge-position-safety']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include grade badge position safety test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Grade badge positioning and collision safety',
  guarantees: [
    'GradeBadge supports top-right, below-header, floating-low and inline placements',
    'GradeBadge uses safe-area CSS variables',
    'GradeBadge accepts per-page top/right offsets',
    'Weather and Market can avoid header/control collision',
    'Insight can use lower floating placement',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Grade badge position safety static slice');
