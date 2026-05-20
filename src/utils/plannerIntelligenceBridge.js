import { analyzeDateText, classifyPlannerWindow } from '../intelligence/dateAware.js';
import { annotateItemLocation } from '../intelligence/locationAware.js';

function formatDateKey(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function enrichCanonicalItemForPlanner(item, options = {}) {
  const fullText = [item?.title, item?.description, item?.summary, item?.originalText].filter(Boolean).join(' • ');
  const publishDate = item?.pubDate || item?.publishDate || null;

  const dateAnalysis = analyzeDateText(fullText, {
    asOfDate: options.asOfDate,
    publishDate,
    plannerWindowDays: options.plannerWindowDays || 7
  });

  const locationAnnotated = annotateItemLocation(
    {
      ...item,
      eventDate: dateAnalysis.eventDate,
      category: item?.category,
      mode: options.mode || item?.mode || 'offline'
    },
    {
      mode: options.mode || item?.mode || 'offline',
      selectedCities: options.selectedCities,
      locationLibrary: options.locationLibrary,
      allowOnlineBypass: options.allowOnlineBypass !== false,
      category: item?.category
    }
  );

  const windowing = classifyPlannerWindow(dateAnalysis, {
    asOfDate: options.asOfDate,
    plannerWindowDays: options.plannerWindowDays || 7
  });

  return {
    ...locationAnnotated,
    eventDate: dateAnalysis.eventDate,
    eventDateEnd: dateAnalysis.eventDateEnd,
    eventDateKey: dateAnalysis.eventDateKey,
    eventDateEndKey: dateAnalysis.eventDateEndKey,
    dateConfidence: dateAnalysis.dateConfidence,
    temporalType: dateAnalysis.temporalType,
    matchedDateKeys: dateAnalysis.matchedDateKeys,
    routeHint: dateAnalysis.routeHint,
    decisionTrace: [
      ...(item?.decisionTrace || []),
      ...(dateAnalysis.decisionTrace || []),
      ...(locationAnnotated.locationDecisionTrace || [])
    ],
    plannerEligible: Boolean(windowing.plannerEligible && locationAnnotated.locationEligible),
    upAheadEligible: Boolean(windowing.upAheadEligible && locationAnnotated.locationEligible),
    windowStatus: windowing.windowStatus,
    dropReason: item?.dropReason || dateAnalysis.dropReason || locationAnnotated.dropReason,
    planDate: dateAnalysis.eventDateKey || formatDateKey(item?.date) || null
  };
}

export function buildPlannerMergePayload(item) {
  const eventDateKey = item?.eventDateKey || item?.planDate || null;
  if (!eventDateKey) return null;

  return {
    hiddenKey: item.hiddenKey || item.canonicalId || item.id,
    canonicalId: item.canonicalId || item.hiddenKey || item.id,
    id: item.id || item.canonicalId || item.hiddenKey,
    title: item.title,
    category: item.category,
    type: item.type || item.category || 'event',
    link: item.link,
    description: item.description,
    eventDate: item.eventDate ? new Date(item.eventDate).toISOString() : eventDateKey,
    eventDateKey,
    dateConfidence: item.dateConfidence || 'inferred',
    locationCanonical: item.locationCanonical || null,
    isOffer: Boolean(item.isOffer),
    icon: item.icon,
    decisionTrace: item.decisionTrace || []
  };
}
