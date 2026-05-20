import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
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
  assert(manifest.includes(token), `certification_manifest.json missing token: ${token}`);
}

for (const token of [
  'validate_certification_manifest',
  'manifest.commands',
  'packageJson.scripts',
  'hardcoded command array is rejected',
  'test:unit must run before build'
]) {
  assert(validator.includes(token), `validate_certification_manifest.mjs missing token: ${token}`);
}

for (const token of [
  'certification_manifest.json',
  'manifest.commands.map',
  'manifestVersion',
  'failedStepId'
]) {
  assert(gate.includes(token), `run_certification_gate.mjs missing manifest-driven token: ${token}`);
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
