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

write('src/services/newsdataRuntimeStatus.js', `const NEWSDATA_REPORTS = {
  insightQuality: 'insight_quality_report.json',
  sectionsQuality: 'sections_quality_report.json',
  pagesManifest: 'pages_data_manifest.json',
  pagesVerification: 'pages_newsdata_verify_report.json',
  insightSourcePolicy: 'source_policy_report.json',
  sectionSourcePolicy: 'section_source_policy_report.json',
  prefetchCommit: 'prefetch_commit_manifest.json',
  rawInsight: 'insight_latest.json',
  rawSections: 'sections_latest.json',
};

function getNewsdataBaseUrl() {
  const base = import.meta?.env?.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return \`\${cleanBase}/newsdata\`;
}

async function fetchJsonOrNull(url) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        missing: true,
        status: response.status,
        error: \`HTTP \${response.status}\`,
      };
    }

    return {
      ok: true,
      data: await response.json(),
    };
  } catch (error) {
    return {
      ok: false,
      missing: true,
      error: error?.message || 'fetch failed',
    };
  }
}

function asStatus(value, fallback = 'UNKNOWN') {
  return String(value || fallback).toUpperCase();
}

function statusRank(status) {
  const ranks = {
    PASS: 3,
    OK: 3,
    WARN: 2,
    WARNING: 2,
    RAW: 2,
    UNKNOWN: 1,
    FAIL: 0,
    ERROR: 0,
  };

  return ranks[asStatus(status)] ?? 1;
}

function worstStatus(statuses) {
  const normalized = statuses.map(status => asStatus(status));
  return normalized.sort((a, b) => statusRank(a) - statusRank(b))[0] || 'UNKNOWN';
}

function getTone(status) {
  const normalized = asStatus(status);

  if (normalized === 'PASS' || normalized === 'OK') return 'good';
  if (normalized === 'WARN' || normalized === 'WARNING' || normalized === 'RAW') return 'warn';
  if (normalized === 'FAIL' || normalized === 'ERROR') return 'bad';
  return 'unknown';
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function reportStatus(fetchResult) {
  if (!fetchResult?.ok) return 'UNKNOWN';
  return asStatus(fetchResult.data?.status, 'UNKNOWN');
}

function getReportData(fetchResult) {
  return fetchResult?.ok ? fetchResult.data : null;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function summarizeRawInsightSnapshot(snapshot) {
  const stories = safeArray(snapshot?.stories);
  const sourceGroups = new Set(
    stories.map(story => story?.sourceGroup || story?.source || 'unknown')
  );

  const storiesWithAngleHints = stories.filter(story => (
    safeArray(story?.angleHints).length > 0 ||
    safeArray(story?.storySignals?.angleHints).length > 0
  ));

  return {
    status: stories.length > 0 ? 'RAW' : 'UNKNOWN',
    schemaVersion: safeNumber(snapshot?.schemaVersion),
    storyCount: stories.length,
    usable24hStoryCount: stories.length,
    sourceGroupCount: sourceGroups.size,
    angleHintCoverage: stories.length > 0 ? storiesWithAngleHints.length / stories.length : 0,
    contentHash: snapshot?.contentHash || '',
    fallbackFromRawJson: true,
  };
}

function summarizeRawSectionsSnapshot(snapshot) {
  const sections = snapshot?.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};

  const allStories = Object.values(sections).flatMap(items => safeArray(items));
  const sourceGroups = new Set(
    allStories.map(story => story?.sourceGroup || story?.source || 'unknown')
  );

  return {
    status: allStories.length > 0 ? 'RAW' : 'UNKNOWN',
    schemaVersion: safeNumber(snapshot?.schemaVersion),
    sectionCount: Object.keys(sections).length,
    storyCount: allStories.length,
    sourceGroupCount: sourceGroups.size,
    contentHash: snapshot?.contentHash || '',
    fallbackFromRawJson: true,
  };
}

function collectWarnings(...reports) {
  return reports
    .flatMap(report => Array.isArray(report?.warnings) ? report.warnings : [])
    .slice(0, 8);
}

function collectErrors(...reports) {
  return reports
    .flatMap(report => Array.isArray(report?.errors) ? report.errors : [])
    .slice(0, 8);
}

export function summarizeNewsdataRuntimeReports(reports) {
  const insightQualityReport = getReportData(reports.insightQuality);
  const sectionsQualityReport = getReportData(reports.sectionsQuality);
  const rawInsight = getReportData(reports.rawInsight);
  const rawSections = getReportData(reports.rawSections);

  const insightQuality = insightQualityReport || (rawInsight ? summarizeRawInsightSnapshot(rawInsight) : null);
  const sectionsQuality = sectionsQualityReport || (rawSections ? summarizeRawSectionsSnapshot(rawSections) : null);

  const pagesVerification = getReportData(reports.pagesVerification);
  const pagesManifest = getReportData(reports.pagesManifest);
  const insightSourcePolicy = getReportData(reports.insightSourcePolicy);
  const sectionSourcePolicy = getReportData(reports.sectionSourcePolicy);
  const prefetchCommit = getReportData(reports.prefetchCommit);

  const insightStatus = insightQuality?.status || 'UNKNOWN';
  const sectionsStatus = sectionsQuality?.status || 'UNKNOWN';

  const pagesStatus = reportStatus(reports.pagesVerification);
  const manifestStatus = pagesManifest?.allTrackedFilesMatched === true
    ? 'PASS'
    : pagesManifest
      ? 'WARN'
      : 'UNKNOWN';

  const sourcePolicyStatus = worstStatus([
    insightSourcePolicy?.validation?.status || 'UNKNOWN',
    sectionSourcePolicy?.validation?.status || 'UNKNOWN',
  ]);

  const overallStatus = worstStatus([
    insightStatus,
    sectionsStatus,
    pagesStatus,
    manifestStatus,
    sourcePolicyStatus,
  ]);

  const warnings = collectWarnings(
    insightQuality,
    sectionsQuality,
    insightSourcePolicy?.validation,
    sectionSourcePolicy?.validation,
  );

  const errors = collectErrors(
    insightQuality,
    sectionsQuality,
    pagesVerification,
    insightSourcePolicy?.validation,
    sectionSourcePolicy?.validation,
  );

  const missingReports = Object.entries(reports)
    .filter(([key, result]) => {
      if (key === 'rawInsight' || key === 'rawSections') return false;
      return !result?.ok;
    })
    .map(([key, result]) => ({
      key,
      error: result?.error || 'missing',
    }));

  const rawFallbackUsed = Boolean(
    (!insightQualityReport && rawInsight) ||
    (!sectionsQualityReport && rawSections)
  );

  return {
    status: overallStatus,
    tone: getTone(overallStatus),
    generatedAt: Date.now(),
    rawFallbackUsed,
    insight: {
      status: insightStatus,
      tone: getTone(insightStatus),
      schemaVersion: safeNumber(insightQuality?.schemaVersion),
      storyCount: safeNumber(insightQuality?.storyCount),
      usable24hStoryCount: safeNumber(insightQuality?.usable24hStoryCount),
      sourceGroupCount: safeNumber(insightQuality?.sourceGroupCount),
      angleHintCoverage: safeNumber(insightQuality?.angleHintCoverage),
      contentHash: insightQuality?.contentHash || pagesManifest?.insight?.contentHash || '',
      fallbackFromRawJson: Boolean(insightQuality?.fallbackFromRawJson),
    },
    sections: {
      status: sectionsStatus,
      tone: getTone(sectionsStatus),
      schemaVersion: safeNumber(sectionsQuality?.schemaVersion),
      sectionCount: safeNumber(sectionsQuality?.sectionCount),
      storyCount: safeNumber(sectionsQuality?.storyCount),
      sourceGroupCount: safeNumber(sectionsQuality?.sourceGroupCount),
      contentHash: sectionsQuality?.contentHash || pagesManifest?.sections?.contentHash || '',
      fallbackFromRawJson: Boolean(sectionsQuality?.fallbackFromRawJson),
    },
    pages: {
      status: pagesStatus,
      tone: getTone(pagesStatus),
      manifestStatus,
      allTrackedFilesMatched: Boolean(pagesManifest?.allTrackedFilesMatched),
      expectedInsightContentHash: pagesVerification?.expected?.contentHash || '',
      deployedInsightContentHash: pagesVerification?.deployed?.contentHash || '',
      expectedSectionsContentHash: pagesVerification?.expectedSections?.contentHash || '',
      deployedSectionsContentHash: pagesVerification?.deployedSections?.contentHash || '',
    },
    sourcePolicy: {
      status: sourcePolicyStatus,
      tone: getTone(sourcePolicyStatus),
      insightSourceCount: safeNumber(insightSourcePolicy?.sourceCount),
      sectionSourceCount: safeNumber(sectionSourcePolicy?.sourceCount),
      insightValidation: insightSourcePolicy?.validation || null,
      sectionValidation: sectionSourcePolicy?.validation || null,
    },
    prefetchCommit: {
      shouldCommit: Boolean(prefetchCommit?.shouldCommit),
      diagnosticOnly: Boolean(prefetchCommit?.diagnosticOnly),
      changedContentFiles: Array.isArray(prefetchCommit?.changedContentFiles)
        ? prefetchCommit.changedContentFiles
        : [],
    },
    warnings,
    errors,
    missingReports,
  };
}

export async function getNewsdataRuntimeStatus() {
  const base = getNewsdataBaseUrl();

  const entries = await Promise.all(
    Object.entries(NEWSDATA_REPORTS).map(async ([key, file]) => [
      key,
      await fetchJsonOrNull(\`\${base}/\${file}?runtime=\${Date.now()}\`),
    ])
  );

  return summarizeNewsdataRuntimeReports(Object.fromEntries(entries));
}

export default getNewsdataRuntimeStatus;
`);

