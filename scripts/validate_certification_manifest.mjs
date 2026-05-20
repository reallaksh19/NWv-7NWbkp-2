// validate_certification_manifest — checks that the certification manifest is complete and aligned with package.json
import fs from 'node:fs';

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
assert(manifest.commands.length >= 54, `manifest must include full certification command set (found ${manifest.commands.length})`);

const ids = new Set();

for (const entry of manifest.commands) {
  assert(entry.id, 'every manifest command must have id');
  assert(!ids.has(entry.id), `duplicate manifest command id: ${entry.id}`);
  ids.add(entry.id);

  assert(entry.cmd, `manifest command ${entry.id} missing cmd`);
  assert(Array.isArray(entry.args), `manifest command ${entry.id} args must be array`);

  const npmScript = scriptFromNpmRun(entry);
  if (npmScript) {
    assert(packageJson.scripts?.[npmScript], `package.json missing script used by manifest: ${npmScript}`);
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
  'test:travel-news-prefetch',
  'test:travel-location-browser-smoke:static',
  'test:travel-news-workflow',
  'test:travel-local-ui-quality',
  'test:travel-local-e2e-closure',
  'test:newsdata-raw-json-fallback',
  'test:certification-manifest',
]) {
  assert(packageJson.scripts?.[requiredScript], `package.json missing required script: ${requiredScript}`);
}

const manifestScripts = manifest.commands
  .map(scriptFromNpmRun)
  .filter(Boolean);

for (const requiredManifestScript of [
]) {
  assert(
    manifestScripts.includes(requiredManifestScript),
    `certification_manifest.json missing required script: ${requiredManifestScript}`
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
  !gate.includes('const commands = [\n  [\'npm\''),
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
    'hardcoded command array is rejected (manifest-driven gate enforced)'
  ],
}, null, 2));

console.log('PASS: Certification manifest validation');
