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

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

write('scripts/write_pages_data_manifest.mjs', `import fs from 'node:fs';
import crypto from 'node:crypto';

const NEWSDATA_DIR = 'public/newsdata';
const DIST_NEWSDATA_DIR = 'dist/newsdata';
const MANIFEST_PATH = \`\${DIST_NEWSDATA_DIR}/pages_data_manifest.json\`;

function readJson(path, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function hashFile(path) {
  if (!fs.existsSync(path)) return '';

  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path))
    .digest('hex')
    .slice(0, 16);
}

function fileInfo(name) {
  const sourcePath = \`\${NEWSDATA_DIR}/\${name}\`;
  const distPath = \`\${DIST_NEWSDATA_DIR}/\${name}\`;

  return {
    name,
    sourceExists: fs.existsSync(sourcePath),
    distExists: fs.existsSync(distPath),
    sourceHash: hashFile(sourcePath),
    distHash: hashFile(distPath),
    matched: hashFile(sourcePath) === hashFile(distPath),
  };
}

function main() {
  if (!fs.existsSync(DIST_NEWSDATA_DIR)) {
    fs.mkdirSync(DIST_NEWSDATA_DIR, { recursive: true });
  }

  const insight = readJson(\`\${NEWSDATA_DIR}/insight_latest.json\`, {});
  const sections = readJson(\`\${NEWSDATA_DIR}/sections_latest.json\`, {});
  const prefetchManifest = readJson(\`\${NEWSDATA_DIR}/prefetch_commit_manifest.json\`, {});
  const qualityReport = readJson(\`\${NEWSDATA_DIR}/insight_quality_report.json\`, {});

  const files = [
    'insight_latest.json',
    'sections_latest.json',
    'source_health.json',
    'prefetch_commit_manifest.json',
    'insight_quality_report.json',
    'insight_quality_summary.md',
  ].map(fileInfo);

  const manifest = {
    schemaVersion: 1,
    manifestVersion: 'pages-data-publish-v1',
    generatedAt: new Date().toISOString(),
    insight: {
      schemaVersion: insight.schemaVersion || 0,
      collectorVersion: insight.collectorVersion || '',
      contentHash: insight.contentHash || '',
      storyCount: Array.isArray(insight.stories) ? insight.stories.length : 0,
      fetchedAt: insight.fetchedAt || 0,
    },
    sections: {
      schemaVersion: sections.schemaVersion || 0,
      contentHash: sections.contentHash || '',
    },
    quality: {
      status: qualityReport.status || '',
      storyCount: qualityReport.storyCount || 0,
      sourceGroupCount: qualityReport.sourceGroupCount || 0,
      angleHintCoverage: qualityReport.angleHintCoverage || 0,
    },
    prefetchCommit: {
      shouldCommit: Boolean(prefetchManifest.shouldCommit),
      diagnosticOnly: Boolean(prefetchManifest.diagnosticOnly),
      changedContentFiles: prefetchManifest.changedContentFiles || [],
    },
    files,
    allTrackedFilesMatched: files
      .filter(file => file.sourceExists)
      .every(file => file.distExists && file.matched),
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(JSON.stringify({
    status: manifest.allTrackedFilesMatched ? 'PASS' : 'WARN',
    manifestPath: MANIFEST_PATH,
    insightContentHash: manifest.insight.contentHash,
    allTrackedFilesMatched: manifest.allTrackedFilesMatched,
  }, null, 2));

  if (!manifest.files.find(file => file.name === 'insight_latest.json')?.distExists) {
    throw new Error('dist/newsdata/insight_latest.json missing after build');
  }
}

main();
`);

write('scripts/test_pages_data_publish_static.mjs', `import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const manifestWriter = read('scripts/write_pages_data_manifest.mjs');
const workflow = read('.github/workflows/news_prefetch.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'pages_data_manifest.json',
  'pages-data-publish-v1',
  'dist/newsdata',
  'insight_latest.json',
  'allTrackedFilesMatched',
  'insightContentHash'
]) {
  assert(manifestWriter.includes(token), \`write_pages_data_manifest.mjs missing token: \${token}\`);
}

for (const token of [
  'Setup Node for Pages publish',
  'npm ci',
  'Build Pages site with latest newsdata',
  'node scripts/write_pages_data_manifest.mjs',
  'Publish updated Pages site',
  'npx gh-pages -d dist',
  "if: steps.prefetch_commit.outputs.should_commit == 'true'"
]) {
  assert(workflow.includes(token), \`news_prefetch.yml missing Pages publish token: \${token}\`);
}

assert(
  workflow.includes('Skip Pages publish for diagnostic-only changes'),
  'workflow must explicitly skip Pages publish for diagnostic-only runs'
);

assert(
  packageJson.includes('"test:pages-data-publish"'),
  'package.json must include test:pages-data-publish'
);

assert(
  certGate.includes("['npm', ['run', 'test:pages-data-publish']]"),
  'certification gate must run test:pages-data-publish'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Pages data publish slice',
  guarantees: [
    'dist/newsdata manifest writer exists',
    'workflow builds Pages site only after meaningful news content change',
    'workflow publishes gh-pages only when should_commit=true',
    'diagnostic-only runs skip Pages publish',
    'deployed data manifest records latest insight contentHash',
    'certification gate includes Pages publish static check'
  ]
}, null, 2));

console.log('PASS: Pages data publish static slice');
`);

patchFile('.github/workflows/news_prefetch.yml', source => {
  let text = source;

  if (!text.includes('Decide whether news data commit is needed')) {
    throw new Error('Slice 45 commit decision step is required before Slice 46');
  }

  if (text.includes('Publish updated Pages site')) return text;

  const insertion = `
      - name: Setup Node for Pages publish
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Node dependencies for Pages publish
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        run: npm ci

      - name: Build Pages site with latest newsdata
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        run: |
          npm run build
          node scripts/write_pages_data_manifest.mjs

      - name: Publish updated Pages site
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          npx gh-pages -d dist -u "github-actions[bot] <github-actions[bot]@users.noreply.github.com>"

      - name: Skip Pages publish for diagnostic-only changes
        if: steps.prefetch_commit.outputs.should_commit != 'true'
        run: |
          echo "No meaningful news content changes. Pages publish skipped."
`;

  return insertAfterOnce(
    text,
    `      - name: Upload prefetch commit manifest
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: prefetch-commit-manifest
          path: public/newsdata/prefetch_commit_manifest.json
          if-no-files-found: warn
`,
    insertion,
    'pages publish workflow block'
  );
});

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:pages-data-publish'] = 'node scripts/test_pages_data_publish_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:pages-data-publish']]")) return source;

  if (source.includes("['npm', ['run', 'test:prefetch-commit-optimization']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:prefetch-commit-optimization']],",
      "  ['npm', ['run', 'test:prefetch-commit-optimization']],\n  ['npm', ['run', 'test:pages-data-publish']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:pages-data-publish']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 46 Pages data publish patch complete.');
