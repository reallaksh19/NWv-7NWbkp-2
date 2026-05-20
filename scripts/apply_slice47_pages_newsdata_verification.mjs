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

write('scripts/verify_pages_newsdata.mjs', `import fs from 'node:fs';

const DEFAULT_REPORT_JSON = 'public/newsdata/pages_newsdata_verify_report.json';
const DEFAULT_REPORT_MD = 'public/newsdata/pages_newsdata_verify_summary.md';

function readJson(path, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(path, data) {
  const dir = path.split('/').slice(0, -1).join('/'); if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

function writeMarkdown(path, report) {
  const lines = [
    '# Pages Newsdata Verification',
    '',
    \`- Status: **\${report.status}**\`,
    \`- URL: \\\`\${report.url}\\\`\`,
    \`- Expected contentHash: \\\`\${report.expected?.contentHash || ''}\\\`\`,
    \`- Deployed contentHash: \\\`\${report.deployed?.contentHash || ''}\\\`\`,
    \`- Expected schema: \\\`\${report.expected?.schemaVersion || 0}\\\`\`,
    \`- Deployed schema: \\\`\${report.deployed?.schemaVersion || 0}\\\`\`,
    \`- Expected stories: \\\`\${report.expected?.storyCount || 0}\\\`\`,
    \`- Deployed stories: \\\`\${report.deployed?.storyCount || 0}\\\`\`,
    \`- Attempts: \\\`\${report.attempts}\\\`\`,
    '',
    '## Checks',
    '',
    \`- Fetch OK: \\\`\${report.checks.fetchOk}\\\`\`,
    \`- Schema OK: \\\`\${report.checks.schemaOk}\\\`\`,
    \`- Content hash OK: \\\`\${report.checks.contentHashOk}\\\`\`,
    \`- Story count OK: \\\`\${report.checks.storyCountOk}\\\`\`,
  ];

  if (report.errors.length) {
    lines.push('', '## Errors', '');
    for (const error of report.errors) lines.push(\`- \${error}\`);
  }

  const dir = path.split('/').slice(0, -1).join('/'); if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, \`\${lines.join('\n')}\\n\`, 'utf8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeHomepage(homepage) {
  return String(homepage || '').replace(/\\/$/, '');
}

function getDefaultPagesBaseUrl() {
  const pkg = readJson('package.json', {});
  const homepage = normalizeHomepage(pkg.homepage);
  if (homepage) return homepage;

  const repo = process.env.GITHUB_REPOSITORY || '';
  const [owner, name] = repo.split('/');
  if (owner && name) return \`https://\${owner}.github.io/\${name}\`;

  return '';
}

function parseArgs(argv) {
  const args = {
    baseUrl: '',
    expectedPath: 'public/newsdata/insight_latest.json',
    retries: 8,
    delayMs: 15000,
    reportJson: DEFAULT_REPORT_JSON,
    reportMd: DEFAULT_REPORT_MD,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--url' || arg === '--base-url') {
      args.baseUrl = next || '';
      index += 1;
    } else if (arg === '--expected') {
      args.expectedPath = next || args.expectedPath;
      index += 1;
    } else if (arg === '--retries') {
      args.retries = Number(next || args.retries);
      index += 1;
    } else if (arg === '--delay-ms') {
      args.delayMs = Number(next || args.delayMs);
      index += 1;
    } else if (arg === '--report-json') {
      args.reportJson = next || args.reportJson;
      index += 1;
    } else if (arg === '--report-md') {
      args.reportMd = next || args.reportMd;
      index += 1;
    }
  }

  if (!args.baseUrl) args.baseUrl = getDefaultPagesBaseUrl();

  return args;
}

function summarizeInsightSnapshot(snapshot) {
  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    collectorVersion: snapshot?.collectorVersion || '',
    contentHash: snapshot?.contentHash || '',
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    storyCount: Array.isArray(snapshot?.stories) ? snapshot.stories.length : 0,
    sourceGroupCount: Number(snapshot?.sourceDiversity?.sourceGroupCount || 0),
    hasSlotQuality: Boolean(snapshot?.slotQuality),
    hasAngleHints: Array.isArray(snapshot?.stories) &&
      snapshot.stories.some(story => Array.isArray(story?.angleHints) && story.angleHints.length > 0),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(\`HTTP \${response.status} while fetching \${url}\`);
  }

  return response.json();
}

function makeReport({
  status,
  url,
  expected,
  deployed,
  attempts,
  errors,
}) {
  const checks = {
    fetchOk: Boolean(deployed),
    schemaOk: Boolean(deployed && deployed.schemaVersion === expected.schemaVersion),
    contentHashOk: Boolean(deployed && deployed.contentHash && deployed.contentHash === expected.contentHash),
    storyCountOk: Boolean(deployed && deployed.storyCount === expected.storyCount),
  };

  return {
    status,
    generatedAt: new Date().toISOString(),
    verifierVersion: 'pages-newsdata-verifier-v1',
    url,
    attempts,
    expected,
    deployed,
    checks,
    errors,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const expectedRaw = readJson(args.expectedPath, null);

  if (!expectedRaw) {
    const report = makeReport({
      status: 'FAIL',
      url: '',
      expected: null,
      deployed: null,
      attempts: 0,
      errors: [\`Missing or invalid expected JSON: \${args.expectedPath}\`],
    });

    writeJson(args.reportJson, report);
    writeMarkdown(args.reportMd, report);
    throw new Error(report.errors[0]);
  }

  const baseUrl = normalizeHomepage(args.baseUrl);
  if (!baseUrl) {
    const report = makeReport({
      status: 'FAIL',
      url: '',
      expected: summarizeInsightSnapshot(expectedRaw),
      deployed: null,
      attempts: 0,
      errors: ['Pages base URL is empty. Set package.json homepage or pass --url.'],
    });

    writeJson(args.reportJson, report);
    writeMarkdown(args.reportMd, report);
    throw new Error(report.errors[0]);
  }

  const url = \`\${baseUrl}/newsdata/insight_latest.json?verify=\${Date.now()}\`;
  const expected = summarizeInsightSnapshot(expectedRaw);
  const errors = [];
  let deployed = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= args.retries; attempt += 1) {
    attempts = attempt;

    try {
      const deployedRaw = await fetchJson(url);
      deployed = summarizeInsightSnapshot(deployedRaw);

      if (
        deployed.schemaVersion === expected.schemaVersion &&
        deployed.contentHash === expected.contentHash &&
        deployed.storyCount === expected.storyCount
      ) {
        break;
      }

      errors.push(
        \`Attempt \${attempt}: deployed data not synced yet: expected \${expected.contentHash}/\${expected.storyCount}, got \${deployed.contentHash}/\${deployed.storyCount}\`
      );
    } catch (error) {
      errors.push(\`Attempt \${attempt}: \${error.message}\`);
    }

    if (attempt < args.retries) {
      await sleep(args.delayMs);
    }
  }

  const pass = Boolean(
    deployed &&
    deployed.schemaVersion === expected.schemaVersion &&
    deployed.contentHash === expected.contentHash &&
    deployed.storyCount === expected.storyCount
  );

  const report = makeReport({
    status: pass ? 'PASS' : 'FAIL',
    url,
    expected,
    deployed,
    attempts,
    errors: pass ? [] : errors,
  });

  writeJson(args.reportJson, report);
  writeMarkdown(args.reportMd, report);

  console.log(JSON.stringify({
    status: report.status,
    url: report.url,
    attempts: report.attempts,
    expectedContentHash: expected.contentHash,
    deployedContentHash: deployed?.contentHash || '',
    expectedStoryCount: expected.storyCount,
    deployedStoryCount: deployed?.storyCount || 0,
  }, null, 2));

  if (!pass) {
    throw new Error('Deployed Pages newsdata verification failed');
  }
}

main();
`);

