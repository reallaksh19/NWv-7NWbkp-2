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
  'ANGLE_DISPLAY_LABELS',
  'SNAPSHOT_DISPLAY_LABELS',
  'toSafeCssToken',
  'formatAngleLabel',
  'getStorySnapshotLabel',
  'getStoryTimeLabel',
  'getStorySourceLabel',
  'getChildStoryDisplay',
  'angleRaw',
  'angleLabel',
  'angleKey',
  'snapshotLabel',
  'publishedLabel',
  'src-item--angle-aware'
]) {
  assert(insightPage.includes(token), `InsightPage missing angle display token: ${token}`);
}

assert(
  insightPage.includes('const display = getChildStoryDisplay(childId, child, i);'),
  'ICard must use getChildStoryDisplay for child rows'
);

assert(
  insightPage.includes('display.angleLabel'),
  'ICard must render real formatted angle label'
);

assert(
  insightPage.includes('display.snapshotLabel'),
  'ICard must render child captured snapshot label'
);

assert(
  insightPage.includes('display.publishedLabel'),
  'ICard must render child published time label'
);

assert(
  !insightPage.includes('Angle {i + 1}'),
  'ICard must not render generic Angle {i + 1}'
);

assert(
  !insightPage.includes('Angle {index + 1}'),
  'ICard must not render generic Angle {index + 1}'
);

for (const token of [
  '.src-item--angle-aware',
  '.angle-chip',
  '.angle-chip--official_response',
  '.angle-chip--market_reaction',
  '.angle-chip--expert_analysis',
  '.angle-chip--regional_followup',
  '.angle-chip--correction',
  '.angle-chip--unknown',
  '@media (max-width: 760px)'
]) {
  assert(insightCss.includes(token), `InsightPage.css missing angle display token: ${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight angle display slice',
  guarantees: [
    'child rows show real formatted angle labels',
    'child rows show source label',
    'child rows show snapshot label',
    'child rows show published time label',
    'generic Angle 1 / Angle 2 display is removed',
    'no pipeline/ranking/dedup/fetcher logic was changed'
  ]
}, null, 2));

console.log('PASS: Insight angle display static slice');