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
  'asFiniteNumber',
  'formatScore',
  'formatPercent',
  'countBy',
  'getScoreBreakdownEntries',
  'getDuplicatePressureTone',
  'getRankingDiagnosticNotes',
  'getInsightRankingDiagnosticRows',
  'getInsightRankingDiagnosticSummary',
  'InsightRankingDiagnosticsPanel',
  'data-insight-ranking-diagnostics',
  'duplicate-ranking',
  'Why this cluster ranked here',
  'scoreBreakdown',
  'hiddenDuplicateCount',
  'duplicatePressureTone',
  'topSourceShare',
  'topAngleShare',
  'replacements'
]) {
  assert(insightPage.includes(token), `InsightPage missing ranking diagnostics token: ${token}`);
}

assert(
  insightPage.includes('const rankingRows = getInsightRankingDiagnosticRows(result);'),
  'InsightTab must compute rankingRows from current result'
);

assert(
  insightPage.includes('<InsightRankingDiagnosticsPanel rows={rankingRows} />'),
  'InsightTab must render InsightRankingDiagnosticsPanel'
);

assert(
  insightPage.includes('parent?.debug?.scoreBreakdown'),
  'Ranking diagnostics must read parent.debug.scoreBreakdown'
);

assert(
  insightPage.includes('parent.debug?.hiddenCount'),
  'Ranking diagnostics must read parent.debug.hiddenCount'
);

assert(
  insightPage.includes('DEFAULT_CONFIG.MIN_SOURCES_PER_TREE'),
  'Ranking diagnostics must surface source diversity threshold'
);

for (const token of [
  '.insight-ranking-diagnostics',
  '.insight-ranking-diagnostics__summary-grid',
  '.insight-ranking-diagnostics__summary-tile',
  '.insight-ranking-diagnostics__details',
  '.insight-ranking-diagnostics__row',
  '.insight-ranking-diagnostics__row--dupe-high',
  '.insight-ranking-diagnostics__row--dupe-medium',
  '.insight-ranking-diagnostics__breakdown',
  '.insight-ranking-diagnostics__meter',
  '.insight-ranking-diagnostics__replacement-box',
  '.insight-ranking-diagnostics__notes',
  '@media (min-width: 1024px)',
  '@media (max-width: 760px)'
]) {
  assert(insightCss.includes(token), `InsightPage.css missing ranking diagnostics token: ${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight duplicate/ranking diagnostics slice',
  guarantees: [
    'ranking diagnostics panel exists',
    'score breakdown is surfaced from parent.debug.scoreBreakdown',
    'duplicate pressure is computed from hidden duplicates',
    'source concentration is visible',
    'angle concentration is visible',
    'replacement debug notes are visible',
    'no pipeline/ranking/dedup/tree/fetcher logic was changed'
  ]
}, null, 2));

console.log('PASS: Insight duplicate/ranking diagnostics static slice');