write('scripts/test_pages_newsdata_verification_static.mjs', `import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const verifier = read('scripts/verify_pages_newsdata.mjs');
const workflow = read('.github/workflows/news_prefetch.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'pages-newsdata-verifier-v1',
  'verify_pages_newsdata',
  'summarizeInsightSnapshot',
  'contentHashOk',
  'storyCountOk',
  'schemaOk',
  'no-store',
  'newsdata/insight_latest.json',
  'pages_newsdata_verify_report.json',
  'pages_newsdata_verify_summary.md'
]) {
  assert(verifier.includes(token), \`verify_pages_newsdata.mjs missing token: \${token}\`);
}

for (const token of [
  'Verify deployed Pages newsdata',
  'node scripts/verify_pages_newsdata.mjs',
  'Upload Pages newsdata verification report',
  'pages-newsdata-verification',
  "if: steps.prefetch_commit.outputs.should_commit == 'true'"
]) {
  assert(workflow.includes(token), \`news_prefetch.yml missing deployed verification token: \${token}\`);
}

assert(
  workflow.includes('Publish updated Pages site'),
  'workflow must publish Pages before verifying deployed newsdata'
);

assert(
  workflow.indexOf('Publish updated Pages site') < workflow.indexOf('Verify deployed Pages newsdata'),
  'workflow must verify deployed newsdata after publishing Pages'
);

assert(
  packageJson.includes('"test:pages-newsdata-verification"'),
  'package.json must include test:pages-newsdata-verification'
);

assert(
  certGate.includes("['npm', ['run', 'test:pages-newsdata-verification']]"),
  'certification gate must run test:pages-newsdata-verification'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Pages deployed newsdata verification slice',
  guarantees: [
    'deployed Pages JSON verifier exists',
    'verifier compares schema/contentHash/storyCount',
    'verifier writes JSON and Markdown reports',
    'workflow verifies live Pages JSON after publish',
    'workflow uploads verification artifact',
    'diagnostic-only runs do not trigger verification',
    'certification gate includes deployed newsdata verification check'
  ]
}, null, 2));

console.log('PASS: Pages newsdata verification static slice');
`);

patchFile('.github/workflows/news_prefetch.yml', source => {
  if (!source.includes('Publish updated Pages site')) {
    throw new Error('Slice 46 Pages publish block is required before Slice 47');
  }

  if (source.includes('Verify deployed Pages newsdata')) return source;

  return insertAfterOnce(
    source,
    `      - name: Publish updated Pages site
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          npx gh-pages -d dist -u "github-actions[bot] <github-actions[bot]@users.noreply.github.com>"
`,
    `
      - name: Verify deployed Pages newsdata
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        run: |
          node scripts/verify_pages_newsdata.mjs --retries 10 --delay-ms 15000

      - name: Upload Pages newsdata verification report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: pages-newsdata-verification
          path: |
            public/newsdata/pages_newsdata_verify_report.json
            public/newsdata/pages_newsdata_verify_summary.md
          if-no-files-found: warn
`,
    'deployed pages newsdata verification block'
  );
});

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:pages-newsdata-verification'] = 'node scripts/test_pages_newsdata_verification_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:pages-newsdata-verification']]")) return source;

  if (source.includes("['npm', ['run', 'test:pages-data-publish']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:pages-data-publish']],",
      "  ['npm', ['run', 'test:pages-data-publish']],\n  ['npm', ['run', 'test:pages-newsdata-verification']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:pages-newsdata-verification']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 47 Pages deployed newsdata verification patch complete.');