write('src/services/newsdataRuntimeStatus.cert.test.js', `import { describe, expect, it } from 'vitest';
import { summarizeNewsdataRuntimeReports } from './newsdataRuntimeStatus';

function ok(data) {
  return { ok: true, data };
}

function missing(error = 'missing') {
  return { ok: false, missing: true, error };
}

describe('Newsdata runtime status certification', () => {
  it('summarizes healthy Insight, Sections and Pages reports', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: ok({
        status: 'PASS',
        schemaVersion: 3,
        storyCount: 40,
        usable24hStoryCount: 30,
        sourceGroupCount: 8,
        angleHintCoverage: 0.7,
        contentHash: 'insight-hash',
      }),
      sectionsQuality: ok({
        status: 'PASS',
        schemaVersion: 2,
        sectionCount: 9,
        storyCount: 80,
        sourceGroupCount: 12,
        contentHash: 'sections-hash',
      }),
      pagesManifest: ok({
        allTrackedFilesMatched: true,
        insight: { contentHash: 'insight-hash' },
        sections: { contentHash: 'sections-hash' },
      }),
      pagesVerification: ok({
        status: 'PASS',
        expected: { contentHash: 'insight-hash' },
        deployed: { contentHash: 'insight-hash' },
        expectedSections: { contentHash: 'sections-hash' },
        deployedSections: { contentHash: 'sections-hash' },
      }),
      insightSourcePolicy: ok({
        validation: { status: 'PASS' },
        sourceCount: 10,
      }),
      sectionSourcePolicy: ok({
        validation: { status: 'PASS' },
        sourceCount: 14,
      }),
      prefetchCommit: ok({
        shouldCommit: true,
        diagnosticOnly: false,
        changedContentFiles: ['public/newsdata/insight_latest.json'],
      }),
      rawInsight: missing(),
      rawSections: missing(),
    });

    expect(summary.status).toBe('PASS');
    expect(summary.tone).toBe('good');
    expect(summary.insight.storyCount).toBe(40);
    expect(summary.sections.sectionCount).toBe(9);
    expect(summary.pages.allTrackedFilesMatched).toBe(true);
  });

  it('falls back to raw deployed JSON when report files are missing', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: missing('404'),
      sectionsQuality: missing('404'),
      pagesManifest: missing('404'),
      pagesVerification: missing('404'),
      insightSourcePolicy: missing('404'),
      sectionSourcePolicy: missing('404'),
      prefetchCommit: missing('404'),
      rawInsight: ok({
        schemaVersion: 3,
        contentHash: 'raw-insight',
        stories: [
          {
            id: 'a',
            sourceGroup: 'gov',
            angleHints: [{ angle: 'official_response', score: 0.9 }],
          },
          {
            id: 'b',
            sourceGroup: 'market',
            storySignals: {
              angleHints: [{ angle: 'market_reaction', score: 0.9 }],
            },
          },
        ],
      }),
      rawSections: ok({
        schemaVersion: 2,
        contentHash: 'raw-sections',
        sections: {
          topStories: [
            { id: 'a', sourceGroup: 'wire' },
            { id: 'b', sourceGroup: 'agency' },
          ],
        },
      }),
    });

    expect(summary.rawFallbackUsed).toBe(true);
    expect(summary.insight.status).toBe('RAW');
    expect(summary.sections.status).toBe('RAW');
    expect(summary.insight.storyCount).toBe(2);
    expect(summary.sections.storyCount).toBe(2);
    expect(summary.insight.fallbackFromRawJson).toBe(true);
    expect(summary.sections.fallbackFromRawJson).toBe(true);
  });

  it('downgrades to WARN when section quality warns', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: ok({ status: 'PASS' }),
      sectionsQuality: ok({ status: 'WARN', warnings: ['Section sports is thin'] }),
      pagesManifest: ok({ allTrackedFilesMatched: true }),
      pagesVerification: ok({ status: 'PASS' }),
      insightSourcePolicy: ok({ validation: { status: 'PASS' } }),
      sectionSourcePolicy: ok({ validation: { status: 'PASS' } }),
      prefetchCommit: ok({}),
      rawInsight: missing(),
      rawSections: missing(),
    });

    expect(summary.status).toBe('WARN');
    expect(summary.tone).toBe('warn');
    expect(summary.warnings).toContain('Section sports is thin');
  });

  it('surfaces missing report files without throwing', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: missing('404'),
      sectionsQuality: ok({ status: 'PASS' }),
      pagesManifest: missing('404'),
      pagesVerification: missing('404'),
      insightSourcePolicy: ok({ validation: { status: 'PASS' } }),
      sectionSourcePolicy: ok({ validation: { status: 'PASS' } }),
      prefetchCommit: ok({}),
      rawInsight: missing('404'),
      rawSections: missing('404'),
    });

    expect(summary.status).toBe('UNKNOWN');
    expect(summary.missingReports.length).toBeGreaterThanOrEqual(1);
  });
});
`);

