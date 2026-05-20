import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/'); if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

write('scripts/validate_news_prefetch_workflow.mjs', `import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/news_prefetch.yml';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

function indexOfStep(workflow, stepName) {
  const token = \`- name: \${stepName}\`;
  return workflow.indexOf(token);
}

function requireStep(workflow, stepName) {
  const index = indexOfStep(workflow, stepName);
  assert(index >= 0, \`Missing workflow step: \${stepName}\`);
  return index;
}

function requireOrder(workflow, beforeStep, afterStep) {
  const before = requireStep(workflow, beforeStep);
  const after = requireStep(workflow, afterStep);

  assert(
    before < after,
    \`Workflow order invalid: "\${beforeStep}" must appear before "\${afterStep}"\`
  );
}

function rejectToken(workflow, token, reason) {
  assert(!workflow.includes(token), reason);
}

function requireToken(workflow, token, reason) {
  assert(workflow.includes(token), reason);
}

function validateNewsPrefetchWorkflow(workflow) {
  requireToken(workflow, 'concurrency:', 'workflow must use concurrency guard');
  requireToken(workflow, 'group: news-prefetch', 'workflow concurrency group must be news-prefetch');
  requireToken(workflow, 'contents: write', 'workflow needs contents: write for data commits and gh-pages publish');

  rejectToken(
    workflow,
    'Bump fetchedAt sentinel',
    'workflow must not mutate fetchedAt just to force commits'
  );

  rejectToken(
    workflow,
    'git add public/newsdata/\\n',
    'workflow must not blindly add all public/newsdata files'
  );

  requireStep(workflow, 'Fetch Insight stories');
  requireStep(workflow, 'Validate Insight prefetch quality');
  requireStep(workflow, 'Fetch Sections stories');
  requireStep(workflow, 'Validate Sections prefetch quality');
  requireStep(workflow, 'Decide whether news data commit is needed');
  requireStep(workflow, 'Commit data');
  requireStep(workflow, 'Build Pages site with latest newsdata');
  requireStep(workflow, 'Publish updated Pages site');
  requireStep(workflow, 'Verify deployed Pages newsdata');

  requireOrder(workflow, 'Fetch Insight stories', 'Validate Insight prefetch quality');
  requireOrder(workflow, 'Fetch Sections stories', 'Validate Sections prefetch quality');
  requireOrder(workflow, 'Validate Insight prefetch quality', 'Decide whether news data commit is needed');
  requireOrder(workflow, 'Validate Sections prefetch quality', 'Decide whether news data commit is needed');
  requireOrder(workflow, 'Decide whether news data commit is needed', 'Commit data');
  requireOrder(workflow, 'Decide whether news data commit is needed', 'Build Pages site with latest newsdata');
  requireOrder(workflow, 'Build Pages site with latest newsdata', 'Publish updated Pages site');
  requireOrder(workflow, 'Publish updated Pages site', 'Verify deployed Pages newsdata');

  for (const step of [
    'Commit data',
    'Setup Node for Pages publish',
    'Install Node dependencies for Pages publish',
    'Build Pages site with latest newsdata',
    'Publish updated Pages site',
    'Verify deployed Pages newsdata',
  ]) {
    const stepIndex = requireStep(workflow, step);
    const nextStepIndex = workflow.indexOf('\\n      - name:', stepIndex + 1);
    const block = nextStepIndex > stepIndex
      ? workflow.slice(stepIndex, nextStepIndex)
      : workflow.slice(stepIndex);

    assert(
      block.includes("if: steps.prefetch_commit.outputs.should_commit == 'true'"),
      \`\${step} must be conditional on should_commit=true\`
    );
  }

  for (const token of [
    'python scripts/validate_insight_prefetch_output.py',
    'python scripts/validate_sections_prefetch_output.py',
    'python scripts/prefetch_commit_decision.py',
    'node scripts/write_pages_data_manifest.mjs',
    'npx gh-pages -d dist',
    'node scripts/verify_pages_newsdata.mjs',
    'insight-quality-report',
    'sections-quality-report',
    'prefetch-commit-manifest',
    'pages-newsdata-verification',
  ]) {
    requireToken(workflow, token, \`workflow missing required command/artifact token: \${token}\`);
  }

  requireToken(
    workflow,
    'public/newsdata/insight_latest.json public/newsdata/sections_latest.json public/newsdata/source_health.json public/newsdata/prefetch_commit_manifest.json',
    'commit step must stage only meaningful content files plus commit manifest'
  );

  requireToken(
    workflow,
    'Skip commit for diagnostic-only changes',
    'workflow must explicitly skip commits for diagnostic-only changes'
  );

  requireToken(
    workflow,
    'Skip Pages publish for diagnostic-only changes',
    'workflow must explicitly skip Pages publish for diagnostic-only changes'
  );

  return {
    status: 'PASS',
    checked: 'News prefetch workflow orchestration',
    guarantees: [
      'concurrency guard exists',
      'fetchedAt-only sentinel is rejected',
      'blind public/newsdata git add is rejected',
      'Insight quality validation runs after Insight fetch',
      'Sections quality validation runs after Sections fetch',
      'commit decision runs after all quality validators',
      'commit/build/publish/verify are gated by should_commit=true',
      'Pages verification runs after gh-pages publish',
      'required quality and deployment artifacts are uploaded',
    ],
  };
}

const workflow = read(WORKFLOW_PATH);
const result = validateNewsPrefetchWorkflow(workflow);

console.log(JSON.stringify(result, null, 2));
console.log('PASS: News prefetch workflow orchestration');
`);

write('scripts/test_news_prefetch_workflow_orchestration_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const validator = read('scripts/validate_news_prefetch_workflow.mjs');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'validateNewsPrefetchWorkflow',
  'Bump fetchedAt sentinel',
  'git add public/newsdata/\\\\n',
  'Validate Insight prefetch quality',
  'Validate Sections prefetch quality',
  'Decide whether news data commit is needed',
  'Build Pages site with latest newsdata',
  'Publish updated Pages site',
  'Verify deployed Pages newsdata',
  'should_commit=true',
]) {
  assert(validator.includes(token), \`validate_news_prefetch_workflow.mjs missing token: \${token}\`);
}

assert(
  packageJson.includes('"test:news-prefetch-workflow-orchestration"'),
  'package.json must include test:news-prefetch-workflow-orchestration'
);

assert(
  certGate.includes("['npm', ['run', 'test:news-prefetch-workflow-orchestration']]"),
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
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:news-prefetch-workflow-orchestration'] = 'node scripts/test_news_prefetch_workflow_orchestration_static.mjs && node scripts/validate_news_prefetch_workflow.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:news-prefetch-workflow-orchestration']]")) return source;

  if (source.includes("['npm', ['run', 'test:newsdata-runtime-status']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:newsdata-runtime-status']],",
      "  ['npm', ['run', 'test:newsdata-runtime-status']],\n  ['npm', ['run', 'test:news-prefetch-workflow-orchestration']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:news-prefetch-workflow-orchestration']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 54 News prefetch workflow orchestration patch complete.');
