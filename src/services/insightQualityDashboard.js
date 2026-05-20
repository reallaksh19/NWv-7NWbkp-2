// Insight quality dashboard data service

export function buildInsightQualityDashboardData(rca) {
  if (!rca) {
    return { status: 'NO_DATA', grade: null, summary: null, rows: [] };
  }

  const { gradeCounts, parentCount, weakTreeCount, singleAngleCount, singleSourceCount } = rca;
  const total = parentCount ?? 0;
  const aCount = gradeCounts?.A ?? 0;
  const bCount = gradeCounts?.B ?? 0;
  const goodCount = aCount + bCount;
  const pct = total > 0 ? Math.round((goodCount / total) * 100) : 0;

  let overallGrade = 'F';
  if (pct >= 90) overallGrade = 'A';
  else if (pct >= 75) overallGrade = 'B';
  else if (pct >= 50) overallGrade = 'C';
  else if (pct >= 25) overallGrade = 'D';

  return {
    status: 'OK',
    grade: overallGrade,
    summary: {
      totalParents: total,
      goodParentPct: pct,
      weakTreeCount: weakTreeCount ?? 0,
      singleAngleCount: singleAngleCount ?? 0,
      singleSourceCount: singleSourceCount ?? 0,
      gradeCounts: gradeCounts ?? {},
    },
    rows: (rca.rows ?? []).map(r => ({
      parentId: r.parentId,
      headline: r.headline,
      grade: r.grade,
      rcaCauses: r.rcaCauses,
    })),
  };
}

export function getInsightQualityDashboardStatus(dashboardData) {
  if (!dashboardData || dashboardData.status === 'NO_DATA') return 'NO_DATA';
  if (dashboardData.grade === 'A' || dashboardData.grade === 'B') return 'HEALTHY';
  if (dashboardData.grade === 'C') return 'WARNING';
  return 'DEGRADED';
}
