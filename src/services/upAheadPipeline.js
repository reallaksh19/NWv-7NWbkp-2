import { deduplicateCanonicalItems } from '../intelligence/deDuplication.js';
import { enrichCanonicalItemForPlanner, buildPlannerMergePayload } from '../utils/plannerIntelligenceBridge.js';
import plannerStorage from '../utils/plannerStorage.js';

function dayLabelFor(dateKey, asOfDate = null) {
  const d = new Date(dateKey);
  d.setHours(0, 0, 0, 0);
  const ref = asOfDate ? new Date(asOfDate) : new Date();
  ref.setHours(0, 0, 0, 0);
  const tomorrow = new Date(ref);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === ref.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function typeFromCategory(category) {
  const map = {
    movies: 'movie', movie: 'movie',
    events: 'event', event: 'event', sports: 'sport',
    festivals: 'festival', festival: 'festival',
    alerts: 'alert', alert: 'alert', civic: 'civic', weather_alerts: 'weather_alert',
    shopping: 'shopping', offer: 'shopping', airlines: 'airline', airline_offer: 'airline'
  };
  return map[String(category || '').toLowerCase()] || 'event';
}

function normalizeSectionKey(category) {
  const value = String(category || '').toLowerCase();
  if (value === 'movie') return 'movies';
  if (value === 'event') return 'events';
  if (value === 'festival') return 'festivals';
  if (value === 'alert') return 'alerts';
  if (value === 'weather_alert') return 'weather_alerts';
  if (value === 'offer') return 'shopping';
  if (value === 'airline_offer') return 'airlines';
  return value || 'general';
}

export function buildCanonicalFeedItem(rawItem, options = {}) {
  const enriched = enrichCanonicalItemForPlanner(rawItem, options);
  return {
    ...rawItem,
    ...enriched,
    hiddenKey: rawItem.hiddenKey || rawItem.canonicalId || rawItem.id,
    type: typeFromCategory(rawItem.category),
    source: rawItem.rawSource || rawItem.source || 'feed'
  };
}

export function processCanonicalUpAheadItems(rawItems = [], options = {}) {
  const canonicalItems = (rawItems || [])
    .filter(Boolean)
    .map(item => buildCanonicalFeedItem(item, options))
    .filter(item => !item.dropReason || item.upAheadEligible || item.plannerEligible);

  const deduped = deduplicateCanonicalItems(canonicalItems, options.dedupeOptions || {});
  const timelineMap = new Map();
  const possibleUpcoming = [];
  const sections = {
    movies: [], festivals: [], alerts: [], events: [], sports: [], shopping: [], civic: [], weather_alerts: [], airlines: []
  };

  for (const item of deduped) {
    const sectionKey = normalizeSectionKey(item.category);
    if (sections[sectionKey]) {
      sections[sectionKey].push({
        id: item.canonicalId || item.hiddenKey || item.id,
        hiddenKey: item.hiddenKey || item.canonicalId || item.id,
        title: item.title,
        link: item.link,
        description: item.description,
        date: item.eventDateKey,
        releaseDate: item.eventDateKey,
        planDate: item.eventDateKey,
        category: sectionKey,
        source: item.source,
        locationCanonical: item.locationCanonical,
        dateConfidence: item.dateConfidence,
        decisionTrace: item.decisionTrace || []
      });
    }

    if (item.upAheadEligible && item.eventDateKey) {
      if (!timelineMap.has(item.eventDateKey)) {
        timelineMap.set(item.eventDateKey, {
          date: item.eventDateKey,
          dayLabel: dayLabelFor(item.eventDateKey, options.asOfDate),
          items: []
        });
      }
      timelineMap.get(item.eventDateKey).items.push({
        id: item.canonicalId || item.hiddenKey || item.id,
        hiddenKey: item.hiddenKey || item.canonicalId || item.id,
        sourceId: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        link: item.link,
        tags: [sectionKey],
        locationCanonical: item.locationCanonical,
        dateConfidence: item.dateConfidence,
        decisionTrace: item.decisionTrace || []
      });
    } else if (item.routeHint === 'upahead_possible') {
      possibleUpcoming.push(item);
    }
  }

  const timeline = Array.from(timelineMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => ({
      ...day,
      items: deduplicateCanonicalItems(day.items, options.dedupeOptions || {})
    }));

  return {
    timeline,
    sections,
    possibleUpcoming,
    canonicalItems: deduped,
    weekly_plan: []
  };
}

export function persistPlannerCandidates(items = []) {
  const grouped = new Map();
  for (const item of items || []) {
    if (!item?.plannerEligible || !item?.eventDateKey) continue;
    const payload = buildPlannerMergePayload(item);
    if (!payload) continue;
    if (!grouped.has(item.eventDateKey)) grouped.set(item.eventDateKey, []);
    grouped.get(item.eventDateKey).push(payload);
  }

  for (const [dateKey, payloads] of grouped.entries()) {
    plannerStorage.merge([dateKey], payloads);
  }
}
