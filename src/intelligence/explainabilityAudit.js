function safeString(value) {
  return value == null ? '' : String(value);
}

export function buildDecisionRecord(item) {
  return {
    canonicalId: item?.canonicalId || item?.id || null,
    title: safeString(item?.title),
    category: item?.category || 'unknown',
    routeTarget: item?.routeTarget || item?.routedTo || 'unknown',
    plannerEligible: Boolean(item?.plannerEligible),
    upAheadEligible: Boolean(item?.upAheadEligible),
    sourceTrust: item?.sourceTrust || 'unknown',
    sourceType: item?.sourceType || 'unknown',
    sourceDomain: item?.sourceDomain || 'unknown',
    classificationConfidence: Number(item?.classificationConfidence || 0),
    dateConfidence: item?.dateConfidence || 'none',
    eventDateKey: item?.eventDateKey || null,
    windowStatus: item?.windowStatus || 'unknown',
    locationCanonical: item?.locationCanonical || null,
    locationEligible: item?.locationEligible !== false,
    dropReason: item?.dropReason || null,
    decisionTrace: [...(item?.decisionTrace || [])]
  };
}

export function summarizeDecisionRecords(items = []) {
  const summary = {
    total: 0,
    plannerEligible: 0,
    upAheadEligible: 0,
    dropped: 0,
    byRoute: {},
    byCategory: {},
    byDropReason: {},
    byDateConfidence: {},
    bySourceTrust: {}
  };

  for (const item of items || []) {
    const record = buildDecisionRecord(item);
    summary.total += 1;
    if (record.plannerEligible) summary.plannerEligible += 1;
    if (record.upAheadEligible) summary.upAheadEligible += 1;
    if (!record.plannerEligible && !record.upAheadEligible) summary.dropped += 1;

    summary.byRoute[record.routeTarget] = (summary.byRoute[record.routeTarget] || 0) + 1;
    summary.byCategory[record.category] = (summary.byCategory[record.category] || 0) + 1;
    summary.byDateConfidence[record.dateConfidence] = (summary.byDateConfidence[record.dateConfidence] || 0) + 1;
    summary.bySourceTrust[record.sourceTrust] = (summary.bySourceTrust[record.sourceTrust] || 0) + 1;

    if (record.dropReason) {
      summary.byDropReason[record.dropReason] = (summary.byDropReason[record.dropReason] || 0) + 1;
    }
  }

  return summary;
}

export function buildDropReport(items = []) {
  return (items || [])
    .map(buildDecisionRecord)
    .filter(record => record.dropReason)
    .sort((a, b) => {
      if (a.dropReason !== b.dropReason) return a.dropReason.localeCompare(b.dropReason);
      return a.title.localeCompare(b.title);
    });
}

export function attachDecisionTrace(item, step, payload = null) {
  const traceEntry = payload ? `${step}:${safeString(payload)}` : step;
  return {
    ...item,
    decisionTrace: [...new Set([...(item?.decisionTrace || []), traceEntry])]
  };
}
