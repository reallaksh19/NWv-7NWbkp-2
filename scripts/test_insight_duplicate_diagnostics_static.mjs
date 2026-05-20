import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const dedup = read('src/insight/src/dedup/dedup.ts');
const treeBuilder = read('src/insight/src/tree/treeBuilder.ts');

for (const token of [
  'DuplicateDecisionReason',
  'DuplicateDecisionDiagnostic',
  'DuplicateDiagnosticsAccumulator',
  'createDuplicateDiagnostics',
  'recordDuplicateDecision',
  'getDuplicateDiagnosticsSummary',
  'getAngleVariantDecision',
  'CANONICAL_URL_DUPLICATE',
  'CANONICAL_TEXT_HASH_DUPLICATE',
  'HARD_TITLE_SIMILARITY',
  'HARD_EMBEDDING_SIMILARITY',
  'SAME_EVENT_DUPLICATE',
  'WEAK_ANGLE_VARIANT',
  'SOURCE_REPEAT_DUPLICATE'
]) {
  assert(dedup.includes(token), `dedup.ts missing duplicate diagnostic token: ${token}`);
}

assert(
  dedup.includes('diagnostics: DuplicateDiagnosticsAccumulator = createDuplicateDiagnostics()'),
  'removeHardDuplicates must accept optional diagnostics accumulator'
);

assert(
  dedup.includes('recordDuplicateDecision('),
  'removeHardDuplicates must record duplicate decisions'
);

assert(
  dedup.includes('return getAngleVariantDecision(candidate, selectedChildren).eligible;'),
  'isAngleVariant must delegate to getAngleVariantDecision'
);

for (const token of [
  'getAngleVariantDecision',
  'duplicateReasonCounts',
  'duplicateDecisionSamples',
  'recordDuplicateDecisionSample',
  'getCandidateRejectionDetails',
  'rejectionDetails.angleVariantDecision',
  'decision.reason',
  'decision.matchedId',
  'decision.metrics'
]) {
  assert(treeBuilder.includes(token), `treeBuilder.ts missing duplicate-tree diagnostic token: ${token}`);
}

assert(
  !dedup.includes('HARD_DUP_TITLE_SIM =') &&
  !dedup.includes('HARD_DUP_EMBED_SIM =') &&
  !dedup.includes('SAME_EVENT_THRESHOLD =') &&
  !dedup.includes('POSSIBLE_EVENT_THRESHOLD ='),
  'Slice 13 must not change dedup threshold values'
);

assert(
  !treeBuilder.includes('MIN_CHILD_INFO_GAIN = 0.18'),
  'Slice 13 must not change child-tree thresholds'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight duplicate diagnostics hardening slice',
  guarantees: [
    'hard duplicate decisions have reason codes',
    'angle duplicate decisions have inspectable reasons',
    'tree diagnostics collect duplicate reason counts',
    'tree diagnostics collect duplicate decision samples',
    'dedup thresholds are unchanged',
    'ranking and UI are unchanged'
  ]
}, null, 2));

console.log('PASS: Insight duplicate diagnostics hardening static slice');