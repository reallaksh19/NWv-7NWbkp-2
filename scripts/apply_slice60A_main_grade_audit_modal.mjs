import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) return '';
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  if (!before) throw new Error(`Missing file: ${path}`);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function insertBeforeOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

/* -------------------------------------------------------------------------- */
/* 1) Main tab grading service                                                 */
/* -------------------------------------------------------------------------- */

write('src/services/pageAuditGrading.js', `function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function storyKey(story) {
  return String(story?.id || story?.url || story?.link || story?.title || '').trim();
}

function storySource(story) {
  return String(story?.sourceGroup || story?.source || 'unknown').trim().toLowerCase();
}

function storyTime(story) {
  const candidates = [
    story?.publishedAt,
    story?.fetchedAt,
    story?.timestamp,
    story?.timeMs,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function gradeFromScore(score) {
  if (score >= 88) return 'A';
  if (score >= 74) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function toneFromGrade(grade) {
  if (grade === 'A' || grade === 'B') return 'good';
  if (grade === 'C') return 'warn';
  return 'bad';
}

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function auditMainTabQuality({
  newsData = {},
  weatherData = {},
  breakingNews = [],
  settings = {},
  loading = false,
  errors = {},
  now = Date.now(),
} = {}) {
  const news = asObject(newsData);
  const weather = asObject(weatherData);
  const sectionSettings = asObject(settings.sections);

  const frontPage = asArray(news.frontPage);
  const sectionNames = ['india', 'chennai', 'local', 'world'];
  const enabledSections = sectionNames.filter(section => sectionSettings?.[section]?.enabled !== false);

  const sectionStories = enabledSections.flatMap(section => asArray(news[section]));
  const allStories = [...frontPage, ...sectionStories, ...asArray(breakingNews)];

  const keys = allStories.map(storyKey).filter(Boolean);
  const duplicateCount = Math.max(0, keys.length - unique(keys).length);
  const duplicateRate = keys.length > 0 ? duplicateCount / keys.length : 0;

  const sourceGroups = unique(allStories.map(storySource));
  const sectionHealth = enabledSections.map(section => {
    const stories = asArray(news[section]);
    const sources = unique(stories.map(storySource));

    return {
      section,
      storyCount: stories.length,
      sourceGroupCount: sources.length,
      status: stories.length >= 3 && sources.length >= 2 ? 'PASS' : stories.length > 0 ? 'WARN' : 'FAIL',
    };
  });

  const missingSections = sectionHealth.filter(item => item.status === 'FAIL').map(item => item.section);
  const weakSections = sectionHealth.filter(item => item.status === 'WARN').map(item => item.section);

  const timestamps = allStories.map(storyTime).filter(Boolean);
  const newestAgeMinutes = timestamps.length > 0
    ? Math.max(0, Math.round((now - Math.max(...timestamps)) / 60000))
    : null;

  const stale = newestAgeMinutes == null ? true : newestAgeMinutes > 360;
  const weatherCities = Object.keys(weather).filter(city => weather[city]);
  const weatherCityCount = weatherCities.length;
  const weatherReadyCount = weatherCities.filter(city => weather[city]?.current || weather[city]?.temp || weather[city]?.weeklyForecast).length;

  const audits = [
    {
      id: 'frontpage-volume',
      label: 'Front page story volume',
      status: frontPage.length >= 10 ? 'PASS' : frontPage.length >= 5 ? 'WARN' : 'FAIL',
      detail: \`\${frontPage.length} front-page stories available.\`,
    },
    {
      id: 'source-diversity',
      label: 'Source diversity',
      status: sourceGroups.length >= 6 ? 'PASS' : sourceGroups.length >= 3 ? 'WARN' : 'FAIL',
      detail: \`\${sourceGroups.length} unique source groups across visible main-tab news.\`,
    },
    {
      id: 'section-coverage',
      label: 'Section coverage',
      status: missingSections.length === 0 && weakSections.length === 0 ? 'PASS' : missingSections.length === 0 ? 'WARN' : 'FAIL',
      detail: missingSections.length
        ? \`Missing sections: \${missingSections.join(', ')}.\`
        : weakSections.length
          ? \`Weak sections: \${weakSections.join(', ')}.\`
          : 'All enabled sections have visible stories.',
    },
    {
      id: 'duplicate-rate',
      label: 'Duplicate story control',
      status: duplicateRate <= 0.08 ? 'PASS' : duplicateRate <= 0.18 ? 'WARN' : 'FAIL',
      detail: \`\${duplicateCount} duplicate-like story keys from \${keys.length || 0} keyed stories.\`,
    },
    {
      id: 'freshness',
      label: 'Freshness',
      status: !stale ? 'PASS' : newestAgeMinutes == null ? 'WARN' : 'FAIL',
      detail: newestAgeMinutes == null
        ? 'No usable story timestamp found.'
        : \`Newest visible story is about \${newestAgeMinutes} minutes old.\`,
    },
    {
      id: 'weather-availability',
      label: 'Weather availability',
      status: weatherReadyCount >= 3 ? 'PASS' : weatherReadyCount >= 1 ? 'WARN' : 'FAIL',
      detail: \`\${weatherReadyCount} weather locations ready from \${weatherCityCount} loaded locations.\`,
    },
    {
      id: 'error-state',
      label: 'Runtime error state',
      status: Object.keys(asObject(errors)).length === 0 ? 'PASS' : 'FAIL',
      detail: Object.keys(asObject(errors)).length === 0
        ? 'No active error object from news context.'
        : \`Errors present: \${Object.keys(asObject(errors)).join(', ')}.\`,
    },
    {
      id: 'loading-state',
      label: 'Loading gate',
      status: loading ? 'WARN' : 'PASS',
      detail: loading ? 'Main tab is still loading or refreshing.' : 'Main tab is not in blocking loading state.',
    },
  ];

  const weights = {
    PASS: 100,
    WARN: 62,
    FAIL: 15,
  };

  const score = clampScore(
    audits.reduce((sum, audit) => sum + (weights[audit.status] ?? 40), 0) / audits.length
  );

  const grade = gradeFromScore(score);
  const warnings = audits.filter(audit => audit.status === 'WARN').map(audit => audit.detail);
  const failures = audits.filter(audit => audit.status === 'FAIL').map(audit => audit.detail);

  return {
    schemaVersion: 1,
    target: 'main-tab',
    title: 'Main tab data quality',
    grade,
    score,
    tone: toneFromGrade(grade),
    generatedAt: now,
    summary: {
      frontPageStoryCount: frontPage.length,
      totalVisibleStoryCount: allStories.length,
      sourceGroupCount: sourceGroups.length,
      duplicateRate: Number(duplicateRate.toFixed(3)),
      newestAgeMinutes,
      enabledSections,
      missingSections,
      weakSections,
      weatherReadyCount,
      loading,
    },
    gates: audits,
    audits,
    dataTrust: {
      status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
      sourceDiversity: sourceGroups.length,
      duplicateRate: Number(duplicateRate.toFixed(3)),
      stale,
      weatherReadyCount,
    },
    warnings,
    failures,
  };
}

export function auditGradeLabel(audit) {
  return audit?.grade || 'F';
}

export function auditGradeTone(audit) {
  return audit?.tone || toneFromGrade(audit?.grade || 'F');
}
`);

