import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) return '';
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

const commands = [
  ['lint', ['npm', ['run', 'lint']]],
  ['lint-hotfix', ['npm', ['run', 'test:lint-hotfix']]],
  ['quick-weather-pro', ['npm', ['run', 'test:quick-weather-pro']]],
  ['bottom-nav', ['npm', ['run', 'test:bottom-nav']]],
  ['market-trust', ['npm', ['run', 'test:market-trust']]],
  ['weather-trust', ['npm', ['run', 'test:weather-trust']]],
  ['following', ['npm', ['run', 'test:following']]],
  ['desktop-polish', ['npm', ['run', 'test:desktop-polish']]],

  ['insight-foundation', ['npm', ['run', 'test:insight-foundation']]],
  ['insight-audit', ['npm', ['run', 'test:insight-audit']]],
  ['insight-angle-display', ['npm', ['run', 'test:insight-angle-display']]],
  ['insight-ranking-diagnostics', ['npm', ['run', 'test:insight-ranking-diagnostics']]],
  ['insight-behavior-plan', ['npm', ['run', 'test:insight-behavior-plan']]],
  ['insight-tree-tuning', ['npm', ['run', 'test:insight-tree-tuning']]],
  ['insight-duplicate-diagnostics', ['npm', ['run', 'test:insight-duplicate-diagnostics']]],
  ['insight-ranking-reason', ['npm', ['run', 'test:insight-ranking-reason']]],
  ['insight-diversity-tuning', ['npm', ['run', 'test:insight-diversity-tuning']]],
  ['insight-top-story-anchor', ['npm', ['run', 'test:insight-top-story-anchor']]],
  ['insight-useful-variant-rescue', ['npm', ['run', 'test:insight-useful-variant-rescue']]],
  ['insight-angle-classifier-enrichment', ['npm', ['run', 'test:insight-angle-classifier-enrichment']]],
  ['insight-core-recovery', ['npm', ['run', 'test:insight-core-recovery']]],
  ['insight-angle-recovery', ['npm', ['run', 'test:insight-angle-recovery']]],
  ['insight-cluster-cohesion', ['npm', ['run', 'test:insight-cluster-cohesion']]],
  ['insight-cache-contract', ['npm', ['run', 'test:insight-cache-contract']]],
  ['insight-post-tree-selection', ['npm', ['run', 'test:insight-post-tree-selection']]],
  ['insight-runtime-quality-gate', ['npm', ['run', 'test:insight-runtime-quality-gate']]],
  ['insight-snapshot-intake', ['npm', ['run', 'test:insight-snapshot-intake']]],
  ['insight-nlp-enrichment', ['npm', ['run', 'test:insight-nlp-enrichment']]],
  ['insight-e2e-quality', ['npm', ['run', 'test:insight-e2e-quality']]],
  ['insight-collector-json', ['npm', ['run', 'test:insight-collector-json']]],
  ['insight-browser-json-ingestion', ['npm', ['run', 'test:insight-browser-json-ingestion']]],
  ['insight-prefetch-quality-gate', ['npm', ['run', 'test:insight-prefetch-quality-gate']]],
  ['prefetch-commit-optimization', ['npm', ['run', 'test:prefetch-commit-optimization']]],
  ['pages-data-publish', ['npm', ['run', 'test:pages-data-publish']]],
  ['pages-newsdata-verification', ['npm', ['run', 'test:pages-newsdata-verification']]],
  ['insight-source-policy', ['npm', ['run', 'test:insight-source-policy']]],
  ['insight-adaptive-source-health', ['npm', ['run', 'test:insight-adaptive-source-health']]],
  ['sections-source-policy', ['npm', ['run', 'test:sections-source-policy']]],
  ['sections-browser-ingestion', ['npm', ['run', 'test:sections-browser-ingestion']]],
  ['sections-quality-deploy', ['npm', ['run', 'test:sections-quality-deploy']]],
  ['newsdata-runtime-status', ['npm', ['run', 'test:newsdata-runtime-status']]],
  ['news-prefetch-workflow-orchestration', ['npm', ['run', 'test:news-prefetch-workflow-orchestration']]],
  ['newsdata-raw-json-fallback', ['npm', ['run', 'test:newsdata-raw-json-fallback']]],
  ['certification-manifest', ['npm', ['run', 'test:certification-manifest']]],

  ['insight-cluster-anchor', ['npm', ['run', 'test:insight-cluster-anchor']]],
  ['insight-24h-concept', ['npm', ['run', 'test:insight-24h-concept']]],
  ['insight-behavior-evidence', ['npm', ['run', 'test:insight-behavior-evidence']]],
  ['upahead-evidence', ['npm', ['run', 'test:upahead-evidence']]],
  ['upahead-briefing', ['npm', ['run', 'test:upahead-briefing']]],
  ['planner-evidence', ['npm', ['run', 'test:planner-evidence']]],
  ['planner-view-model', ['npm', ['run', 'test:planner-view-model']]],
  ['planner-bulk-actions', ['npm', ['run', 'test:planner-bulk-actions']]],
  ['calendar-export-quality', ['npm', ['run', 'test:calendar-export-quality']]],
  ['planner-item-inspector', ['npm', ['run', 'test:planner-item-inspector']]],
  ['planner-agenda-export', ['npm', ['run', 'test:planner-agenda-export']]],
  ['planner-interaction-quality', ['npm', ['run', 'test:planner-interaction-quality']]],
  ['planner-state-hygiene', ['npm', ['run', 'test:planner-state-hygiene']]],

  ['unit', ['npm', ['run', 'test:unit']]],
  ['build', ['npm', ['run', 'build']]],
];

