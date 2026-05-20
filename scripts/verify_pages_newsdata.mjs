import fs from 'node:fs';

// verify_pages_newsdata — deployed Pages JSON verification script
const VERIFIER_VERSION = 'pages-newsdata-verifier-v1';
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
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

function writeMarkdown(path, report) {
  const lines = [
    '# Pages Newsdata Verification',
    '',
    `- Status: **${report.status}**`,
    `- URL: \`${report.url}\``,
    `- Expected contentHash: \`${report.expected?.contentHash || ''}\``,
    `- Deployed contentHash: \`${report.deployed?.contentHash || ''}\``,
    `- Expected schema: \`${report.expected?.schemaVersion || 0}\``,
    `- Deployed schema: \`${report.deployed?.schemaVersion || 0}\``,
    `- Expected stories: \`${report.expected?.storyCount || 0}\``,
    `- Deployed stories: \`${report.deployed?.storyCount || 0}\``,
    `- Attempts: \`${report.attempts}\``,
    '',
    '## Checks',
    '',
    `- Fetch OK: \`${report.checks.fetchOk}\``,
    `- Schema OK: \`${report.checks.schemaOk}\``,
    `- Content hash OK: \`${report.checks.contentHashOk}\``,
    `- Story count OK: \`${report.checks.storyCountOk}\``,
  ];

  if (report.errors.length) {
    lines.push('', '## Errors', '');
    for (const error of report.errors) lines.push(`- ${error}`);
  }

  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeHomepage(homepage) {
  return String(homepage || '').replace(/\/$/, '');
}

function getDefaultPagesBaseUrl() {
  const pkg = readJson('package.json', {});
  const homepage = normalizeHomepage(pkg.homepage);
  if (homepage) return homepage;

  const repo = process.env.GITHUB_REPOSITORY || '';
  const [owner, name] = repo.split('/');
  if (owner && name) return `https://${owner}.github.io/${name}`;

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

function summarizeSectionsSnapshot(snapshot) {
  const sections = snapshot?.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};

  const sectionCounts = Object.fromEntries(
    Object.entries(sections).map(([section, stories]) => [
      section,
      Array.isArray(stories) ? stories.length : 0,
    ])
  );

  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    contentHash: snapshot?.contentHash || '',
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    sectionCount: Object.keys(sections).length,
    storyCount: Object.values(sectionCounts).reduce((sum, count) => sum + count, 0),
    sectionCounts,
    hasSectionQuality: Boolean(snapshot?.sectionQuality),
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
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
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
  const expectedSectionsRaw = readJson('public/newsdata/sections_latest.json', null);

  if (!expectedRaw) {
    const report = makeReport({
      status: 'FAIL',
      url: '',
      expected: null,
      deployed: null,
      attempts: 0,
      errors: [`Missing or invalid expected JSON: ${args.expectedPath}`],
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

  const url = `${baseUrl}/newsdata/insight_latest.json?verify=${Date.now()}`;
  const sectionsUrl = `${baseUrl}/newsdata/sections_latest.json?verify=${Date.now()}`;
  const expected = summarizeInsightSnapshot(expectedRaw);
  const expectedSections = expectedSectionsRaw ? summarizeSectionsSnapshot(expectedSectionsRaw) : null;
  const errors = [];
  let deployed = null;
  let deployedSections = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= args.retries; attempt += 1) {
    attempts = attempt;

    try {
      const deployedRaw = await fetchJson(url);
      const deployedSectionsRaw = expectedSections ? await fetchJson(sectionsUrl) : null;

      deployed = summarizeInsightSnapshot(deployedRaw);
      deployedSections = deployedSectionsRaw ? summarizeSectionsSnapshot(deployedSectionsRaw) : null;

      const insightOk =
        deployed.schemaVersion === expected.schemaVersion &&
        deployed.contentHash === expected.contentHash &&
        deployed.storyCount === expected.storyCount;

      const sectionsOk = !expectedSections || (
        deployedSections &&
        deployedSections.schemaVersion === expectedSections.schemaVersion &&
        deployedSections.contentHash === expectedSections.contentHash &&
        deployedSections.storyCount === expectedSections.storyCount
      );

      if (insightOk && sectionsOk) {
        break;
      }

      errors.push(
        `Attempt ${attempt}: deployed data not synced yet: insight expected ${expected.contentHash}/${expected.storyCount}, got ${deployed.contentHash}/${deployed.storyCount}; sections expected ${expectedSections?.contentHash || 'n/a'}/${expectedSections?.storyCount || 0}, got ${deployedSections?.contentHash || 'n/a'}/${deployedSections?.storyCount || 0}`
      );
    } catch (error) {
      errors.push(`Attempt ${attempt}: ${error.message}`);
    }

    if (attempt < args.retries) {
      await sleep(args.delayMs);
    }
  }

  const insightPass = Boolean(
    deployed &&
    deployed.schemaVersion === expected.schemaVersion &&
    deployed.contentHash === expected.contentHash &&
    deployed.storyCount === expected.storyCount
  );

  const sectionsPass = Boolean(
    !expectedSections ||
    (
      deployedSections &&
      deployedSections.schemaVersion === expectedSections.schemaVersion &&
      deployedSections.contentHash === expectedSections.contentHash &&
      deployedSections.storyCount === expectedSections.storyCount
    )
  );

  const pass = insightPass && sectionsPass;

  const report = makeReport({
    status: pass ? 'PASS' : 'FAIL',
    url,
    expected,
    expectedSections,
    deployed,
    deployedSections,
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
    expectedSectionsContentHash: expectedSections?.contentHash || '',
    deployedSectionsContentHash: deployedSections?.contentHash || '',
    expectedSectionsStoryCount: expectedSections?.storyCount || 0,
    deployedSectionsStoryCount: deployedSections?.storyCount || 0,
  }, null, 2));

  if (!pass) {
    throw new Error('Deployed Pages newsdata verification failed');
  }
}

main();
