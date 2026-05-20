// Plain Node ratchet core — no TypeScript imports
import fs from 'node:fs';
import path from 'node:path';

const REPORT_PATH = path.resolve('public/newsdata/real_insight_quality_report.json');

export function loadRealInsightQualityReport() {
  if (!fs.existsSync(REPORT_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function runRatchetOnReport(report) {
  if (!report) {
    return { passed: false, grade: 'F', reason: 'No report found', failures: ['No report found'] };
  }

  const failures = [];
  const grade = report.grade ?? 'F';

  if (grade === 'D' || grade === 'F') {
    failures.push(`Grade ${grade} is below ratchet floor`);
  }

  const parents = report.parents ?? [];
  const top = parents[0];
  if (top) {
    if ((top.angles ?? []).length <= 1) {
      failures.push('Top parent has single angle');
    }
    if (top.weakTree) {
      failures.push('Top parent is weak tree');
    }
  }

  return {
    passed: failures.length === 0,
    grade,
    reason: failures.length === 0 ? 'Ratchet passed' : failures[0],
    failures,
  };
}
