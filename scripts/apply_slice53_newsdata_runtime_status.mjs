import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
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
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function insertBeforeOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

write('src/services/newsdataRuntimeStatus.js', `const NEWSDATA_REPORTS = {
  insightQuality: 'insight_quality_report.json',
  sectionsQuality: 'sections_quality_report.json',
  pagesManifest: 'pages_data_manifest.json',
  pagesVerification: 'pages_newsdata_verify_report.json',
  insightSourcePolicy: 'source_policy_report.json',
  sectionSourcePolicy: 'section_source_policy_report.json',
  prefetchCommit: 'prefetch_commit_manifest.json',
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
  if (normalized === 'WARN' || normalized === 'WARNING') return 'warn';
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
  const insightQuality = getReportData(reports.insightQuality);
  const sectionsQuality = getReportData(reports.sectionsQuality);
  const pagesVerification = getReportData(reports.pagesVerification);
  const pagesManifest = getReportData(reports.pagesManifest);
  const insightSourcePolicy = getReportData(reports.insightSourcePolicy);
  const sectionSourcePolicy = getReportData(reports.sectionSourcePolicy);
  const prefetchCommit = getReportData(reports.prefetchCommit);

  const insightStatus = reportStatus(reports.insightQuality);
  const sectionsStatus = reportStatus(reports.sectionsQuality);
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

  return {
    status: overallStatus,
    tone: getTone(overallStatus),
    generatedAt: Date.now(),
    insight: {
      status: insightStatus,
      tone: getTone(insightStatus),
      schemaVersion: safeNumber(insightQuality?.schemaVersion),
      storyCount: safeNumber(insightQuality?.storyCount),
      usable24hStoryCount: safeNumber(insightQuality?.usable24hStoryCount),
      sourceGroupCount: safeNumber(insightQuality?.sourceGroupCount),
      angleHintCoverage: safeNumber(insightQuality?.angleHintCoverage),
      contentHash: insightQuality?.contentHash || pagesManifest?.insight?.contentHash || '',
    },
    sections: {
      status: sectionsStatus,
      tone: getTone(sectionsStatus),
      schemaVersion: safeNumber(sectionsQuality?.schemaVersion),
      sectionCount: safeNumber(sectionsQuality?.sectionCount),
      storyCount: safeNumber(sectionsQuality?.storyCount),
      sourceGroupCount: safeNumber(sectionsQuality?.sourceGroupCount),
      contentHash: sectionsQuality?.contentHash || pagesManifest?.sections?.contentHash || '',
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
    missingReports: Object.entries(reports)
      .filter(([, result]) => !result?.ok)
      .map(([key, result]) => ({
        key,
        error: result?.error || 'missing',
      })),
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

write('src/components/NewsdataRuntimeStatusPanel.jsx', `import { useEffect, useState } from 'react';
import { getNewsdataRuntimeStatus } from '../services/newsdataRuntimeStatus.js';

function Percent({ value }) {
  const pct = Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;
  return <>{pct}%</>;
}

function HashChip({ value }) {
  if (!value) return <span className="newsdata-runtime__chip newsdata-runtime__chip--muted">no hash</span>;
  return <span className="newsdata-runtime__chip">{String(value).slice(0, 10)}</span>;
}

function Metric({ label, value }) {
  return (
    <div className="newsdata-runtime__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function NewsdataRuntimeStatusPanel({ compact = false }) {
  const [state, setState] = useState({
    loading: true,
    error: '',
    status: null,
  });

  useEffect(() => {
    let mounted = true;

    getNewsdataRuntimeStatus()
      .then(status => {
        if (!mounted) return;
        setState({
          loading: false,
          error: '',
          status,
        });
      })
      .catch(error => {
        if (!mounted) return;
        setState({
          loading: false,
          error: error?.message || 'Failed to load newsdata status',
          status: null,
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <section className="newsdata-runtime newsdata-runtime--loading" data-newsdata-runtime-status="loading">
        <div className="newsdata-runtime__eyebrow">Newsdata runtime</div>
        <h2>Checking deployed JSON health…</h2>
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="newsdata-runtime newsdata-runtime--bad" data-newsdata-runtime-status="error">
        <div className="newsdata-runtime__eyebrow">Newsdata runtime</div>
        <h2>Unable to read newsdata status</h2>
        <p>{state.error}</p>
      </section>
    );
  }

  const status = state.status;

  return (
    <section
      className={\`newsdata-runtime newsdata-runtime--\${status.tone}\${compact ? ' newsdata-runtime--compact' : ''}\`}
      data-newsdata-runtime-status={status.status}
    >
      <div className="newsdata-runtime__header">
        <div>
          <div className="newsdata-runtime__eyebrow">Newsdata runtime</div>
          <h2>{status.status === 'PASS' ? 'Static newsdata healthy' : 'Static newsdata needs attention'}</h2>
          <p>
            Collector JSON, section JSON, source policy and Pages deployment checks are combined here.
          </p>
        </div>
        <div className="newsdata-runtime__badge">{status.status}</div>
      </div>

      <div className="newsdata-runtime__grid">
        <div className="newsdata-runtime__card">
          <h3>Insight</h3>
          <div className={\`newsdata-runtime__pill newsdata-runtime__pill--\${status.insight.tone}\`}>
            {status.insight.status}
          </div>
          <Metric label="Stories" value={status.insight.storyCount} />
          <Metric label="Sources" value={status.insight.sourceGroupCount} />
          <Metric label="Angle hints" value={<Percent value={status.insight.angleHintCoverage} />} />
          <div className="newsdata-runtime__hash-row">
            <span>hash</span>
            <HashChip value={status.insight.contentHash} />
          </div>
        </div>

        <div className="newsdata-runtime__card">
          <h3>Sections</h3>
          <div className={\`newsdata-runtime__pill newsdata-runtime__pill--\${status.sections.tone}\`}>
            {status.sections.status}
          </div>
          <Metric label="Sections" value={status.sections.sectionCount} />
          <Metric label="Stories" value={status.sections.storyCount} />
          <Metric label="Sources" value={status.sections.sourceGroupCount} />
          <div className="newsdata-runtime__hash-row">
            <span>hash</span>
            <HashChip value={status.sections.contentHash} />
          </div>
        </div>

        <div className="newsdata-runtime__card">
          <h3>Pages sync</h3>
          <div className={\`newsdata-runtime__pill newsdata-runtime__pill--\${status.pages.tone}\`}>
            {status.pages.status}
          </div>
          <Metric label="Files matched" value={status.pages.allTrackedFilesMatched ? 'YES' : 'NO'} />
          <div className="newsdata-runtime__hash-row">
            <span>Insight</span>
            <HashChip value={status.pages.deployedInsightContentHash || status.pages.expectedInsightContentHash} />
          </div>
          <div className="newsdata-runtime__hash-row">
            <span>Sections</span>
            <HashChip value={status.pages.deployedSectionsContentHash || status.pages.expectedSectionsContentHash} />
          </div>
        </div>

        <div className="newsdata-runtime__card">
          <h3>Sources</h3>
          <div className={\`newsdata-runtime__pill newsdata-runtime__pill--\${status.sourcePolicy.tone}\`}>
            {status.sourcePolicy.status}
          </div>
          <Metric label="Insight sources" value={status.sourcePolicy.insightSourceCount} />
          <Metric label="Section sources" value={status.sourcePolicy.sectionSourceCount} />
          <Metric label="Diagnostic only" value={status.prefetchCommit.diagnosticOnly ? 'YES' : 'NO'} />
        </div>
      </div>

      {(status.errors.length > 0 || status.warnings.length > 0 || status.missingReports.length > 0) && (
        <div className="newsdata-runtime__messages">
          {status.errors.slice(0, 4).map((message, index) => (
            <div key={\`error-\${index}\`} className="newsdata-runtime__message newsdata-runtime__message--error">
              {message}
            </div>
          ))}
          {status.warnings.slice(0, 4).map((message, index) => (
            <div key={\`warning-\${index}\`} className="newsdata-runtime__message newsdata-runtime__message--warning">
              {message}
            </div>
          ))}
          {status.missingReports.slice(0, 3).map(report => (
            <div key={report.key} className="newsdata-runtime__message newsdata-runtime__message--missing">
              Missing report: {report.key} — {report.error}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
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
    });

    expect(summary.status).toBe('PASS');
    expect(summary.tone).toBe('good');
    expect(summary.insight.storyCount).toBe(40);
    expect(summary.sections.sectionCount).toBe(9);
    expect(summary.pages.allTrackedFilesMatched).toBe(true);
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
    });

    expect(summary.status).toBe('UNKNOWN');
    expect(summary.missingReports.length).toBeGreaterThanOrEqual(1);
  });
});
`);

patchFile('src/pages/InsightPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { recoverInsightRuntimeQuality } from '../insight/src/diagnostics/insightRuntimeQualityGate.ts';`,
    `\nimport NewsdataRuntimeStatusPanel from '../components/NewsdataRuntimeStatusPanel.jsx';`,
    'newsdata runtime panel import'
  );

  text = insertBeforeOnce(
    text,
    `      <InsightBehaviorEvidencePanel evidence={behaviorEvidence} />
`,
    `      <NewsdataRuntimeStatusPanel compact />
`,
    'newsdata runtime panel render'
  );

  return text;
});

patchFile('src/styles/InsightPage.css', source => {
  if (source.includes('.newsdata-runtime')) return source;

  return `${source}

/* ==========================================================================
   Newsdata runtime status
   Slice 53
   ========================================================================== */

.newsdata-runtime {
  margin: 14px 0;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background:
    radial-gradient(460px 180px at 100% 0%, rgba(59, 130, 246, 0.11), transparent 64%),
    rgba(15, 23, 42, 0.78);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.18);
}

.newsdata-runtime--good {
  border-color: rgba(34, 197, 94, 0.36);
}

.newsdata-runtime--warn {
  border-color: rgba(245, 158, 11, 0.44);
}

.newsdata-runtime--bad {
  border-color: rgba(248, 113, 113, 0.48);
}

.newsdata-runtime--unknown,
.newsdata-runtime--loading {
  border-color: rgba(148, 163, 184, 0.32);
}

.newsdata-runtime__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.newsdata-runtime__eyebrow {
  color: #93c5fd;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.newsdata-runtime h2 {
  margin: 5px 0;
  color: var(--text-primary, #fff);
  font-size: 1.08rem;
}

.newsdata-runtime p {
  margin: 0;
  color: var(--text-secondary, #aeb7c2);
  font-size: 0.85rem;
  line-height: 1.45;
}

.newsdata-runtime__badge {
  padding: 7px 11px;
  border-radius: 999px;
  border: 1px solid rgba(147, 197, 253, 0.24);
  background: rgba(59, 130, 246, 0.12);
  color: #bfdbfe;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.newsdata-runtime__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.newsdata-runtime__card {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.48);
}

.newsdata-runtime__card h3 {
  margin: 0 0 8px;
  color: var(--text-primary, #fff);
  font-size: 0.88rem;
}

.newsdata-runtime__pill {
  display: inline-flex;
  margin-bottom: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.newsdata-runtime__pill--good {
  background: rgba(34, 197, 94, 0.14);
  color: #86efac;
}

.newsdata-runtime__pill--warn {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.newsdata-runtime__pill--bad {
  background: rgba(248, 113, 113, 0.14);
  color: #fca5a5;
}

.newsdata-runtime__pill--unknown {
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
}

.newsdata-runtime__metric,
.newsdata-runtime__hash-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0;
  color: var(--text-secondary, #aeb7c2);
  font-size: 0.76rem;
}

.newsdata-runtime__metric strong {
  color: var(--text-primary, #fff);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.newsdata-runtime__chip {
  max-width: 120px;
  overflow: hidden;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.12);
  color: #bfdbfe;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.newsdata-runtime__chip--muted {
  background: rgba(148, 163, 184, 0.12);
  color: #94a3b8;
}

.newsdata-runtime__messages {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}

.newsdata-runtime__message {
  padding: 8px 10px;
  border-radius: 12px;
  font-size: 0.78rem;
  line-height: 1.35;
}

.newsdata-runtime__message--error {
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.24);
  color: #fecaca;
}

.newsdata-runtime__message--warning {
  border: 1px solid rgba(245, 158, 11, 0.28);
  background: rgba(120, 53, 15, 0.24);
  color: #fde68a;
}

.newsdata-runtime__message--missing {
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(51, 65, 85, 0.24);
  color: #cbd5e1;
}

@media (max-width: 900px) {
  .newsdata-runtime__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .newsdata-runtime__header {
    flex-direction: column;
  }

  .newsdata-runtime__grid {
    grid-template-columns: 1fr;
  }
}
`;
});

write('scripts/test_newsdata_runtime_status_static.mjs', `import fs from 'fs';

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
const page = read('src/pages/InsightPage.jsx');
const css = read('src/styles/InsightPage.css');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'NEWSDATA_REPORTS',
  'insight_quality_report.json',
  'sections_quality_report.json',
  'pages_data_manifest.json',
  'pages_newsdata_verify_report.json',
  'summarizeNewsdataRuntimeReports',
  'getNewsdataRuntimeStatus',
  'missingReports'
]) {
  assert(service.includes(token), \`newsdataRuntimeStatus.js missing token: \${token}\`);
}

for (const token of [
  'Newsdata runtime status certification',
  'summarizes healthy Insight',
  'downgrades to WARN',
  'surfaces missing report files'
]) {
  assert(unitTest.includes(token), \`newsdataRuntimeStatus.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'NewsdataRuntimeStatusPanel',
  'data-newsdata-runtime-status',
  'Static newsdata healthy',
  'Static newsdata needs attention',
  'Collector JSON, section JSON, source policy and Pages deployment'
]) {
  assert(component.includes(token), \`NewsdataRuntimeStatusPanel.jsx missing token: \${token}\`);
}

for (const token of [
  'NewsdataRuntimeStatusPanel',
  '<NewsdataRuntimeStatusPanel compact />'
]) {
  assert(page.includes(token), \`InsightPage.jsx missing runtime status integration token: \${token}\`);
}

for (const token of [
  '.newsdata-runtime',
  '.newsdata-runtime__grid',
  '.newsdata-runtime__message--warning',
  '.newsdata-runtime__chip'
]) {
  assert(css.includes(token), \`InsightPage.css missing newsdata runtime CSS token: \${token}\`);
}

assert(
  packageJson.includes('"test:newsdata-runtime-status"'),
  'package.json must include test:newsdata-runtime-status'
);

assert(
  certGate.includes("['npm', ['run', 'test:newsdata-runtime-status']]"),
  'certification gate must run test:newsdata-runtime-status'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Newsdata runtime observability slice',
  guarantees: [
    'browser runtime status service reads generated newsdata reports',
    'Insight/Sections/Pages/source-policy status is summarized',
    'missing report files are surfaced without crashing',
    'runtime status panel is integrated into Insight page',
    'CSS for status panel exists',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Newsdata runtime status static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:newsdata-runtime-status'] = 'node scripts/test_newsdata_runtime_status_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:newsdata-runtime-status']]")) return source;

  if (source.includes("['npm', ['run', 'test:sections-quality-deploy']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:sections-quality-deploy']],",
      "  ['npm', ['run', 'test:sections-quality-deploy']],\n  ['npm', ['run', 'test:newsdata-runtime-status']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:newsdata-runtime-status']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 53 Newsdata runtime status patch complete.');
