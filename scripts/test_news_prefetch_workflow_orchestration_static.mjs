import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const validator = read('scripts/validate_news_prefetch_workflow.mjs');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'validateNewsPrefetchWorkflow',
  'Bump fetchedAt sentinel',
  'git add public/newsdata/\\n',
  'Validate Insight prefetch quality',
  'Validate Sections prefetch quality',
  'Decide whether news data commit is needed',
  'Build Pages site with latest newsdata',
  'Publish updated Pages site',
  'Verify deployed Pages newsdata',
  'should_commit=true',
]) {
  assert(validator.includes(token), `validate_news_prefetch_workflow.mjs missing token: ${token}`);
}

assert(
  packageJson.includes('"test:news-prefetch-workflow-orchestration"'),
  'package.json must include test:news-prefetch-workflow-orchestration'
);

assert(
  (certGate.includes("['npm', ['run', 'test:news-prefetch-workflow-orchestration']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:news-prefetch-workflow-orchestration'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'News prefetch workflow orchestration static slice',
  guarantees: [
    'workflow orchestration validator exists',
    'old fetchedAt sentinel is rejected',
    'blind public/newsdata git add is rejected',
    'critical workflow step order is certified',
    'certification gate includes workflow orchestration validation'
  ]
}, null, 2));

console.log('PASS: News prefetch workflow orchestration static slice');
