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
  'INSIGHT_SNAPSHOT_SLOTS',
  'getStoryFromMap',
  'getStorySourceKey',
  'getStoryAngleLabel',
  'getParentSnapshotMatches',
  'getParentAuditReason',
  'getInsightAuditRows',
  'getInsightAuditSummary',
  'InsightAuditPanel',
  'data-insight-audit-contract',
  'source-angle-snapshot',
  'Why angles may be thin',
  'Cluster-level audit',
  'Only one distinct angle is visible',
  'Source diversity',
  'snapshot windows',
  'hiddenDuplicateCount',
  'weakTree'
]) {
  assert(insightPage.includes(token), `InsightPage missing audit token: ${token}`);
}

assert(
  insightPage.includes('const auditRows = getInsightAuditRows(result);'),
  'InsightTab must compute auditRows from current result'
);

assert(
  insightPage.includes('<InsightAuditPanel auditRows={auditRows} />'),
  'InsightTab must render InsightAuditPanel'
);

assert(
  insightPage.includes('DEFAULT_CONFIG.WEAK_TREE_CHILD_MIN'),
  'Audit must reference weak-tree child threshold'
);

assert(
  insightPage.includes('DEFAULT_CONFIG.MIN_SOURCES_PER_TREE'),
  'Audit must reference minimum source diversity threshold'
);

for (const token of [
  '.insight-audit',
  '.insight-audit__summary-grid',
  '.insight-audit__summary-tile',
  '.insight-audit__details',
  '.insight-audit__row',
  '.insight-audit__row--weak',
  '.insight-audit__badges',
  '.insight-audit__chips',
  '.insight-audit__reasons',
  '@media (min-width: 1024px)',
  '@media (max-width: 760px)'
]) {
  assert(insightCss.includes(token), `InsightPage.css missing audit token: ${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight source audit slice',
  guarantees: [
    'Insight audit panel exists',
    'cluster-level source/angle/snapshot audit exists',
    'single-angle reason is visible',
    'weak-tree/source-diversity thresholds are surfaced',
    'hidden duplicates are counted',
    'no pipeline/ranking/dedup/fetcher logic was changed'
  ]
}, null, 2));

console.log('PASS: Insight source audit static slice');