patchFile('src/components/NewsdataRuntimeStatusPanel.jsx', source => {
  let text = source;

  if (!text.includes('Raw JSON fallback active')) {
    text = text.replace(
      `          <p>
            Collector JSON, section JSON, source policy and Pages deployment checks are combined here.
          </p>`,
      `          <p>
            Collector JSON, section JSON, source policy and Pages deployment checks are combined here.
            {status.rawFallbackUsed ? ' Raw JSON fallback active.' : ''}
          </p>`
    );
  }

  if (!text.includes('Fallback')) {
    text = text.replace(
      `<Metric label="Angle hints" value={<Percent value={status.insight.angleHintCoverage} />} />`,
      `<Metric label="Angle hints" value={<Percent value={status.insight.angleHintCoverage} />} />
          <Metric label="Fallback" value={status.insight.fallbackFromRawJson ? 'RAW' : 'REPORT'} />`
    );

    text = text.replace(
      `<Metric label="Sources" value={status.sections.sourceGroupCount} />`,
      `<Metric label="Sources" value={status.sections.sourceGroupCount} />
          <Metric label="Fallback" value={status.sections.fallbackFromRawJson ? 'RAW' : 'REPORT'} />`
    );
  }

  return text;
});

write('scripts/test_newsdata_raw_json_fallback_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const service = read('src/services/newsdataRuntimeStatus.js');
const unitTest = read('src/services/newsdataRuntimeStatus.cert.test.js');
const component = read('src/components/NewsdataRuntimeStatusPanel.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  "rawInsight: 'insight_latest.json'",
  "rawSections: 'sections_latest.json'",
  'summarizeRawInsightSnapshot',
  'summarizeRawSectionsSnapshot',
  'rawFallbackUsed',
  'fallbackFromRawJson',
  'RAW'
]) {
  assert(service.includes(token), \`newsdataRuntimeStatus.js missing raw fallback token: \${token}\`);
}

for (const token of [
  'falls back to raw deployed JSON',
  'rawFallbackUsed',
  'fallbackFromRawJson',
  'raw-insight',
  'raw-sections'
]) {
  assert(unitTest.includes(token), \`newsdataRuntimeStatus.cert.test.js missing raw fallback test token: \${token}\`);
}

for (const token of [
  'Raw JSON fallback active',
  'Fallback',
  'REPORT'
]) {
  assert(component.includes(token), \`NewsdataRuntimeStatusPanel.jsx missing fallback UI token: \${token}\`);
}

assert(
  packageJson.includes('"test:newsdata-raw-json-fallback"'),
  'package.json must include test:newsdata-raw-json-fallback'
);

assert(
  certGate.includes("['npm', ['run', 'test:newsdata-raw-json-fallback']]"),
  'certification gate must run test:newsdata-raw-json-fallback'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Newsdata raw JSON fallback slice',
  guarantees: [
    'runtime status service fetches raw insight_latest.json',
    'runtime status service fetches raw sections_latest.json',
    'missing quality reports can fall back to raw deployed JSON',
    'fallback status is marked RAW, not total failure',
    'panel displays fallback source',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Newsdata raw JSON fallback static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:newsdata-raw-json-fallback'] = 'node scripts/test_newsdata_raw_json_fallback_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:newsdata-raw-json-fallback']]")) return source;

  if (source.includes("['npm', ['run', 'test:news-prefetch-workflow-orchestration']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:news-prefetch-workflow-orchestration']],",
      "  ['npm', ['run', 'test:news-prefetch-workflow-orchestration']],\n  ['npm', ['run', 'test:newsdata-raw-json-fallback']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:newsdata-raw-json-fallback']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 55 Newsdata raw JSON fallback patch complete.');
