import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const plan = read('docs/INSIGHT_BEHAVIOR_TUNING_PLAN.md');

for (const token of [
  'Slice:** 11',
  'Production behavior changed:** No',
  'Current Insight problem statement',
  'Current relevant contracts',
  'Required diagnostic review before behavior tuning',
  'Behavior tuning sequence',
  'Slice 12 — Insight child-tree tuning only',
  'Slice 13 — Insight duplicate diagnostics hardening only',
  'Slice 14 — Insight ranking reason clarity only',
  'Slice 15 — First actual behavior tuning',
  'Explicit non-goals',
  'Review checklist before Slice 12',
  'Mandatory checkpoint report for executing agent'
]) {
  assert(plan.includes(token), `Insight behavior plan missing token: ${token}`);
}

for (const token of [
  'MIN_CHILD_INFO_GAIN',
  'MAX_PER_SOURCE_GROUP',
  'MAX_PER_ANGLE',
  'MIN_SOURCES_PER_TREE',
  'WEAK_TREE_CHILD_MIN',
  'SAME_EVENT_THRESHOLD',
  'POSSIBLE_EVENT_THRESHOLD',
  'parent.debug.scoreBreakdown',
  'parent.debug.hiddenCount',
  'parent.debug.replacements',
  'capturedAtSnapshot'
]) {
  assert(plan.includes(token), `Insight behavior plan missing contract/config token: ${token}`);
}

for (const token of [
  'Do not change DEFAULT_CONFIG',
  'Do not change dedup thresholds',
  'Do not change ranking weights',
  'Do not change child tree selection',
  'Do not change source fetching',
  'Do not claim behavior is improved until real diagnostics prove it'
]) {
  assert(plan.includes(token), `Insight behavior plan missing non-goal: ${token}`);
}

assert(
  plan.includes('One behavior change only.'),
  'Plan must require one behavior change only for first actual tuning'
);

assert(
  plan.includes('CHECKPOINT RESULT:'),
  'Plan must include mandatory checkpoint result format'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight behavior tuning plan slice',
  guarantees: [
    'plan-only slice exists',
    'no production behavior change is prescribed for Slice 11',
    'dedup/ranking/tree tuning is split into safe future slices',
    'diagnostics review is required before behavior changes',
    'mandatory checkpoint report is embedded for executing agents'
  ]
}, null, 2));

console.log('PASS: Insight behavior tuning plan static slice');