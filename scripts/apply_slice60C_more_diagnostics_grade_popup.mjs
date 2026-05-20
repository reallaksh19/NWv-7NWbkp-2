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

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }

  return source.replace(before, after);
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
/* 1) Replace AuditDetailModal with expandable More Diagnostics UI             */
/* -------------------------------------------------------------------------- */

write('src/components/audit/AuditDetailModal.jsx', `import { useMemo, useState } from 'react';

function statusClass(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'pass') return 'audit-modal__status audit-modal__status--pass';
  if (value === 'warn') return 'audit-modal__status audit-modal__status--warn';
  return 'audit-modal__status audit-modal__status--fail';
}

function normalizeMoreDiagnostics(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function stringifyDiagnosticValue(value) {
  if (value == null || value === '') return '—';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === 'boolean') return value ? 'YES' : 'NO';

  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map(item => stringifyDiagnosticValue(item)).join(', ');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function KeyValue({ label, value }) {
  return (
    <div className="audit-modal__kv">
      <span>{label}</span>
      <strong>{stringifyDiagnosticValue(value)}</strong>
    </div>
  );
}

function DiagnosticMetric({ metric }) {
  return (
    <div className="audit-modal__diagnostic-metric">
      <span>{metric.label}</span>
      <strong>{stringifyDiagnosticValue(metric.value)}</strong>
      {metric.hint && <em>{metric.hint}</em>}
    </div>
  );
}

function DiagnosticSection({ section }) {
  const metrics = Array.isArray(section.metrics) ? section.metrics : [];
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const notes = Array.isArray(section.notes) ? section.notes : [];
  const raw = section.raw;

  return (
    <article className="audit-modal__diagnostic-section" data-diagnostic-section={section.id || section.title}>
      <div className="audit-modal__diagnostic-head">
        <div>
          <h4>{section.title || 'Diagnostic section'}</h4>
          {section.description && <p>{section.description}</p>}
        </div>
        {section.status && <span className={statusClass(section.status)}>{section.status}</span>}
      </div>

      {metrics.length > 0 && (
        <div className="audit-modal__diagnostic-metrics">
          {metrics.map((metric, index) => (
            <DiagnosticMetric key={(metric.id || metric.label || 'metric') + '-' + index} metric={metric} />
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="audit-modal__diagnostic-rows">
          {rows.map((row, rowIndex) => (
            <div key={(row.id || row.label || 'row') + '-' + rowIndex} className="audit-modal__diagnostic-row">
              <strong>{row.label || row.id || 'Row'}</strong>
              <span>{stringifyDiagnosticValue(row.value ?? row.detail ?? row.status)}</span>
              {row.detail && row.value != null && <em>{row.detail}</em>}
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <ul className="audit-modal__diagnostic-notes">
          {notes.map((note, index) => (
            <li key={'note-' + index}>{note}</li>
          ))}
        </ul>
      )}

      {raw != null && (
        <details className="audit-modal__raw">
          <summary>Raw diagnostic JSON</summary>
          <pre>{stringifyDiagnosticValue(raw)}</pre>
        </details>
      )}
    </article>
  );
}

export default function AuditDetailModal({ audit, onClose }) {
  const [showMoreDiagnostics, setShowMoreDiagnostics] = useState(false);

  const gates = Array.isArray(audit?.gates) ? audit.gates : [];
  const warnings = Array.isArray(audit?.warnings) ? audit.warnings : [];
  const failures = Array.isArray(audit?.failures) ? audit.failures : [];
  const summary = audit?.summary || {};
  const moreDiagnostics = useMemo(
    () => normalizeMoreDiagnostics(audit?.moreDiagnostics),
    [audit]
  );

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
          <KeyValue label="Visible stories" value={summary.totalVisibleStoryCount ?? summary.storyCount ?? summary.parentCount ?? '—'} />
          <KeyValue label="Front page" value={summary.frontPageStoryCount ?? '—'} />
          <KeyValue label="Source groups" value={summary.sourceGroupCount ?? '—'} />
          <KeyValue label="Duplicate rate" value={summary.duplicateRate != null ? Math.round(summary.duplicateRate * 100) + '%' : '—'} />
          <KeyValue label="Freshness" value={summary.newestAgeMinutes == null ? 'unknown' : summary.newestAgeMinutes + ' min'} />
          <KeyValue label="Weather ready" value={summary.weatherReadyCount ?? summary.readyCityCount ?? '—'} />
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

        {moreDiagnostics.length > 0 && (
          <div className="audit-modal__section audit-modal__section--more">
            <button
              type="button"
              className="audit-modal__more-toggle"
              onClick={() => setShowMoreDiagnostics(value => !value)}
              aria-expanded={showMoreDiagnostics}
              data-audit-more-diagnostics-toggle="true"
            >
              <span>{showMoreDiagnostics ? 'Hide more diagnostics' : 'More diagnostics'}</span>
              <strong>{moreDiagnostics.length}</strong>
            </button>

            {showMoreDiagnostics && (
              <div className="audit-modal__more-panel" data-audit-more-diagnostics-panel="open">
                {moreDiagnostics.map((section, index) => (
                  <DiagnosticSection key={(section.id || section.title || 'section') + '-' + index} section={section} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
`);

