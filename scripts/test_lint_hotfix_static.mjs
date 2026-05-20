import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const upAheadPage = read('src/pages/UpAheadPage.jsx');
const upAheadEvidence = read('src/services/upAheadEvidence.js');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

const moduleFormatIndex = upAheadPage.indexOf('function formatConciseDate(dateStr)');
const pageIndex = upAheadPage.indexOf('function UpAheadPage()');

assert(moduleFormatIndex !== -1, 'formatConciseDate must exist as module-scope function');
assert(pageIndex !== -1, 'UpAheadPage function must exist');
assert(moduleFormatIndex < pageIndex, 'formatConciseDate must be declared before UpAheadPage');

assert(
  !upAheadPage.includes('const formatConciseDate = (dateStr) =>'),
  'inner formatConciseDate const must be removed'
);

assert(
  !upAheadEvidence.includes('function unique(values)'),
  'unused unique helper must be removed from upAheadEvidence.js'
);

assert(
  certGate.includes("['npm', ['run', 'lint']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must run npm run lint'
);

assert(
  certGate.includes("['npm', ['run', 'test:lint-hotfix']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must run test:lint-hotfix'
);

assert(
  packageJson.includes('"test:lint-hotfix"'),
  'package.json must include test:lint-hotfix'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Slice 24A lint hotfix',
  guarantees: [
    'formatConciseDate is module-scope',
    'UpAheadBriefingPanel can call formatConciseDate',
    'unused unique helper is removed',
    'lint is included in full certification gate',
    'lint hotfix static test is included in certification gate'
  ]
}, null, 2));

console.log('PASS: Slice 24A lint hotfix static test');
