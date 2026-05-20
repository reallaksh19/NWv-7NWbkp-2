import React from 'react';
import './InsightQualityDashboard.css';

const GRADE_COLORS = {
  A: '#22c55e',
  B: '#86efac',
  C: '#fbbf24',
  D: '#f97316',
  F: '#ef4444',
};

export function InsightQualityDashboard({ dashboardData }) {
  if (!dashboardData || dashboardData.status === 'NO_DATA') {
    return <div className="iqd-empty">No quality data available</div>;
  }

  const { grade, summary, rows } = dashboardData;
  const color = GRADE_COLORS[grade] ?? '#94a3b8';

  return (
    <div className="iqd-root">
      <div className="iqd-header">
        <span className="iqd-grade" style={{ color }}>Grade: {grade}</span>
        <span className="iqd-pct">{summary.goodParentPct}% good parents</span>
      </div>
      <div className="iqd-stats">
        <span>Total: {summary.totalParents}</span>
        <span>Weak trees: {summary.weakTreeCount}</span>
        <span>Single angle: {summary.singleAngleCount}</span>
        <span>Single source: {summary.singleSourceCount}</span>
      </div>
      {rows.length > 0 && (
        <ul className="iqd-rows">
          {rows.map(r => (
            <li key={r.parentId} className={`iqd-row iqd-row-${r.grade}`}>
              <span className="iqd-row-grade">{r.grade}</span>
              <span className="iqd-row-headline">{r.headline}</span>
              {r.rcaCauses.length > 0 && (
                <span className="iqd-row-causes">{r.rcaCauses.join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default InsightQualityDashboard;