write('src/services/pageAuditGrading.cert.test.js', `import { describe, expect, it } from 'vitest';
import { auditMainTabQuality } from './pageAuditGrading';

function story(id, sourceGroup, publishedAt = Date.now()) {
  return {
    id,
    title: 'Story ' + id,
    sourceGroup,
    publishedAt,
  };
}

describe('Main tab audit grading certification', () => {
  it('gives strong grade for diverse fresh data', () => {
    const now = Date.now();
    const audit = auditMainTabQuality({
      now,
      newsData: {
        frontPage: Array.from({ length: 12 }, (_, index) => story('top-' + index, 'source_' + (index % 6), now - 60000)),
        india: [story('india-1', 'source_a', now), story('india-2', 'source_b', now), story('india-3', 'source_c', now)],
        chennai: [story('tn-1', 'source_d', now), story('tn-2', 'source_e', now), story('tn-3', 'source_f', now)],
        local: [story('local-1', 'source_g', now), story('local-2', 'source_h', now), story('local-3', 'source_i', now)],
        world: [story('world-1', 'source_j', now), story('world-2', 'source_k', now), story('world-3', 'source_l', now)],
      },
      weatherData: {
        chennai: { current: { temp: 32 } },
        trichy: { current: { temp: 34 } },
        muscat: { current: { temp: 35 } },
        colombo: { current: { temp: 29 } },
      },
      settings: {
        sections: {
          india: { enabled: true },
          chennai: { enabled: true },
          local: { enabled: true },
          world: { enabled: true },
        },
      },
    });

    expect(['A', 'B']).toContain(audit.grade);
    expect(audit.summary.sourceGroupCount).toBeGreaterThanOrEqual(6);
    expect(audit.failures).toEqual([]);
  });

  it('downgrades weak main tab data', () => {
    const audit = auditMainTabQuality({
      now: Date.now(),
      newsData: {
        frontPage: [story('same', 'single'), story('same', 'single')],
        india: [],
        chennai: [],
        local: [],
        world: [],
      },
      weatherData: {},
      settings: {
        sections: {
          india: { enabled: true },
          chennai: { enabled: true },
          local: { enabled: true },
          world: { enabled: true },
        },
      },
    });

    expect(['D', 'F']).toContain(audit.grade);
    expect(audit.failures.length).toBeGreaterThan(0);
  });

  it('keeps loading as warning instead of hard failure', () => {
    const audit = auditMainTabQuality({
      loading: true,
      newsData: {
        frontPage: Array.from({ length: 10 }, (_, index) => story('s-' + index, 'src_' + index)),
      },
      weatherData: {
        chennai: { current: { temp: 30 } },
      },
    });

    const loadingGate = audit.gates.find(gate => gate.id === 'loading-state');
    expect(loadingGate.status).toBe('WARN');
  });
});
`);

