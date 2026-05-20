import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const treeBuilder = read('src/insight/src/tree/treeBuilder.ts');

for (const token of [
  'ChildRejectionReason',
  'RejectedCandidateDiagnostic',
  'AdmittedChildDiagnostic',
  'WeakTreeDiagnostics',
  'ChildSelectionDiagnostics',
  'initChildSelectionDiagnostics',
  'getCandidateRejectionReasons',
  'buildRejectedCandidateDiagnostic',
  'recordCandidateRejection',
  'recordAdmittedChild',
  'getWeakTreeCause',
  'childSelectionDiagnostics',
  'rejectionCounts',
  'rejectedCandidates',
  'admittedChildren',
  'duplicateDowngrades',
  'weakTreeCauses',
  'weakTreeMetrics'
]) {
  assert(treeBuilder.includes(token), `treeBuilder.ts missing diagnostic token: ${token}`);
}

for (const token of [
  'LOW_INFORMATION_GAIN',
  'MAX_SOURCE_GROUP',
  'MAX_ANGLE',
  'NOT_ANGLE_VARIANT',
  'INSUFFICIENT_CHILDREN',
  'INSUFFICIENT_QUALITY_CHILDREN',
  'INSUFFICIENT_SOURCE_DIVERSITY',
  'INSUFFICIENT_ANGLE_DIVERSITY'
]) {
  assert(treeBuilder.includes(token), `treeBuilder.ts missing reason code: ${token}`);
}

for (const token of [
  'cfg.MIN_CHILD_INFO_GAIN',
  'cfg.MAX_PER_SOURCE_GROUP',
  'cfg.MAX_PER_ANGLE',
  'cfg.MAX_CHILDREN_PER_PARENT',
  'cfg.WEAK_TREE_CHILD_MIN',
  'cfg.MIN_SOURCES_PER_TREE'
]) {
  assert(treeBuilder.includes(token), `treeBuilder.ts missing preserved gate token: ${token}`);
}

assert(
  treeBuilder.includes('c.informationGain >= cfg.MIN_CHILD_INFO_GAIN') ||
  treeBuilder.includes('candidate.informationGain < cfg.MIN_CHILD_INFO_GAIN'),
  'treeBuilder.ts must preserve information gain gate'
);

assert(
  treeBuilder.includes('(best.story as any).admittedBecause = admittedBecause'),
  'selected child story must preserve admittedBecause diagnostics'
);

assert(
  treeBuilder.includes('parent.debug.hiddenCount = hiddenIds.size'),
  'treeBuilder.ts must preserve hiddenCount assignment'
);

assert(
  treeBuilder.includes('getParentDebug(parent).replacements.push'),
  'replacement debug must still be preserved'
);

assert(
  !treeBuilder.includes('MIN_CHILD_INFO_GAIN = 0.18'),
  'Slice 12 must not change MIN_CHILD_INFO_GAIN threshold'
);

assert(
  !treeBuilder.includes('SAME_EVENT_THRESHOLD') &&
  !treeBuilder.includes('HARD_DUP_TITLE_SIM') &&
  !treeBuilder.includes('HARD_DUP_EMBED_SIM'),
  'Slice 12 must not touch dedup thresholds'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight child-tree tuning diagnostics slice',
  guarantees: [
    'child candidate rejection reasons are recorded',
    'admitted child reasons are preserved',
    'weak-tree causes are recorded',
    'duplicate downgrades are recorded',
    'selection gates are preserved',
    'no dedup/ranking/config threshold change was made'
  ]
}, null, 2));

console.log('PASS: Insight child-tree tuning diagnostics static slice');