write('scripts/certification_manifest.json', `${JSON.stringify({
  schemaVersion: 1,
  manifestVersion: 'nw-certification-manifest-v1',
  description: 'Single source of truth for npm run test:certify command order.',
  commands: commands.map(([id, [cmd, args]]) => ({
    id,
    cmd,
    args,
  })),
}, null, 2)}\n`);

write('scripts/run_certification_gate.mjs', `import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const manifestPath = new URL('./certification_manifest.json', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
  throw new Error('certification_manifest.json has no commands[]');
}

const commands = manifest.commands.map(entry => {
  if (!entry.id || !entry.cmd || !Array.isArray(entry.args)) {
    throw new Error(\`Invalid certification manifest entry: \${JSON.stringify(entry)}\`);
  }

  return [entry.id, entry.cmd, entry.args];
});

const results = [];

for (const [id, cmd, args] of commands) {
  const label = \`\${cmd} \${args.join(' ')}\`;

  console.log(\`\\n\\nCERTIFICATION STEP [\${id}]: \${label}\`);
  console.log('='.repeat(80));

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const ok = result.status === 0;

  results.push({
    id,
    command: label,
    status: ok ? 'PASS' : 'FAIL',
    exitCode: result.status,
  });

  if (!ok) {
    console.error(\`\\nCERTIFICATION FAILED [\${id}]: \${label}\`);
    console.error(JSON.stringify({
      status: 'FAIL',
      failedStepId: id,
      failedCommand: label,
      manifestVersion: manifest.manifestVersion,
      results,
    }, null, 2));
    process.exit(result.status || 1);
  }
}

console.log('\\n\\nCERTIFICATION RESULT');
console.log('='.repeat(80));
console.log(JSON.stringify({
  status: 'PASS',
  checked: 'NWv-7 full certification gate',
  manifestVersion: manifest.manifestVersion,
  commandCount: commands.length,
  results,
}, null, 2));

console.log('PASS: Full certification gate');
`);