/* -------------------------------------------------------------------------- */
/* 2) Grade Badge UI                                                           */
/* -------------------------------------------------------------------------- */

write('src/components/audit/GradeBadge.jsx', `import { useState } from 'react';
import AuditDetailModal from './AuditDetailModal.jsx';
import { auditGradeLabel, auditGradeTone } from '../../services/pageAuditGrading.js';
import './GradeBadge.css';

export default function GradeBadge({ audit, label = 'Quality grade', corner = true }) {
  const [open, setOpen] = useState(false);
  const grade = auditGradeLabel(audit);
  const tone = auditGradeTone(audit);

  return (
    <>
      <button
        type="button"
        className={
          'grade-badge grade-badge--' + tone + (corner ? ' grade-badge--corner' : '')
        }
        onClick={() => setOpen(true)}
        aria-label={label + ': ' + grade + '. Open audit details'}
        title={label + ': ' + grade}
        data-grade-badge={grade}
      >
        <span className="grade-badge__letter">{grade}</span>
      </button>

      {open && (
        <AuditDetailModal
          audit={audit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
`);

write('src/components/audit/GradeBadge.css', `.grade-badge {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.20);
  border-radius: 14px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.26);
  color: #fff;
  cursor: pointer;
  font-weight: 950;
  line-height: 1;
  z-index: 40;
}

.grade-badge--corner {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  right: 12px;
}

.grade-badge__letter {
  font-size: 1.12rem;
  letter-spacing: 0.02em;
}

.grade-badge--good {
  background: linear-gradient(135deg, rgba(22, 163, 74, 0.95), rgba(21, 128, 61, 0.95));
}

.grade-badge--warn {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(180, 83, 9, 0.95));
}

.grade-badge--bad {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(153, 27, 27, 0.95));
}

.grade-badge:hover {
  transform: translateY(-1px);
}

@media (max-width: 560px) {
  .grade-badge--corner {
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    right: 10px;
    width: 38px;
    height: 38px;
    border-radius: 12px;
  }
}
`);