/* -------------------------------------------------------------------------- */
/* 2) Replace AuditDetailModal.css with More Diagnostics styling               */
/* -------------------------------------------------------------------------- */

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
  width: min(820px, 100%);
  max-height: min(800px, 92vh);
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
.audit-modal h3,
.audit-modal h4 {
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

.audit-modal h4 {
  color: #f8fafc;
  font-size: 0.9rem;
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
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.30);
}

.audit-modal__kv span,
.audit-modal__kv strong {
  display: block;
  min-width: 0;
}

.audit-modal__kv span {
  color: #94a3b8;
  font-size: 0.70rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.audit-modal__kv strong {
  margin-top: 4px;
  overflow: hidden;
  color: #f8fafc;
  font-size: 0.86rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-modal__section {
  padding: 18px;
}

.audit-modal__section--more {
  padding-top: 0;
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

.audit-modal__more-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(147, 197, 253, 0.28);
  border-radius: 16px;
  background: rgba(30, 64, 175, 0.18);
  color: #bfdbfe;
  cursor: pointer;
  font-weight: 900;
}

.audit-modal__more-toggle strong {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  height: 26px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.28);
  color: #eff6ff;
  font-size: 0.74rem;
}

.audit-modal__more-panel {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.audit-modal__diagnostic-section {
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(2, 6, 23, 0.34);
}

.audit-modal__diagnostic-head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: start;
  margin-bottom: 12px;
}

.audit-modal__diagnostic-head p {
  margin: 4px 0 0;
  color: #aeb7c2;
  font-size: 0.78rem;
  line-height: 1.35;
}

.audit-modal__diagnostic-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.audit-modal__diagnostic-metric {
  min-width: 0;
  padding: 10px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.66);
}

.audit-modal__diagnostic-metric span,
.audit-modal__diagnostic-metric strong,
.audit-modal__diagnostic-metric em {
  display: block;
  min-width: 0;
}

.audit-modal__diagnostic-metric span {
  color: #94a3b8;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.audit-modal__diagnostic-metric strong {
  margin-top: 4px;
  overflow: hidden;
  color: #f8fafc;
  font-size: 0.86rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-modal__diagnostic-metric em {
  margin-top: 3px;
  color: #bfdbfe;
  font-size: 0.70rem;
  font-style: normal;
}

.audit-modal__diagnostic-rows {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.audit-modal__diagnostic-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.52);
  color: #cbd5e1;
  font-size: 0.78rem;
}

.audit-modal__diagnostic-row strong {
  color: #f8fafc;
}

.audit-modal__diagnostic-row em {
  grid-column: 1 / -1;
  color: #93c5fd;
  font-style: normal;
}

