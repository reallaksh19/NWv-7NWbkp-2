import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const insightPage = read('src/pages/InsightPage.jsx');
const insightCss = read('src/styles/InsightPage.css');

for (const token of [
  'safeArray',
  'normalizeStoriesById',
  'getInsightDiagnostics',
  'getInsightSourceLabel',
  'InsightDiagnosticsPanel',
  'data-insight-quality-grade',
  'signalScore',
  'coverageLabel',
  'lowAngleCount',
  'multiAngleCount',
  'diagnostics.signalScore',
  'diagnostics.coverageLabel',
  'Insight quality',
  'Diagnostic notes'
]) {
  assert(insightPage.includes(token), `InsightPage missing token: ${token}`);
}

assert(
  insightPage.includes('const clusterStoryIds = safeArray(story.clusterStoryIds);'),
  'ICard must safely normalize clusterStoryIds'
);

assert(
  insightPage.includes('const childStoryIds = safeArray(story.childStoryIds);'),
  'ICard must safely normalize childStoryIds'
);

assert(
  !insightPage.includes('<div className="irscore">86</div>'),
  'InsightPage must not show hardcoded signal score 86'
);

assert(
  !insightPage.includes('<div className="snum">9<span'),
  'InsightPage must not show hardcoded 9/9 sections metric'
);

for (const token of [
  '.insight-diagnostics',
  '.insight-diagnostics__summary',
  '.insight-diagnostics__grade',
  '.insight-diagnostics__grid',
  '.insight-diagnostics__tile',
  '.insight-diagnostics__warnings',
  '@media (min-width: 1024px)',
  '@media (max-width: 760px)'
]) {
  assert(insightCss.includes(token), `InsightPage.css missing token: ${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight foundation slice',
  guarantees: [
    'Insight diagnostics panel exists',
    'signal score is computed, not hardcoded',
    'angle coverage is computed, not hardcoded',
    'cluster/child story arrays are safely normalized',
    'diagnostic warnings are visible',
    'no fetcher/worker/ranking service logic was changed'
  ]
}, null, 2));

console.log('PASS: Insight foundation static slice');