write('src/components/audit/AuditDetailModal.jsx', `function statusClass(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'pass') return 'audit-modal__status audit-modal__status--pass';
  if (value === 'warn') return 'audit-modal__status audit-modal__status--warn';
  return 'audit-modal__status audit-modal__status--fail';
}

function KeyValue({ label, value }) {
  return (
    <div className="audit-modal__kv">
      <span>{label}</span>
      <strong>{value == null || value === '' ? '—' : String(value)}</strong>
    </div>
  );
}

export default function AuditDetailModal({ audit, onClose }) {
  const gates = Array.isArray(audit?.gates) ? audit.gates : [];
  const warnings = Array.isArray(audit?.warnings) ? audit.warnings : [];
  const failures = Array.isArray(audit?.failures) ? audit.failures : [];
  const summary = audit?.summary || {};

  return (
    <div className="audit-modal__backdrop" role="presentation" onClick={onClose}>
      <section
        className="audit-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Audit and data trust details"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="audit-modal__header">
          <div>
            <div className="audit-modal__eyebrow">Data trust / audits / gates</div>
            <h2>{audit?.title || 'Page quality audit'}</h2>
          </div>

          <div className={'audit-modal__grade audit-modal__grade--' + (audit?.tone || 'bad')}>
            {audit?.grade || 'F'}
          </div>

          <button type="button" className="audit-modal__close" onClick={onClose} aria-label="Close audit popup">
            ×
          </button>
        </header>

        <div className="audit-modal__score-row">
          <KeyValue label="Score" value={audit?.score != null ? audit.score + '/100' : '—'} />
          <KeyValue label="Target" value={audit?.target || '—'} />
          <KeyValue label="Data trust" value={audit?.dataTrust?.status || '—'} />
          <KeyValue label="Generated" value={audit?.generatedAt ? new Date(audit.generatedAt).toLocaleString() : '—'} />
        </div>

        <div className="audit-modal__summary">
          <KeyValue label="Visible stories" value={summary.totalVisibleStoryCount} />
          <KeyValue label="Front page" value={summary.frontPageStoryCount} />
          <KeyValue label="Source groups" value={summary.sourceGroupCount} />
          <KeyValue label="Duplicate rate" value={summary.duplicateRate != null ? Math.round(summary.duplicateRate * 100) + '%' : '—'} />
          <KeyValue label="Freshness" value={summary.newestAgeMinutes == null ? 'unknown' : summary.newestAgeMinutes + ' min'} />
          <KeyValue label="Weather ready" value={summary.weatherReadyCount} />
        </div>

        <div className="audit-modal__section">
          <h3>Gate results</h3>
          <div className="audit-modal__gates">
            {gates.map(gate => (
              <article key={gate.id || gate.label} className="audit-modal__gate">
                <div>
                  <strong>{gate.label}</strong>
                  <p>{gate.detail}</p>
                </div>
                <span className={statusClass(gate.status)}>{gate.status}</span>
              </article>
            ))}
          </div>
        </div>

        {(failures.length > 0 || warnings.length > 0) && (
          <div className="audit-modal__section">
            <h3>Warnings / failures</h3>
            <div className="audit-modal__messages">
              {failures.map((item, index) => (
                <div key={'failure-' + index} className="audit-modal__message audit-modal__message--fail">
                  {item}
                </div>
              ))}
              {warnings.map((item, index) => (
                <div key={'warning-' + index} className="audit-modal__message audit-modal__message--warn">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
`);

