import { useEffect, useState } from 'react';
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
      className={`newsdata-runtime newsdata-runtime--${status.tone}${compact ? ' newsdata-runtime--compact' : ''}`}
      data-newsdata-runtime-status={status.status}
    >
      <div className="newsdata-runtime__header">
        <div>
          <div className="newsdata-runtime__eyebrow">Newsdata runtime</div>
          <h2>{status.status === 'PASS' ? 'Static newsdata healthy' : 'Static newsdata needs attention'}</h2>
          <p>
            Collector JSON, section JSON, source policy and Pages deployment checks are combined here.
            {status.rawFallbackUsed ? ' Raw JSON fallback active.' : ''}
          </p>
        </div>
        <div className="newsdata-runtime__badge">{status.status}</div>
      </div>

      <div className="newsdata-runtime__grid">
        <div className="newsdata-runtime__card">
          <h3>Insight</h3>
          <div className={`newsdata-runtime__pill newsdata-runtime__pill--${status.insight.tone}`}>
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
          <div className={`newsdata-runtime__pill newsdata-runtime__pill--${status.sections.tone}`}>
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
          <div className={`newsdata-runtime__pill newsdata-runtime__pill--${status.pages.tone}`}>
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
          <div className={`newsdata-runtime__pill newsdata-runtime__pill--${status.sourcePolicy.tone}`}>
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
            <div key={`error-${index}`} className="newsdata-runtime__message newsdata-runtime__message--error">
              {message}
            </div>
          ))}
          {status.warnings.slice(0, 4).map((message, index) => (
            <div key={`warning-${index}`} className="newsdata-runtime__message newsdata-runtime__message--warning">
              {message}
            </div>
          ))}
          {status.missingReports.slice(0, 3).map(report => (
            <div key={report.key} className="newsdata-runtime__message newsdata-runtime__message--missing">
              {/* Fallback REPORT: raw JSON used when quality report is missing */}
              Missing REPORT: {report.key} — {report.error}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
