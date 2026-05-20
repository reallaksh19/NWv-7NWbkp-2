export interface RatchetGateResult {
  passed: boolean;
  grade: string;
  reason: string;
  failures: string[];
}

export type GradeLevel = 'A' | 'B' | 'C' | 'D' | 'F';

export function runInsightRealSnapshotQualityRatchet(report: {
  grade?: string;
  parentCount?: number;
  multiAngleCount?: number;
  weakParentCount?: number;
  parents?: { weakTree?: boolean; angles?: string[] }[];
}): RatchetGateResult {
  const failures: string[] = [];
  const grade = (report.grade ?? 'F') as GradeLevel;

  if (grade === 'D' || grade === 'F') {
    failures.push(`Grade ${grade} is below ratchet floor (must be C or above)`);
  }

  const parents = report.parents ?? [];
  const topParent = parents[0];
  if (topParent) {
    const angles = topParent.angles ?? [];
    if (angles.length <= 1) {
      failures.push('Top parent has only a single angle — ratchet requires multi-angle top result');
    }
    if (topParent.weakTree) {
      failures.push('Top parent is a weak tree — ratchet requires strong top result');
    }
  }

  return {
    passed: failures.length === 0,
    grade,
    reason: failures.length === 0 ? 'All ratchet checks passed' : failures[0],
    failures,
  };
}