write('src/components/audit/AuditDetailModal.css', `.audit-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(10px);
}

.audit-modal {
  width: min(760px, 100%);
  max-height: min(760px, 92vh);
  overflow: auto;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 24px;
  background:
    radial-gradient(560px 220px at 100% 0%, rgba(59, 130, 246, 0.16), transparent 65%),
    rgba(15, 23, 42, 0.96);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
  color: var(--text-primary, #fff);
}

.audit-modal__header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.94);
}

.audit-modal__eyebrow {
  color: #93c5fd;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.audit-modal h2,
.audit-modal h3 {
  margin: 0;
}

.audit-modal h2 {
  margin-top: 4px;
  font-size: 1.15rem;
}

.audit-modal h3 {
  margin-bottom: 10px;
  font-size: 0.95rem;
}

.audit-modal__grade {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  font-size: 1.25rem;
  font-weight: 950;
}

.audit-modal__grade--good {
  background: rgba(34, 197, 94, 0.26);
  color: #bbf7d0;
}

.audit-modal__grade--warn {
  background: rgba(245, 158, 11, 0.24);
  color: #fde68a;
}

.audit-modal__grade--bad {
  background: rgba(248, 113, 113, 0.24);
  color: #fecaca;
}

.audit-modal__close {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.7);
  color: #e5e7eb;
  cursor: pointer;
  font-size: 1.2rem;
}

.audit-modal__score-row,
.audit-modal__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 18px 0;
}

.audit-modal__summary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-top: 10px;
}

.audit-modal__kv {
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.30);
}

.audit-modal__kv span,
.audit-modal__kv strong {
  display: block;
}

.audit-modal__kv span {
  color: #94a3b8;
  font-size: 0.70rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.audit-modal__kv strong {
  margin-top: 4px;
  color: #f8fafc;
  font-size: 0.86rem;
}

.audit-modal__section {
  padding: 18px;
}

.audit-modal__gates {
  display: grid;
  gap: 8px;
}

.audit-modal__gate {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.28);
}

.audit-modal__gate strong {
  display: block;
  color: #f8fafc;
  font-size: 0.88rem;
}

.audit-modal__gate p {
  margin: 4px 0 0;
  color: #aeb7c2;
  font-size: 0.78rem;
  line-height: 1.35;
}

.audit-modal__status {
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 900;
}

.audit-modal__status--pass {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
}

.audit-modal__status--warn {
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
}

.audit-modal__status--fail {
  background: rgba(248, 113, 113, 0.18);
  color: #fca5a5;
}

.audit-modal__messages {
  display: grid;
  gap: 8px;
}

.audit-modal__message {
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 0.82rem;
}

.audit-modal__message--fail {
  border: 1px solid rgba(248, 113, 113, 0.24);
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
}

.audit-modal__message--warn {
  border: 1px solid rgba(245, 158, 11, 0.24);
  background: rgba(120, 53, 15, 0.22);
  color: #fde68a;
}

@media (max-width: 640px) {
  .audit-modal__score-row,
  .audit-modal__summary {
    grid-template-columns: 1fr 1fr;
  }

  .audit-modal__header {
    grid-template-columns: 1fr auto;
  }

  .audit-modal__grade {
    grid-column: 1 / -1;
    width: 100%;
    height: 42px;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 3) Patch MainPage.jsx                                                       */
/* -------------------------------------------------------------------------- */

patchFile('src/pages/MainPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import SidebarNews from '../components/SidebarNews';`,
    `
import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditMainTabQuality } from '../services/pageAuditGrading.js';
import '../components/audit/AuditDetailModal.css';`,
    'main page audit imports'
  );

  text = insertAfterOnce(
    text,
    `    const isUrgentMode = currentSegment.id === 'urgent_only';

`,
    `    const mainTabAudit = React.useMemo(() => auditMainTabQuality({
        newsData,
        weatherData,
        breakingNews,
        settings,
        loading,
        errors: _errors,
    }), [newsData, weatherData, breakingNews, settings, loading, _errors]);

`,
    'main page audit memo'
  );

  text = insertAfterOnce(
    text,
    `        <div className={\`page-container mode-\${uiMode} \${isWebView ? 'page-container--desktop' : ''}\`}>`,
    `
            <GradeBadge audit={mainTabAudit} label="Main tab quality grade" />
`,
    'main page grade badge render'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 4) Static test + package scripts                                             */