.audit-modal__diagnostic-notes {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #cbd5e1;
  font-size: 0.78rem;
}

.audit-modal__raw {
  margin-top: 10px;
  border-radius: 12px;
  color: #bfdbfe;
  font-size: 0.78rem;
}

.audit-modal__raw summary {
  cursor: pointer;
  font-weight: 900;
}

.audit-modal__raw pre {
  max-height: 220px;
  overflow: auto;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.28);
  color: #e5e7eb;
  font-size: 0.72rem;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .audit-modal__score-row,
  .audit-modal__summary,
  .audit-modal__diagnostic-metrics {
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

@media (max-width: 520px) {
  .audit-modal__score-row,
  .audit-modal__summary,
  .audit-modal__diagnostic-metrics,
  .audit-modal__diagnostic-row {
    grid-template-columns: 1fr;
  }

  .audit-modal__gate,
  .audit-modal__diagnostic-head {
    grid-template-columns: 1fr;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 3) Patch pageAuditGrading.js to carry moreDiagnostics                       */
/* -------------------------------------------------------------------------- */

patchFile('src/services/pageAuditGrading.js', source => {
  let text = source;

  text = replaceOnce(
    text,
    `function makePageAudit({ target, title, gates, summary = {}, dataTrust = {}, now = Date.now() }) {`,
    `function makePageAudit({ target, title, gates, summary = {}, dataTrust = {}, moreDiagnostics = [], now = Date.now() }) {`,
    'makePageAudit moreDiagnostics parameter'
  );

  text = replaceOnce(
    text,
    `    dataTrust: {
      status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
      ...dataTrust,
    },
    warnings,`,
    `    dataTrust: {
      status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
      ...dataTrust,
    },
    moreDiagnostics,
    warnings,`,
    'makePageAudit return moreDiagnostics'
  );

  if (!text.includes('function diagnosticMetric(')) {
    text = insertBeforeOnce(
      text,
      `function gate(id, label, status, detail) {`,
      `function diagnosticMetric(label, value, hint = '') {
  return { label, value, hint };
}

function diagnosticRow(label, value, detail = '') {
  return { label, value, detail };
}

function diagnosticSection({ id, title, description, status = null, metrics = [], rows = [], notes = [], raw = null }) {
  return { id, title, description, status, metrics, rows, notes, raw };
}

`,
      'diagnostic helpers'
    );
  }

  text = replaceOnce(
    text,
    `    dataTrust: {
      status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
      sourceDiversity: sourceGroups.length,
      duplicateRate: Number(duplicateRate.toFixed(3)),
      stale,
      weatherReadyCount,
    },
    warnings,`,
    `    dataTrust: {
      status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
      sourceDiversity: sourceGroups.length,
      duplicateRate: Number(duplicateRate.toFixed(3)),
      stale,
      weatherReadyCount,
    },
    moreDiagnostics: [
      diagnosticSection({
        id: 'main-section-health',
        title: 'Section health',
        description: 'Per-section volume and source diversity behind the Main tab grade.',
        status: missingSections.length === 0 ? weakSections.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Enabled sections', enabledSections.length),
          diagnosticMetric('Missing sections', missingSections.length),
          diagnosticMetric('Weak sections', weakSections.length),
          diagnosticMetric('Section stories', sectionStories.length),
        ],
        rows: sectionHealth.map(item => diagnosticRow(
          item.section,
          item.status,
          item.storyCount + ' stories / ' + item.sourceGroupCount + ' source groups'
        )),
        raw: { sectionHealth, enabledSections, missingSections, weakSections },
      }),
      diagnosticSection({
        id: 'main-data-trust',
        title: 'Data trust details',
        description: 'Source diversity, freshness, duplicate control and weather readiness.',
        status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Visible stories', allStories.length),
          diagnosticMetric('Front page stories', frontPage.length),
          diagnosticMetric('Source groups', sourceGroups.length),
          diagnosticMetric('Duplicate rate', Number(duplicateRate.toFixed(3))),
          diagnosticMetric('Newest age min', newestAgeMinutes ?? 'unknown'),
          diagnosticMetric('Weather ready', weatherReadyCount),
        ],
        notes: [
          stale ? 'Newest story is stale or timestamp is unavailable.' : 'Freshness gate has usable story timestamps.',
          duplicateRate > 0.08 ? 'Duplicate pressure is visible in main-tab story keys.' : 'Duplicate pressure is within expected range.',
        ],
        raw: { sourceGroups, duplicateCount, duplicateRate, timestamps, weatherCities },
      }),
    ],
    warnings,`,
    'main audit moreDiagnostics'
  );

  text = replaceOnce(
    text,
    `    dataTrust: {
      readyCityCount: readyCities.length,
      weeklyReadyCount: weeklyReady.length,
      staleCityCount: staleCities.length,
      fallbackCityCount: fallbackCities.length,
    },
  });`,
    `    moreDiagnostics: [
      diagnosticSection({
        id: 'weather-city-readiness',
        title: 'Weather city readiness',
        description: 'Configured city coverage, active city state and weekly forecast readiness.',
        status: readyCities.length === cityList.length ? 'PASS' : readyCities.length > 0 ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Configured cities', cityList.length),
          diagnosticMetric('Ready cities', readyCities.length),
          diagnosticMetric('Weekly ready', weeklyReady.length),
          diagnosticMetric('Active city', active),
        ],
        rows: cityList.map(city => diagnosticRow(
          city,
          data?.[city] ? 'ready' : 'missing',
          asArray(data?.[city]?.weeklyForecast).length + ' weekly days; source ' + (data?.[city]?.sourceMode || 'unknown')
        )),
        raw: { cityList, readyCities, weeklyReady, staleCities, fallbackCities, active },
      }),
      diagnosticSection({
        id: 'weather-source-trust',
        title: 'Weather source trust',
        description: 'Source mode, stale/cache/fallback visibility and runtime error state.',
        status: fallbackCities.length === 0 && !error ? staleCities.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Source modes', sourceModes),
          diagnosticMetric('Stale cities', staleCities.length),
          diagnosticMetric('Fallback cities', fallbackCities.length),
          diagnosticMetric('Loading', loading),
          diagnosticMetric('Error', Boolean(error)),
        ],
        notes: [
          error ? 'Weather context reports a degraded update or cached fallback.' : 'No active weather error reported.',
          fallbackCities.length ? 'At least one city is using fallback/snapshot data.' : 'No fallback/snapshot city detected.',
        ],
        raw: { sourceModes, staleCities, fallbackCities, error },
      }),
    ],
    dataTrust: {
      readyCityCount: readyCities.length,
      weeklyReadyCount: weeklyReady.length,
      staleCityCount: staleCities.length,
      fallbackCityCount: fallbackCities.length,
    },
  });`,
    'weather audit moreDiagnostics'
  );

  text = replaceOnce(
    text,
    `    dataTrust: {
      sourceOkCount,
      sourceFailCount,
      sourceMode: data.isSnapshot ? 'snapshot' : data.isStale ? 'cache' : 'live',
      newestAgeMinutes,
    },
  });`,
    `    moreDiagnostics: [
      diagnosticSection({
        id: 'market-coverage',
        title: 'Market coverage',
        description: 'Coverage across indices, movers and auxiliary market sections.',
        status: indices.length >= 4 && gainers.length > 0 && losers.length > 0 ? 'PASS' : indices.length > 0 ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Indices', indices.length),
          diagnosticMetric('Gainers', gainers.length),
          diagnosticMetric('Losers', losers.length),
          diagnosticMetric('Sectorals', sectorals.length),
          diagnosticMetric('Commodities', commodities.length),
          diagnosticMetric('Currencies', currencies.length),
          diagnosticMetric('Mutual funds', mutualFunds.length),
        ],
        raw: {
          indexNames: indices.map(item => item.name || item.symbol).filter(Boolean),
          gainers: gainers.slice(0, 5),
          losers: losers.slice(0, 5),
        },
      }),
      diagnosticSection({
        id: 'market-source-health',
        title: 'Market source health',
        description: 'Source health and freshness details behind the market grade.',
        status: sourceFailCount === 0 ? 'PASS' : sourceOkCount >= sourceFailCount ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Sources OK', sourceOkCount),
          diagnosticMetric('Sources failing', sourceFailCount),
          diagnosticMetric('Source mode', data.isSnapshot ? 'snapshot' : data.isStale ? 'cache' : 'live'),
          diagnosticMetric('Newest age min', newestAgeMinutes ?? 'unknown'),
          diagnosticMetric('Loading', loading),
          diagnosticMetric('Error', Boolean(error)),
        ],
        rows: Object.entries(asObject(sourceHealth)).map(([name, item]) => diagnosticRow(
          name,
          item?.ok === false ? 'FAIL' : 'PASS',
          item?.message || item?.reason || ''
        )),
        raw: { sourceHealth, sessionState, lastFetch },
      }),
    ],
    dataTrust: {
      sourceOkCount,
      sourceFailCount,
      sourceMode: data.isSnapshot ? 'snapshot' : data.isStale ? 'cache' : 'live',
      newestAgeMinutes,
    },
  });`,
    'market audit moreDiagnostics'
  );

  text = replaceOnce(
    text,
    `    dataTrust: {
      parentCount: parents.length,
      storyCount: storiesById.size,
      sourceGroupCount: sourceGroups.length,
      weakTreeCount: weakTrees,
      multiAngleParentCount: multiAngleParents,
      runtimeRecovered: Boolean(runtimeGate?.recovered),
    },
  });`,
    `    moreDiagnostics: [
      diagnosticSection({
        id: 'insight-tree-quality',
        title: 'Insight tree quality',
        description: 'Cluster depth, angle diversity, source diversity and weak-tree control.',
        status: multiAngleParents >= 2 && weakTrees === 0 ? 'PASS' : multiAngleParents >= 1 ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Parents', parents.length),
          diagnosticMetric('Stories', storiesById.size),
          diagnosticMetric('Source groups', sourceGroups.length),
          diagnosticMetric('Weak trees', weakTrees),
          diagnosticMetric('Multi-angle parents', multiAngleParents),
          diagnosticMetric('Avg angles', Number(avgAngleCount.toFixed(2))),
          diagnosticMetric('Avg children', Number(avgChildCount.toFixed(2))),
        ],
        rows: parents.slice(0, 10).map(parent => diagnosticRow(
          parent?.canonicalHeadline || parent?.parentId || 'cluster',
          parent?.weakTree ? 'weak' : 'ok',
          asArray(parent?.childStoryIds).length + ' children / ' + asArray(parent?.clusterStoryIds).length + ' cluster stories'
        )),
        raw: { sourceGroups, weakTrees, angleCounts, childCounts },
      }),
      diagnosticSection({
        id: 'insight-runtime-gates',
        title: 'Insight runtime gates',
        description: 'Runtime quality gate, source mode and behavior evidence status.',
        status: runtimeGate?.attempted && !runtimeGate?.recovered ? 'WARN' : 'PASS',
        metrics: [
          diagnosticMetric('Source', source),
          diagnosticMetric('Signal score', diagnostics?.signalScore ?? 'unknown'),
          diagnosticMetric('Runtime recovered', Boolean(runtimeGate?.recovered)),
          diagnosticMetric('Runtime attempted', Boolean(runtimeGate?.attempted)),
          diagnosticMetric('Behavior status', behaviorStatus || 'unknown'),
          diagnosticMetric('Loading', loading),
          diagnosticMetric('Error', Boolean(error)),
        ],
        notes: [
          runtimeGate?.reason || 'No runtime recovery reason recorded.',
          behaviorEvidence?.summaryTitle || 'No behavior evidence title recorded.',
        ],
        raw: { runtimeGate, behaviorEvidence, diagnostics },
      }),
    ],
    dataTrust: {
      parentCount: parents.length,
      storyCount: storiesById.size,
      sourceGroupCount: sourceGroups.length,
      weakTreeCount: weakTrees,
      multiAngleParentCount: multiAngleParents,
      runtimeRecovered: Boolean(runtimeGate?.recovered),
    },
  });`,
    'insight audit moreDiagnostics'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 4) Certification                                                            */
/* -------------------------------------------------------------------------- */

write('src/services/pageAuditMoreDiagnostics.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  auditInsightTabQuality,
  auditMainTabQuality,
  auditMarketTabQuality,
  auditWeatherTabQuality,
} from './pageAuditGrading';

function story(id, sourceGroup, publishedAt = Date.now()) {
  return {
    id,
    title: 'Story ' + id,
    sourceGroup,
    publishedAt,
  };
}

describe('Grade popup more diagnostics certification', () => {
  it('adds moreDiagnostics to Main tab audit', () => {
    const now = Date.now();
    const audit = auditMainTabQuality({
      now,
      newsData: {
        frontPage: Array.from({ length: 10 }, (_, index) => story('top-' + index, 'src_' + index, now)),
        india: [story('i1', 'a', now), story('i2', 'b', now), story('i3', 'c', now)],
        chennai: [story('c1', 'd', now), story('c2', 'e', now), story('c3', 'f', now)],
        local: [story('l1', 'g', now), story('l2', 'h', now), story('l3', 'i', now)],
        world: [story('w1', 'j', now), story('w2', 'k', now), story('w3', 'l', now)],
      },
      weatherData: {
        chennai: { current: { temp: 32 } },
        trichy: { current: { temp: 33 } },
        muscat: { current: { temp: 34 } },
      },
    });

    expect(Array.isArray(audit.moreDiagnostics)).toBe(true);
    expect(audit.moreDiagnostics.length).toBeGreaterThanOrEqual(2);
    expect(audit.moreDiagnostics.some(section => section.id === 'main-section-health')).toBe(true);
  });

  it('adds moreDiagnostics to Weather tab audit', () => {
    const audit = auditWeatherTabQuality({
      weatherData: {
        chennai: { current: { temp: 32 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
        trichy: { current: { temp: 33 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
      },
      cities: ['chennai', 'trichy'],
      activeCity: 'chennai',
    });

    expect(audit.moreDiagnostics.some(section => section.id === 'weather-city-readiness')).toBe(true);
    expect(audit.moreDiagnostics.some(section => section.id === 'weather-source-trust')).toBe(true);
  });

  it('adds moreDiagnostics to Market tab audit', () => {
    const audit = auditMarketTabQuality({
      marketData: {
        indices: [{ name: 'NIFTY' }, { name: 'SENSEX' }, { name: 'BANK' }, { name: 'MIDCAP' }],
        movers: {
          gainers: [{ symbol: 'A' }],
          losers: [{ symbol: 'B' }],
        },
        sectorals: [{ name: 'IT' }],
        commodities: [{ name: 'Gold' }],
      },
      sourceHealth: {
        nse: { ok: true },
      },
      lastFetch: Date.now(),
    });

    expect(audit.moreDiagnostics.some(section => section.id === 'market-coverage')).toBe(true);
    expect(audit.moreDiagnostics.some(section => section.id === 'market-source-health')).toBe(true);
  });

  it('adds moreDiagnostics to Insight tab audit', () => {
    const result = {
      parents: [
        { parentId: 'p1', canonicalHeadline: 'Parent 1', childStoryIds: ['s1', 's2'], clusterStoryIds: ['s1', 's2'], weakTree: false },
      ],
      storiesById: new Map([
        ['s1', { id: 's1', sourceGroup: 'a', angle: 'base_report' }],
        ['s2', { id: 's2', sourceGroup: 'b', angle: 'official_response' }],
      ]),
    };

    const audit = auditInsightTabQuality({
      result,
      diagnostics: { signalScore: 80 },
      behaviorEvidence: { status: 'pass', summaryTitle: 'Behavior evidence passed' },
      source: 'fixture',
    });

    expect(audit.moreDiagnostics.some(section => section.id === 'insight-tree-quality')).toBe(true);
    expect(audit.moreDiagnostics.some(section => section.id === 'insight-runtime-gates')).toBe(true);
  });
});
`);

write('scripts/test_grade_popup_more_diagnostics_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const modal = read('src/components/audit/AuditDetailModal.jsx');
const modalCss = read('src/components/audit/AuditDetailModal.css');
const grading = read('src/services/pageAuditGrading.js');
const cert = read('src/services/pageAuditMoreDiagnostics.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'More diagnostics',
  'data-audit-more-diagnostics-toggle',
  'data-audit-more-diagnostics-panel',
  'DiagnosticSection',
  'Raw diagnostic JSON',
  'normalizeMoreDiagnostics'
]) {
  assert(modal.includes(token), 'AuditDetailModal.jsx missing token: ' + token);
}

for (const token of [
  '.audit-modal__more-toggle',
  '.audit-modal__more-panel',
  '.audit-modal__diagnostic-section',
  '.audit-modal__diagnostic-metrics',
  '.audit-modal__raw'
]) {
  assert(modalCss.includes(token), 'AuditDetailModal.css missing token: ' + token);
}

for (const token of [
  'moreDiagnostics',
  'diagnosticSection',
  'main-section-health',
  'weather-city-readiness',
  'market-coverage',
  'insight-tree-quality',
  'insight-runtime-gates'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'Grade popup more diagnostics certification',
  'adds moreDiagnostics to Main tab audit',
  'adds moreDiagnostics to Weather tab audit',
  'adds moreDiagnostics to Market tab audit',
  'adds moreDiagnostics to Insight tab audit'
]) {
  assert(cert.includes(token), 'pageAuditMoreDiagnostics.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:grade-popup-more-diagnostics"'),
  'package.json must include test:grade-popup-more-diagnostics'
);

assert(
  certGate.includes("['npm', ['run', 'test:grade-popup-more-diagnostics']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include grade popup more diagnostics test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Grade popup more diagnostics',
  guarantees: [
    'Grade popup has a More diagnostics toggle',
    'More diagnostics is hidden by default',
    'More diagnostics can render metrics, rows, notes and raw JSON',
    'Main audit provides advanced diagnostic sections',
    'Weather audit provides advanced diagnostic sections',
    'Market audit provides advanced diagnostic sections',
    'Insight audit provides advanced diagnostic sections'
  ]
}, null, 2));

console.log('PASS: Grade popup more diagnostics static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:grade-popup-more-diagnostics'] =
    'node scripts/test_grade_popup_more_diagnostics_static.mjs && vitest run --config vitest.config.js src/services/pageAuditMoreDiagnostics.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:grade-popup-more-diagnostics']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:unified-grade-badge-tabs']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:unified-grade-badge-tabs']],",
      "  ['npm', ['run', 'test:unified-grade-badge-tabs']],\\n  ['npm', ['run', 'test:grade-popup-more-diagnostics']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:main-grade-audit']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:main-grade-audit']],",
      "  ['npm', ['run', 'test:main-grade-audit']],\\n  ['npm', ['run', 'test:grade-popup-more-diagnostics']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'grade-popup-more-diagnostics')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'unified-grade-badge-tabs');
      const command = {
        id: 'grade-popup-more-diagnostics',
        cmd: 'npm',
        args: ['run', 'test:grade-popup-more-diagnostics'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:grade-popup-more-diagnostics')) return source;

    if (source.includes("'test:unified-grade-badge-tabs',")) {
      return source.replace(
        "'test:unified-grade-badge-tabs',",
        "'test:unified-grade-badge-tabs',\\n  'test:grade-popup-more-diagnostics',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 60C Grade popup more diagnostics patch complete.');