write('scripts/validate_certification_manifest.mjs', `import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('scripts/certification_manifest.json', 'utf8'));
const gate = fs.readFileSync('scripts/run_certification_gate.mjs', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scriptFromNpmRun(entry) {
  if (entry.cmd !== 'npm') return null;
  if (!Array.isArray(entry.args)) return null;
  if (entry.args[0] !== 'run') return null;
  return entry.args[1] || null;
}

assert(manifest.schemaVersion === 1, 'manifest schemaVersion must be 1');
assert(manifest.manifestVersion === 'nw-certification-manifest-v1', 'unexpected manifestVersion');
assert(Array.isArray(manifest.commands), 'manifest.commands must be an array');
assert(manifest.commands.length >= 60, 'manifest must include full certification command set');

const ids = new Set();

for (const entry of manifest.commands) {
  assert(entry.id, 'every manifest command must have id');
  assert(!ids.has(entry.id), \`duplicate manifest command id: \${entry.id}\`);
  ids.add(entry.id);

  assert(entry.cmd, \`manifest command \${entry.id} missing cmd\`);
  assert(Array.isArray(entry.args), \`manifest command \${entry.id} args must be array\`);

  const npmScript = scriptFromNpmRun(entry);
  if (npmScript) {
    assert(packageJson.scripts?.[npmScript], \`package.json missing script used by manifest: \${npmScript}\`);
  }
}

for (const requiredScript of [
  'lint',
  'test:unit',
  'build',
  'test:certify',
  'test:insight-collector-json',
  'test:insight-browser-json-ingestion',
  'test:insight-prefetch-quality-gate',
  'test:prefetch-commit-optimization',
  'test:pages-data-publish',
  'test:pages-newsdata-verification',
  'test:insight-source-policy',
  'test:insight-adaptive-source-health',
  'test:sections-source-policy',
  'test:sections-browser-ingestion',
  'test:sections-quality-deploy',
  'test:newsdata-runtime-status',
  'test:news-prefetch-workflow-orchestration',
  'test:newsdata-raw-json-fallback',
  'test:certification-manifest',
]) {
  assert(packageJson.scripts?.[requiredScript], \`package.json missing required script: \${requiredScript}\`);
}

const manifestScripts = manifest.commands
  .map(scriptFromNpmRun)
  .filter(Boolean);

for (const requiredManifestScript of [
  'lint',
  'test:insight-e2e-quality',
  'test:insight-collector-json',
  'test:insight-browser-json-ingestion',
  'test:insight-prefetch-quality-gate',
  'test:prefetch-commit-optimization',
  'test:pages-data-publish',
  'test:pages-newsdata-verification',
  'test:insight-source-policy',
  'test:insight-adaptive-source-health',
  'test:sections-source-policy',
  'test:sections-browser-ingestion',
  'test:sections-quality-deploy',
  'test:newsdata-runtime-status',
  'test:news-prefetch-workflow-orchestration',
  'test:newsdata-raw-json-fallback',
  'test:certification-manifest',
  'test:unit',
  'build',
]) {
  assert(
    manifestScripts.includes(requiredManifestScript),
    \`certification_manifest.json missing required script: \${requiredManifestScript}\`
  );
}

assert(
  gate.includes('certification_manifest.json'),
  'run_certification_gate.mjs must load certification_manifest.json'
);

assert(
  gate.includes('manifest.commands.map'),
  'run_certification_gate.mjs must execute manifest.commands'
);

assert(
  !gate.includes('const commands = [\\n  [\\'npm\\''),
  'run_certification_gate.mjs must not return to hardcoded command array'
);

const buildIndex = manifestScripts.indexOf('build');
const unitIndex = manifestScripts.indexOf('test:unit');
assert(unitIndex >= 0 && buildIndex >= 0 && unitIndex < buildIndex, 'test:unit must run before build');

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Certification manifest alignment',
  manifestVersion: manifest.manifestVersion,
  commandCount: manifest.commands.length,
  guarantees: [
    'run_certification_gate is manifest-driven',
    'all manifest npm scripts exist in package.json',
    'all newsdata/workflow scripts are included in certification',
    'unit tests run before build',
    'hardcoded certification command array is rejected'
  ],
}, null, 2));

console.log('PASS: Certification manifest validation');
`);

write('scripts/test_certification_manifest_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const manifest = read('scripts/certification_manifest.json');
const validator = read('scripts/validate_certification_manifest.mjs');
const gate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'nw-certification-manifest-v1',
  'test:insight-collector-json',
  'test:insight-browser-json-ingestion',
  'test:insight-prefetch-quality-gate',
  'test:prefetch-commit-optimization',
  'test:pages-data-publish',
  'test:pages-newsdata-verification',
  'test:sections-quality-deploy',
  'test:newsdata-runtime-status',
  'test:newsdata-raw-json-fallback'
]) {
  assert(manifest.includes(token), \`certification_manifest.json missing token: \${token}\`);
}

for (const token of [
  'validate_certification_manifest',
  'manifest.commands',
  'packageJson.scripts',
  'hardcoded command array is rejected',
  'test:unit must run before build'
]) {
  assert(validator.includes(token), \`validate_certification_manifest.mjs missing token: \${token}\`);
}

for (const token of [
  'certification_manifest.json',
  'manifest.commands.map',
  'manifestVersion',
  'failedStepId'
]) {
  assert(gate.includes(token), \`run_certification_gate.mjs missing manifest-driven token: \${token}\`);
}

assert(
  packageJson.includes('"test:certification-manifest"'),
  'package.json must include test:certification-manifest'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Certification manifest static slice',
  guarantees: [
    'certification manifest exists',
    'certification gate is manifest-driven',
    'manifest validator exists',
    'newsdata/workflow gates are represented in manifest',
    'package.json exposes test:certification-manifest'
  ],
}, null, 2));

console.log('PASS: Certification manifest static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:certification-manifest'] = 'node scripts/test_certification_manifest_static.mjs && node scripts/validate_certification_manifest.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

console.log('\\nSlice 56 Certification manifest patch complete.');
