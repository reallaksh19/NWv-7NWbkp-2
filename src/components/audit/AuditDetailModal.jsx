import { useEffect, useMemo, useState } from 'react';
import {
  buildAuditFileName,
  getGradeExplanation,
  stringifyAuditExport,
} from '../../services/auditExport.js';

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

function GradeMeaning({ grade }) {
  const explanation = getGradeExplanation(grade);

  return (
    <div className="audit-modal__grade-meaning" data-audit-grade-meaning={grade || 'F'}>
      <strong>{grade || 'F'} — {explanation.label}</strong>
      <span>{explanation.description}</span>
      <em>{explanation.action}</em>
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
  const [actionMessage, setActionMessage] = useState('');

  const gates = Array.isArray(audit?.gates) ? audit.gates : [];
  const warnings = Array.isArray(audit?.warnings) ? audit.warnings : [];
  const failures = Array.isArray(audit?.failures) ? audit.failures : [];
  const summary = audit?.summary || {};
  const moreDiagnostics = useMemo(
    () => normalizeMoreDiagnostics(audit?.moreDiagnostics),
    [audit]
  );

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function copyAuditJson() {
    const text = stringifyAuditExport(audit);

    try {
      await navigator.clipboard.writeText(text);
      setActionMessage('Audit JSON copied.');
    } catch {
      setActionMessage('Copy failed. Use Download JSON instead.');
    }
  }

  function downloadAuditJson() {
    try {
      const text = stringifyAuditExport(audit);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildAuditFileName(audit);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setActionMessage('Audit JSON downloaded.');
    } catch {
      setActionMessage('Download failed.');
    }
  }

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

        <div className="audit-modal__actions-row">
          <GradeMeaning grade={audit?.grade || 'F'} />

          <div className="audit-modal__actions">
            <button type="button" onClick={copyAuditJson} data-audit-copy-json="true">
              Copy audit JSON
            </button>
            <button type="button" onClick={downloadAuditJson} data-audit-download-json="true">
              Download JSON
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="audit-modal__action-message" role="status">
            {actionMessage}
          </div>
        )}

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
