import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

const moduleFormatConciseDate = `
function formatConciseDate(dateStr) {
    if (!dateStr) return 'Coming Soon';

    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;

    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleDateString('en-US', { month: 'short' });

    return \`\${dayName}, \${dayNum} \${month}\`;
}
`;

// 1) Fix UpAheadPage formatConciseDate no-undef.
// UpAheadBriefingPanel is module-scope, so formatConciseDate must also be module-scope.
patchFile('src/pages/UpAheadPage.jsx', source => {
  let text = source;

  // Remove inner function inside UpAheadPage.
  text = text.replace(
    /\n {4}const formatConciseDate = \(dateStr\) => \{\n[\s\S]*?\n {4}\};\n(?=\n {4}const GridSection)/,
    '\n'
  );
  // also handle standard function version if present
  text = text.replace(
    /\nfunction formatConciseDate\(dateStr\) \{\n[\s\S]*?\n\}\n(?=\nfunction UpAheadEvidencePanel)/,
    '\n'
  );

  // Add module-scope function if not already present.
  if (!text.includes('function formatConciseDate(dateStr)')) {
    const anchors = [
      'function UpAheadEvidencePanel',
      'function UpAheadBriefingPanel',
      'function UpAheadPage()'
    ];

    const anchor = anchors.find(token => text.includes(token));
    if (!anchor) {
      throw new Error('Could not find insertion anchor in UpAheadPage.jsx');
    }

    text = text.replace(anchor, `${moduleFormatConciseDate}\n${anchor}`);
  }

  // Remove any unused hook disable that ESLint can now validate normally.
  text = text.replace(/^\s*\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\s*\n/gm, '');

  return text;
});

// 2) Fix unused unique helper in upAheadEvidence.
patchFile('src/services/upAheadEvidence.js', source => {
  return source.replace(
    /\nfunction unique\(values\) \{\n  return \[\.\.\.new Set\(values\.filter\(Boolean\)\)\];\n\}\n/g,
    '\n'
  );
});

// 3) Remove unused no-unused-vars disable directives in MainPage only.
// Do not remove global eslint-disable comments.
patchFile('src/pages/MainPage.jsx', source => {
  let text = source;

  text = text.replace(/^\s*\/\/ eslint-disable-next-line no-unused-vars\s*\n/gm, '');
  text = text.replace(/\s*\/\/ eslint-disable-line no-unused-vars\s*$/gm, '');
  text = text.replace(/^\/\*\s*eslint-disable\s+no-unused-vars\s*\*\/\s*\n/gm, '');

  return text;
});

// 4) Add static hotfix certification.
const lintHotfixTest = `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
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
  certGate.includes("['npm', ['run', 'lint']]"),
  'certification gate must run npm run lint'
);

assert(
  certGate.includes("['npm', ['run', 'test:lint-hotfix']]"),
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
`;

write('scripts/test_lint_hotfix_static.mjs', lintHotfixTest);

// 5) Add package script.
patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:lint-hotfix'] = 'node scripts/test_lint_hotfix_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

// 6) Make npm run test:certify include lint and this hotfix test.
patchFile('scripts/run_certification_gate.mjs', source => {
  let text = source;

  if (!text.includes("['npm', ['run', 'lint']]")) {
    text = text.replace(
      'const commands = [\n',
      "const commands = [\n  ['npm', ['run', 'lint']],\n"
    );
  }

  if (!text.includes("['npm', ['run', 'test:lint-hotfix']]")) {
    if (text.includes("['npm', ['run', 'lint']],")) {
      text = text.replace(
        "['npm', ['run', 'lint']],",
        "['npm', ['run', 'lint']],\n  ['npm', ['run', 'test:lint-hotfix']],"
      );
    } else {
      text = text.replace(
        'const commands = [\n',
        "const commands = [\n  ['npm', ['run', 'test:lint-hotfix']],\n"
      );
    }
  }

  return text;
});

console.log('\\nSlice 24A lint hotfix patch complete.');
