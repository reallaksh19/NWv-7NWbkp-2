function atStartOfDay(input) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(input, days) {
  const d = atStartOfDay(input);
  d.setDate(d.getDate() + days);
  return d;
}

function safeDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : atStartOfDay(d);
}

function severityBoost(category) {
  const value = String(category || '').toLowerCase();
  if (['weather_alerts', 'alerts', 'civic'].includes(value)) return 3;
  if (['airlines', 'shopping'].includes(value)) return 2;
  return 1;
}

export function evaluateEligibility(item, options = {}) {
  const asOfDate = safeDate(options.asOfDate) || atStartOfDay(new Date());
  const plannerWindowDays = Number.isFinite(options.plannerWindowDays) ? options.plannerWindowDays : 7;
  const plannerEnd = addDays(asOfDate, plannerWindowDays - 1);
  const eventDate = safeDate(item?.eventDate || item?.eventDateKey || item?.date);
  const locationEligible = item?.locationEligible !== false;
  const classificationConfidence = Number(item?.classificationConfidence || 0);
  const dateConfidence = String(item?.dateConfidence || 'none');
  const sourceTrust = String(item?.sourceTrust || 'low');
  const decisionTrace = [...(item?.decisionTrace || [])];

  if (!locationEligible) {
    return {
      ...item,
      plannerEligible: false,
      upAheadEligible: false,
      routeTarget: 'dropped',
      windowStatus: 'location_mismatch',
      dropReason: item?.dropReason || 'location_mismatch',
      decisionTrace: [...decisionTrace, 'eligibility:location_mismatch']
    };
  }

  if (!eventDate) {
    const possible = item.routeHint === 'upahead_possible' || (sourceTrust === 'high' && classificationConfidence >= 0.3);
    return {
      ...item,
      plannerEligible: false,
      upAheadEligible: possible,
      routeTarget: possible ? 'possibleUpcoming' : 'dropped',
      windowStatus: 'missing_date',
      dropReason: possible ? null : (item.dropReason || 'missing_date'),
      decisionTrace: [...decisionTrace, possible ? 'eligibility:possible_without_date' : 'eligibility:missing_date']
    };
  }

  if (dateConfidence === 'tentative') {
    let plannerEligible = false;
    let traceEvent = 'eligibility:tentative_upahead_only';
    
    if (item.category === 'events' && classificationConfidence > 0.3 && options.mode !== 'online') {
        plannerEligible = true;
        traceEvent = 'eligibility:planner';
    }

    if (!plannerEligible) {
        return {
          ...item,
          plannerEligible: false,
          upAheadEligible: true,
          routeTarget: 'possibleUpcoming',
          windowStatus: 'tentative',
          dropReason: 'low_trust_or_tentative',
          decisionTrace: [...decisionTrace, traceEvent]
        };
    }
  }

  if (eventDate < asOfDate) {
    return {
      ...item,
      plannerEligible: false,
      upAheadEligible: false,
      routeTarget: 'dropped',
      windowStatus: 'before_window',
      dropReason: item?.dropReason || 'before_window',
      decisionTrace: [...decisionTrace, 'eligibility:before_window']
    };
  }

  if (eventDate > plannerEnd) {
    return {
      ...item,
      plannerEligible: false,
      upAheadEligible: true,
      routeTarget: 'upahead_exact',
      windowStatus: 'after_window',
      dropReason: null,
      decisionTrace: [...decisionTrace, 'eligibility:after_window']
    };
  }

  let plannerEligible = true;
  if (dateConfidence === 'tentative') plannerEligible = false;
  if (classificationConfidence > 0 && classificationConfidence < 0.2) plannerEligible = false;
  
  // Note: we consider dateConfidence 'exact', 'inferred', and 'explicit' to be valid temporal signals for planner inclusion.
  if (sourceTrust === 'low' && item?.sourceType !== 'event_listing' && severityBoost(item?.category) < 3 && !['exact', 'inferred', 'explicit'].includes(dateConfidence)) {
      plannerEligible = false;
  }
  
  if (item?.routeHint === 'upahead_possible') {
      // In offline mode we must trust the "next week" hint enough to put into planner if it strongly passed classification
      if (item.category === 'events' && classificationConfidence > 0.3 && options.mode !== 'online') {
          plannerEligible = true;
      } else {
          plannerEligible = false;
      }
  }

  // Phase B Edgecase: Suppress non-event/offer hints from strict offline planner
  if (plannerEligible && options.mode !== 'online' && !['exact', 'explicit'].includes(dateConfidence)) {
      if (item.category === 'airlines') {
          plannerEligible = false;
      }
  }

  return {
    ...item,
    plannerEligible,
    upAheadEligible: true,
    routeTarget: plannerEligible ? 'planner' : 'upahead_exact',
    windowStatus: 'inside_window',
    dropReason: null,
    decisionTrace: [...decisionTrace, plannerEligible ? 'eligibility:planner' : 'eligibility:upahead_only']
  };
}

export function evaluateEligibilityBatch(items = [], options = {}) {
  return (items || []).map(item => evaluateEligibility(item, options));
}

export function rankEligibleItems(items = []) {
  return [...(items || [])].sort((a, b) => {
    const aDate = safeDate(a?.eventDate || a?.date);
    const bDate = safeDate(b?.eventDate || b?.date);
    const aTime = aDate ? aDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = bDate ? bDate.getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    const aSeverity = severityBoost(a?.category);
    const bSeverity = severityBoost(b?.category);
    if (aSeverity !== bSeverity) return bSeverity - aSeverity;

    const aScore = Number(a?.classificationConfidence || 0) + Number(a?.sourceTrustScore || 0);
    const bScore = Number(b?.classificationConfidence || 0) + Number(b?.sourceTrustScore || 0);
    return bScore - aScore;
  });
}
