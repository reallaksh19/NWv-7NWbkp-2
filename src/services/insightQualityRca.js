// Insight Quality Root Cause Analysis metrics

export function buildInsightQualityRca(parents, storiesById, cfg) {
  const rows = parents.map(p => buildInsightClusterRcaRow(p, storiesById, cfg));
  const grades = rows.map(r => r.grade);
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const g of grades) if (g in gradeCounts) gradeCounts[g]++;

  return {
    capturedAt: new Date().toISOString(),
    parentCount: parents.length,
    gradeCounts,
    rows,
    weakTreeCount: rows.filter(r => r.weakTree).length,
    singleAngleCount: rows.filter(r => r.angleCount <= 1).length,
    singleSourceCount: rows.filter(r => r.sourceGroupCount <= 1).length,
  };
}

export function buildInsightClusterRcaRow(parent, storiesById, cfg) {
  const childIds = parent.childStoryIds || [];
  const angles = new Set();
  const sourceGroups = new Set();
  for (const id of childIds) {
    const s = storiesById.get(id);
    if (s) {
      if (s.angle) angles.add(s.angle);
      if (s.sourceGroup) sourceGroups.add(s.sourceGroup);
    }
  }
  const childCount = childIds.length;
  const weakTreeChildMin = cfg?.weakTreeChildMin ?? 2;
  const minSourcesPerTree = cfg?.minSourcesPerTree ?? 2;
  const weakTree = childCount < weakTreeChildMin;
  const sourceDeficit = sourceGroups.size < minSourcesPerTree;
  const angleCount = angles.size;
  const sourceGroupCount = sourceGroups.size;

  let grade = 'A';
  if (weakTree || sourceDeficit) grade = 'D';
  else if (angleCount <= 1) grade = 'C';
  else if (childCount < 3) grade = 'B';

  const rcaCauses = [];
  if (weakTree) rcaCauses.push('WEAK_TREE');
  if (sourceDeficit) rcaCauses.push('SOURCE_DEFICIT');
  if (angleCount <= 1) rcaCauses.push('SINGLE_ANGLE');
  if ((parent.debug?.hiddenCount ?? 0) > childCount) rcaCauses.push('DUPLICATE_PRESSURE');

  return {
    parentId: parent.id,
    headline: parent.headline,
    grade,
    childCount,
    angleCount,
    sourceGroupCount,
    weakTree,
    sourceDeficit,
    rcaCauses,
    hiddenCount: parent.debug?.hiddenCount ?? 0,
    scoreBreakdown: parent.debug?.scoreBreakdown ?? null,
    replacements: parent.debug?.replacements ?? 0,
  };
}

export function buildInsightImprovementPlan(rca) {
  const actions = [];
  const counts = rca.gradeCounts;
  if ((counts.D ?? 0) + (counts.F ?? 0) > 0) {
    actions.push({ priority: 1, action: 'REPAIR_WEAK_TREES', affectedCount: rca.weakTreeCount });
  }
  if (rca.singleSourceCount > 0) {
    actions.push({ priority: 2, action: 'ENFORCE_SOURCE_DIVERSITY', affectedCount: rca.singleSourceCount });
  }
  if (rca.singleAngleCount > 0) {
    actions.push({ priority: 3, action: 'ENFORCE_ANGLE_DIVERSITY', affectedCount: rca.singleAngleCount });
  }
  return { actions };
}

export function buildInsightRcaMoreDiagnostics(rca) {
  return {
    totalParents: rca.parentCount,
    gradeCounts: rca.gradeCounts,
    weakTreeCount: rca.weakTreeCount,
    singleAngleCount: rca.singleAngleCount,
    singleSourceCount: rca.singleSourceCount,
    capturedAt: rca.capturedAt,
  };
}
