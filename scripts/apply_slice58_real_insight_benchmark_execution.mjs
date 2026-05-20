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

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};

  pkg.scripts['test:real-insight-snapshot-quality'] =
    'node scripts/test_real_insight_snapshot_quality_static.mjs && vitest run --config vitest.config.js src/insight/src/quality/insightRealSnapshotQuality.cert.test.ts';

  return `${JSON.stringify(pkg, null, 2)}\n`;
});

write('scripts/test_real_insight_benchmark_execution_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const workflow = fs.existsSync('.github/workflows/news_prefetch.yml')
  ? read('.github/workflows/news_prefetch.yml')
  : '';
const manifest = fs.existsSync('scripts/certification_manifest.json')
  ? read('scripts/certification_manifest.json')
  : '';
const validator = fs.existsSync('scripts/validate_certification_manifest.mjs')
  ? read('scripts/validate_certification_manifest.mjs')
  : '';

const script = packageJson.scripts?.['test:real-insight-snapshot-quality'] || '';

assert(
  script.includes('scripts/test_real_insight_snapshot_quality_static.mjs'),
  'test:real-insight-snapshot-quality must run static guard'
);

assert(
  script.includes('vitest run'),
  'test:real-insight-snapshot-quality must execute Vitest benchmark'
);

assert(
  script.includes('src/insight/src/quality/insightRealSnapshotQuality.cert.test.ts'),
  'test:real-insight-snapshot-quality must target real Insight snapshot Vitest file'
);

if (manifest) {
  assert(
    manifest.includes('test:real-insight-snapshot-quality'),
    'certification_manifest.json must include real snapshot benchmark command'
  );
}

if (validator) {
  assert(
    validator.includes('test:real-insight-snapshot-quality'),
    'validate_certification_manifest.mjs must require real snapshot benchmark command'
  );
}

if (workflow) {
  assert(
    workflow.includes('Upload real Insight quality benchmark report') ||
    workflow.includes('real-insight-quality-report'),
    'news_prefetch workflow must upload real Insight benchmark report artifact'
  );
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Real Insight benchmark execution slice',
  guarantees: [
    'real snapshot npm script runs static guard',
    'real snapshot npm script runs Vitest benchmark',
    'real snapshot benchmark file is targeted explicitly',
    'certification manifest includes real benchmark where present',
    'workflow artifact upload is expected where workflow exists'
  ]
}, null, 2));

console.log('PASS: Real Insight benchmark execution static slice');
`);

patchFile('.github/workflows/news_prefetch.yml', source => {
  if (!source) return source;

  if (source.includes('Upload real Insight quality benchmark report')) return source;

  if (!source.includes('Build Pages site with latest newsdata')) {
    // Workflow slices 42–57 not fully applied yet; leave workflow unchanged.
    return source;
  }

  return insertAfterOnce(
    source,
    `      - name: Build Pages site with latest newsdata
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        run: |
          npm run build
          node scripts/write_pages_data_manifest.mjs
`,
    `
      - name: Run real Insight snapshot quality benchmark
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        run: npm run test:real-insight-snapshot-quality

      - name: Upload real Insight quality benchmark report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: real-insight-quality-report
          path: |
            public/newsdata/real_insight_quality_report.json
            public/newsdata/real_insight_quality_summary.md
          if-no-files-found: warn
`,
    'real insight benchmark workflow block'
  );
});

patchFile('scripts/certification_manifest.json', source => {
  if (!source) return source;

  const manifest = JSON.parse(source);
  manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

  if (!manifest.commands.some(entry => entry.id === 'real-insight-benchmark-execution')) {
    const insertIndex = manifest.commands.findIndex(entry => entry.id === 'real-insight-snapshot-quality');
    const command = {
      id: 'real-insight-benchmark-execution',
      cmd: 'npm',
      args: ['run', 'test:real-insight-benchmark-execution'],
    };

    if (insertIndex >= 0) {
      manifest.commands.splice(insertIndex + 1, 0, command);
    } else {
      manifest.commands.push(command);
    }
  }

  return `${JSON.stringify(manifest, null, 2)}\n`;
});

patchFile('scripts/validate_certification_manifest.mjs', source => {
  if (!source) return source;
  if (source.includes('test:real-insight-benchmark-execution')) return source;

  return source.replace(
    `'test:real-insight-snapshot-quality',`,
    `'test:real-insight-snapshot-quality',
  'test:real-insight-benchmark-execution',`
  );
});

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:real-insight-benchmark-execution'] = 'node scripts/test_real_insight_benchmark_execution_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

console.log('\\nSlice 58 Real Insight benchmark execution patch complete.');
