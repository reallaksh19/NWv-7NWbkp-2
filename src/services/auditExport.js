const GRADE_EXPLANATIONS = {
  A: {
    label: 'Excellent',
    description: 'Data is broad, fresh, low-duplicate and all major gates passed.',
    action: 'No immediate action required.',
  },
  B: {
    label: 'Good',
    description: 'Data is usable with minor weaknesses or soft warnings.',
    action: 'Review warnings if decisions are important.',
  },
  C: {
    label: 'Watch',
    description: 'Data is partially usable but has meaningful gaps.',
    action: 'Open More diagnostics before relying on this page.',
  },
  D: {
    label: 'Weak',
    description: 'Important gates are degraded or missing.',
    action: 'Treat this page as limited until the failed gates improve.',
  },
  F: {
    label: 'Fail',
    description: 'Data quality is not reliable for decision support.',
    action: 'Do not rely on this page without checking raw diagnostics.',
  },
};

function safeJsonClone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

function sanitizeFilePart(value) {
  return String(value || 'audit')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'audit';
}

export function getGradeExplanation(grade) {
  const key = String(grade || 'F').toUpperCase();
  return GRADE_EXPLANATIONS[key] || GRADE_EXPLANATIONS.F;
}

export function createAuditExportPayload(audit) {
  const grade = String(audit?.grade || 'F').toUpperCase();
  const explanation = getGradeExplanation(grade);

  return {
    schemaVersion: 1,
    exportType: 'nw-page-audit',
    exportedAt: new Date().toISOString(),
    target: audit?.target || 'unknown',
    title: audit?.title || 'Page quality audit',
    grade,
    score: Number.isFinite(Number(audit?.score)) ? Number(audit.score) : null,
    tone: audit?.tone || 'bad',
    gradeExplanation: explanation,
    generatedAt: audit?.generatedAt || null,
    dataTrust: safeJsonClone(audit?.dataTrust) || {},
    summary: safeJsonClone(audit?.summary) || {},
    gates: safeJsonClone(audit?.gates) || [],
    warnings: safeJsonClone(audit?.warnings) || [],
    failures: safeJsonClone(audit?.failures) || [],
    moreDiagnostics: safeJsonClone(audit?.moreDiagnostics) || [],
  };
}

export function stringifyAuditExport(audit) {
  return JSON.stringify(createAuditExportPayload(audit), null, 2);
}

export function buildAuditFileName(audit) {
  const target = sanitizeFilePart(audit?.target || audit?.title || 'audit');
  const grade = sanitizeFilePart(audit?.grade || 'grade');
  const date = new Date().toISOString().slice(0, 10);
  return `${target}-grade-${grade}-audit-${date}.json`;
}

export function getGradeLegendRows() {
  return Object.entries(GRADE_EXPLANATIONS).map(([grade, value]) => ({
    grade,
    ...value,
  }));
}