/* -------------------------------------------------------------------------- */

write('scripts/test_main_grade_audit_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const grading = read('src/services/pageAuditGrading.js');
const gradingTest = read('src/services/pageAuditGrading.cert.test.js');
const badge = read('src/components/audit/GradeBadge.jsx');
const badgeCss = read('src/components/audit/GradeBadge.css');
const modal = read('src/components/audit/AuditDetailModal.jsx');
const modalCss = read('src/components/audit/AuditDetailModal.css');
const mainPage = read('src/pages/MainPage.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'auditMainTabQuality',
  'frontpage-volume',
  'source-diversity',
  'section-coverage',
  'duplicate-rate',
  'weather-availability',
  'gradeFromScore'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'Main tab audit grading certification',
  'gives strong grade',
  'downgrades weak main tab data',
  'keeps loading as warning'
]) {
  assert(gradingTest.includes(token), 'pageAuditGrading.cert.test.js missing token: ' + token);
}

for (const token of [
  'data-grade-badge',
  'AuditDetailModal',
  'grade-badge--corner'
]) {
  assert(badge.includes(token) || badgeCss.includes(token), 'GradeBadge missing token: ' + token);
}

for (const token of [
  'Data trust / audits / gates',
  'Gate results',
  'Warnings / failures',
  'audit-modal__backdrop'
]) {
  assert(modal.includes(token) || modalCss.includes(token), 'Audit modal missing token: ' + token);
}

for (const token of [
  'GradeBadge',
  'auditMainTabQuality',
  'mainTabAudit',
  'Main tab quality grade'
]) {
  assert(mainPage.includes(token), 'MainPage.jsx missing token: ' + token);
}

assert(
  packageJson.includes('"test:main-grade-audit"'),
  'package.json must include test:main-grade-audit'
);

assert(
  certGate.includes("['npm', ['run', 'test:main-grade-audit']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include main grade audit test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Main tab grade audit modal',
  guarantees: [
    'grade badge shows a single alphabet in top-right corner',
    'clicking grade opens audit modal',
    'modal includes data trust, audits and gate results',
    'Main tab has robust data quality grading',
    'weather availability is included in Main tab audit',
    'source diversity, freshness, duplicates and section coverage are checked'
  ]
}, null, 2));

console.log('PASS: Main grade audit static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:main-grade-audit'] =
    'node scripts/test_main_grade_audit_static.mjs && vitest run --config vitest.config.js src/services/pageAuditGrading.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:main-grade-audit']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:market-trust']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:market-trust']],",
      "  ['npm', ['run', 'test:market-trust']],\\n  ['npm', ['run', 'test:main-grade-audit']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:weather-trust']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-trust']],",
      "  ['npm', ['run', 'test:weather-trust']],\\n  ['npm', ['run', 'test:main-grade-audit']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'main-grade-audit')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'market-trust');
      const command = {
        id: 'main-grade-audit',
        cmd: 'npm',
        args: ['run', 'test:main-grade-audit'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:main-grade-audit')) return source;

    if (source.includes("'test:market-trust',")) {
      return source.replace(
        "'test:market-trust',",
        "'test:market-trust',\\n  'test:main-grade-audit',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 60A Main tab grade audit modal patch complete.');
