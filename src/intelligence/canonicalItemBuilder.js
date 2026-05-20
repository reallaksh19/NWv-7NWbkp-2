import { classifyItemCategory } from './classification.js';
import { analyzeDateText } from './dateAware.js';
import { annotateItemLocation } from './locationAware.js';
import { evaluateEligibility } from './eligibilityWindowing.js';

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(value) {
  let h = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function safeDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateKey(input) {
  const d = safeDate(input);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function normalizeLink(link) {
  try {
    const url = new URL(link);
    return url.toString();
  } catch {
    return String(link || '').trim() || null;
  }
}

function chooseSummary(raw) {
  return normalizeText(raw?.summary || raw?.description || raw?.contentSnippet || raw?.content || '');
}

function buildCanonicalId(raw, dateKey) {
  const title = normalizeText(raw?.title || 'untitled').toLowerCase();
  const source = String(raw?.source || raw?.rawSource || raw?.feedPack || 'feed').toLowerCase();
  const link = normalizeLink(raw?.link || raw?.url || '') || 'nolink';
  return hash(`${title}|${dateKey || 'nodate'}|${source}|${link}`);
}

function extractMode(raw, options) {
  if (options?.mode) return options.mode;
  if (raw?.mode) return raw.mode;
  return 'offline';
}

function deriveFeedPack(raw, options) {
  return raw?.feedPack || raw?.sourcePack || options?.feedPack || 'default';
}

function mergeDecisionTrace(...segments) {
  return [...new Set(segments.flat().filter(Boolean))];
}

export function buildCanonicalItem(rawItem, options = {}) {
  const raw = rawItem || {};
  const title = normalizeText(raw.title || raw.name || '');
  const summary = chooseSummary(raw);
  const description = normalizeText(raw.description || raw.summary || raw.content || '');
  const link = normalizeLink(raw.link || raw.url || '');
  const publishDate = safeDate(raw.pubDate || raw.publishDate || raw.isoDate || raw.publishedAt);
  const mode = extractMode(raw, options);
  const baseText = [title, summary, description, raw.originalText].filter(Boolean).join(' • ');

  const classified = classifyItemCategory(
    {
      ...raw,
      title,
      summary,
      description,
      link
    },
    {
      settings: options.settings,
      sourceTrustOptions: options.sourceTrustOptions
    }
  );

  const dateAnalysis = analyzeDateText(baseText, {
    asOfDate: options.asOfDate,
    publishDate,
    plannerWindowDays: options.plannerWindowDays || 7,
    maxExpandedDays: options.maxExpandedDays || 14
  });

  const locationAnnotated = annotateItemLocation(
    {
      ...classified,
      title,
      summary,
      description,
      link,
      eventDate: dateAnalysis.eventDate,
      mode
    },
    {
      mode,
      category: classified.category,
      selectedCities: options.selectedCities,
      locationLibrary: options.locationLibrary,
      allowOnlineBypass: options.allowOnlineBypass !== false
    }
  );

  const canonicalId = raw.canonicalId || buildCanonicalId(raw, dateAnalysis.eventDateKey || toDateKey(publishDate));

  const canonical = {
    canonicalId,
    rawSourceId: raw.guid || raw.id || raw.link || raw.url || title,
    title,
    summary,
    description,
    link,
    source: raw.source || raw.rawSource || 'feed',
    sourceDomain: locationAnnotated.sourceDomain || classified.sourceDomain || null,
    sourceType: classified.sourceType || null,
    sourceTrust: classified.sourceTrust || 'low',
    sourceTrustScore: classified.sourceTrustScore || 0,
    feedPack: deriveFeedPack(raw, options),
    category: classified.category,
    classificationConfidence: classified.classificationConfidence || 0,
    eventDate: dateAnalysis.eventDate,
    eventDateEnd: dateAnalysis.eventDateEnd,
    eventDateKey: dateAnalysis.eventDateKey || null,
    eventDateEndKey: dateAnalysis.eventDateEndKey || null,
    matchedDateKeys: dateAnalysis.matchedDateKeys || [],
    parsedDateEvidence: dateAnalysis.parsedDateEvidence || null,
    dateConfidence: dateAnalysis.dateConfidence || 'none',
    temporalType: dateAnalysis.temporalType || 'none',
    publishDate,
    publishTs: publishDate ? publishDate.getTime() : null,
    locationCanonical: locationAnnotated.locationCanonical || null,
    locationAliasesMatched: locationAnnotated.locationMatchedAlias ? [locationAnnotated.locationMatchedAlias] : [],
    locationConfidence: locationAnnotated.locationConfidence || 0,
    locationEligible: locationAnnotated.locationEligible !== false,
    mode,
    priority: Number(raw.priority || 0),
    status: raw.status || 'new',
    routeHint: dateAnalysis.routeHint || null,
    dropReason: raw.dropReason || dateAnalysis.dropReason || locationAnnotated.dropReason || null,
    decisionTrace: mergeDecisionTrace(raw.decisionTrace, classified.decisionTrace, dateAnalysis.decisionTrace, locationAnnotated.locationDecisionTrace),
    mergedWith: raw.mergedWith || [],
    routedTo: null,
    originalItem: raw
  };

  const eligibility = evaluateEligibility(canonical, {
    asOfDate: options.asOfDate,
    plannerWindowDays: options.plannerWindowDays || 7
  });

  return {
    ...canonical,
    plannerEligible: eligibility.plannerEligible,
    upAheadEligible: eligibility.upAheadEligible,
    routeTarget: eligibility.routeTarget,
    routedTo: eligibility.routeTarget,
    windowStatus: eligibility.windowStatus,
    dropReason: eligibility.dropReason,
    decisionTrace: mergeDecisionTrace(canonical.decisionTrace, eligibility.decisionTrace)
  };
}

export function buildCanonicalItems(rawItems = [], options = {}) {
  return (rawItems || [])
    .filter(Boolean)
    .map(item => buildCanonicalItem(item, options));
}

export function summarizeCanonicalItems(items = []) {
  const summary = {
    total: 0,
    plannerEligible: 0,
    upAheadEligible: 0,
    dropped: 0,
    byCategory: {},
    byRoute: {}
  };

  for (const item of items || []) {
    summary.total += 1;
    if (item.plannerEligible) summary.plannerEligible += 1;
    if (item.upAheadEligible) summary.upAheadEligible += 1;
    if (!item.upAheadEligible && !item.plannerEligible) summary.dropped += 1;

    const category = item.category || 'unknown';
    const route = item.routeTarget || 'unknown';
    summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
    summary.byRoute[route] = (summary.byRoute[route] || 0) + 1;
  }

  return summary;
}
