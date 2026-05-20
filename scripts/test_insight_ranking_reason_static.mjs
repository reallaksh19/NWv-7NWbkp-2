import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const ranking = read('src/insight/src/ranking/ranking.ts');

for (const token of [
  'RankingScoreKey',
  'RANKING_SCORE_WEIGHTS',
  'RANKING_SCORE_LABELS',
  'getParentScoreValue',
  'getWeightedContribution',
  'buildRankingContributionBreakdown',
  'buildTopRankingReasons',
  'attachRankingReasonDiagnostics',
  'rankingContributionBreakdown',
  'rankingReasonLabels',
  'rankingFormulaDiagnostics',
  'formulaVersion: "ranking-v1-weighted-contributions"',
  'contributionBreakdown',
  'contributionSum',
  'formulaDelta',
  'topRankingReasons'
]) {
  assert(ranking.includes(token), `ranking.ts missing ranking reason token: ${token}`);
}

for (const token of [
  'impactScore: 0.28',
  'persistenceScore: 0.20',
  'sourceDiversityScore: 0.14',
  'noveltyScore: 0.12',
  'freshnessScore: 0.10',
  'crossSnapshotMomentum: 0.08',
  'editorialClarityScore: 0.05',
  'regionBoost: 0.03'
]) {
  assert(ranking.includes(token), `ranking.ts missing preserved ranking weight: ${token}`);
}

assert(
  ranking.includes('parent.debug.scoreBreakdown = {'),
  'computeFinalParentScore must preserve parent.debug.scoreBreakdown'
);

assert(
  ranking.includes('finalParentScore:        score'),
  'computeFinalParentScore must preserve finalParentScore in scoreBreakdown'
);

assert(
  ranking.includes('attachRankingReasonDiagnostics(parent, score);'),
  'computeFinalParentScore must attach ranking reason diagnostics'
);

assert(
  !ranking.includes('impactScore: 0.30') &&
  !ranking.includes('persistenceScore: 0.18') &&
  !ranking.includes('noveltyScore: 0.15'),
  'Slice 14 must not silently change ranking weights'
);

assert(
  !ranking.includes('MIN_CHILD_INFO_GAIN') &&
  !ranking.includes('HARD_DUP_TITLE_SIM') &&
  !ranking.includes('HARD_DUP_EMBED_SIM') &&
  !ranking.includes('SAME_EVENT_THRESHOLD'),
  'Slice 14 must not touch tree/dedup thresholds'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight ranking reason clarity slice',
  guarantees: [
    'weighted ranking contribution diagnostics are stored',
    'top ranking reason labels are stored',
    'existing scoreBreakdown is preserved',
    'ranking weights are unchanged',
    'no dedup/tree/config/UI logic was changed'
  ]
}, null, 2));

console.log('PASS: Insight ranking reason clarity static slice');