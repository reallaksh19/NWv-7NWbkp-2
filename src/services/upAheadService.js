import { DEFAULT_SETTINGS } from '../utils/storage.js';
import plannerStorage from '../utils/plannerStorage.js';
import { fetchIntelligentUpAheadData } from './intelligentUpAheadFetcher.js';

export const CACHE_KEY = 'upAhead_cache';

const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h — aligned to 5×/day pre-fetch cadence

function normalizeDateKey(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed.toISOString().slice(0, 10);
}

function getItemKey(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  return String(item.hiddenKey || item.canonicalId || item.id || item.link || item.title || '').trim();
}

function uniqByKey(items = []) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const key = getItemKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function hasItems(items = []) {
  return Array.isArray(items) && items.some(Boolean);
}

function getItemType(category) {
  const value = String(category || '').toLowerCase();
  const map = {
    movies: 'movie',
    movie: 'movie',
    events: 'event',
    event: 'event',
    festivals: 'festival',
    festival: 'festival',
    alerts: 'alert',
    alert: 'alert',
    sports: 'sport',
    shopping: 'shopping',
    offer: 'shopping',
    civic: 'civic',
    weather_alerts: 'weather_alert',
    weather_alert: 'weather_alert',
    airlines: 'airline',
    airline_offer: 'airline'
  };
  return map[value] || 'event';
}

function categorySectionKey(category) {
  const value = String(category || '').toLowerCase();
  const map = {
    movie: 'movies',
    movies: 'movies',
    event: 'events',
    events: 'events',
    festival: 'festivals',
    festivals: 'festivals',
    alert: 'alerts',
    alerts: 'alerts',
    civic: 'civic',
    sports: 'sports',
    shopping: 'shopping',
    weather_alert: 'weather_alerts',
    weather_alerts: 'weather_alerts',
    offer: 'shopping',
    airline_offer: 'airlines',
    airlines: 'airlines'
  };
  return map[value] || value || 'events';
}

function getDayLabel(dateKey) {
  const date = new Date(dateKey);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupPlannerPayloads(items = []) {
  const grouped = new Map();
  for (const item of items || []) {
    if (!item?.plannerEligible || !item?.eventDateKey) continue;
    const payload = {
      id: item.canonicalId || item.hiddenKey || item.rawSourceId,
      hiddenKey: item.canonicalId || item.hiddenKey || item.rawSourceId,
      canonicalId: item.canonicalId || item.hiddenKey || item.rawSourceId,
      title: item.title,
      category: item.category,
      type: getItemType(item.category),
      link: item.link,
      description: item.description || item.summary || '',
      icon: null,
      eventDate: item.eventDate ? new Date(item.eventDate).toISOString() : item.eventDateKey,
      eventDateKey: item.eventDateKey,
      dateConfidence: item.dateConfidence,
      locationCanonical: item.locationCanonical || null,
      isOffer: ['shopping', 'airlines', 'offer', 'airline_offer'].includes(String(item.category || '').toLowerCase())
    };
    if (!grouped.has(item.eventDateKey)) grouped.set(item.eventDateKey, []);
    grouped.get(item.eventDateKey).push(payload);
  }
  return grouped;
}

function persistPlannerCandidates(items = []) {
  const grouped = groupPlannerPayloads(items);
  for (const [dateKey, payloads] of grouped.entries()) {
    plannerStorage.merge([dateKey], payloads);
  }
}

function formatPlanLabel(dateKey) {
  const d = new Date(dateKey);
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${getOrdinal(d.getDate())} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
}

function generateWeeklyPlan(timeline = []) {
  const plan = [];
  const blacklist = plannerStorage.getBlacklist ? plannerStorage.getBlacklist() : new Set();
  const persistedPlan = plannerStorage.getPlan ? plannerStorage.getPlan() : {};
  const timelineByDate = new Map((timeline || []).map(day => [day.date, day.items || []]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    const timelineItems = (timelineByDate.get(dateKey) || [])
      .filter(item => !blacklist.has(getItemKey(item)))
      .map(item => ({
        id: item.id || getItemKey(item),
        hiddenKey: getItemKey(item),
        title: item.title,
        type: item.type || getItemType(item.category),
        icon: item.icon || '📅',
        link: item.link,
        description: item.description,
        isOffer: item.type === 'shopping' || item.type === 'airline'
      }));

    const savedItems = (persistedPlan[dateKey] || [])
      .filter(item => !blacklist.has(getItemKey(item)))
      .map(item => ({
        id: item.id || getItemKey(item),
        hiddenKey: getItemKey(item),
        title: item.title,
        type: item.type || item.category || 'event',
        icon: item.icon || '📅',
        link: item.link,
        description: item.description,
        isOffer: Boolean(item.isOffer) || ['shopping', 'airline', 'airlines'].includes(String(item.type || item.category || '').toLowerCase())
      }));

    const merged = uniqByKey([...savedItems, ...timelineItems]).slice(0, 10);

    plan.push({
      day: d.toLocaleDateString('en-US', { weekday: 'long' }),
      date: formatPlanLabel(dateKey),
      items: merged
    });
  }

  return plan;
}

function buildLegacyDisplayFromRanked(items = [], meta = {}) {
  const sections = {
    movies: [],
    festivals: [],
    alerts: [],
    events: [],
    sports: [],
    shopping: [],
    civic: [],
    weather_alerts: [],
    airlines: []
  };

  const timelineMap = new Map();

  for (const item of items || []) {
    if (!item) continue;
    const sectionKey = categorySectionKey(item.category);
    const eventDateKey = item.eventDateKey || normalizeDateKey(item.eventDate) || null;
    const displayItem = {
      id: item.canonicalId || item.rawSourceId || item.link || item.title,
      hiddenKey: item.canonicalId || item.rawSourceId || item.link || item.title,
      canonicalId: item.canonicalId || item.rawSourceId || item.link || item.title,
      title: item.title,
      link: item.link,
      description: item.description || item.summary || '',
      date: eventDateKey,
      releaseDate: eventDateKey,
      planDate: eventDateKey,
      category: sectionKey,
      source: item.sourceDomain || item.source || sectionKey,
      locationCanonical: item.locationCanonical || null,
      dateConfidence: item.dateConfidence || 'none',
      decisionTrace: item.decisionTrace || [],
      plannerEligible: Boolean(item.plannerEligible && eventDateKey),
      displayEligible: item.displayEligible !== false
    };

    if (displayItem.displayEligible && sections[sectionKey]) {
      sections[sectionKey].push(displayItem);
    }

    if (item.upAheadEligible && eventDateKey) {
      if (!timelineMap.has(eventDateKey)) {
        timelineMap.set(eventDateKey, {
          date: eventDateKey,
          dayLabel: getDayLabel(eventDateKey),
          items: []
        });
      }
      timelineMap.get(eventDateKey).items.push({
        id: displayItem.id,
        hiddenKey: displayItem.hiddenKey,
        sourceId: item.rawSourceId || displayItem.id,
        type: getItemType(item.category),
        title: item.title,
        description: displayItem.description,
        tags: [sectionKey],
        link: item.link,
        category: sectionKey,
        icon: null,
        locationCanonical: item.locationCanonical || null,
        dateConfidence: item.dateConfidence || 'none',
        plannerEligible: displayItem.plannerEligible
      });
    }
  }

  const timeline = Array.from(timelineMap.values())
    .map(day => ({
      ...day,
      items: uniqByKey(day.items)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  Object.keys(sections).forEach((key) => {
    sections[key] = uniqByKey(sections[key])
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      .slice(0, 20);
  });

  const weekly_plan = generateWeeklyPlan(timeline);

  return {
    timeline,
    sections,
    weekly_plan,
    lastUpdated: new Date().toISOString(),
    auditSummary: meta.auditSummary || null,
    dropReport: meta.dropReport || []
  };
}

export function isActualWeatherAlertText(text, upAheadSettings = null) {
  const rules = upAheadSettings?.weatherAlertRules || DEFAULT_SETTINGS.upAhead.weatherAlertRules;
  const lower = String(text || '').toLowerCase();
  const weatherWords = [
    ...(rules.contextKeywords || []),
    ...(rules.ambiguousKeywords || []),
    ...((upAheadSettings?.keywords?.weather_alerts) || DEFAULT_SETTINGS.upAhead.keywords.weather_alerts || [])
  ];
  let matches = 0;
  for (const word of weatherWords) {
    if (lower.includes(String(word).toLowerCase())) matches += 1;
  }
  return matches >= (rules.minimumMatches || 2);
}

export function isActualOfferText(text, upAheadSettings = null) {
  const rules = upAheadSettings?.offerRules || DEFAULT_SETTINGS.upAhead.offerRules;
  const lower = String(text || '').toLowerCase();
  let matches = 0;
  for (const word of rules.offerKeywords || []) {
    if (lower.includes(String(word).toLowerCase())) matches += 1;
  }
  return matches >= (rules.minimumMatches || 1);
}

function transformPythonItemsToDisplay(items = []) {
  const ranked = items
    .filter(Boolean)
    .map(it => {
      const eventTs = it.eventStartAt || it.eventEndAt || it.expiryAt || null;
      const eventDate = eventTs ? new Date(eventTs) : null;
      const hasEventDate = eventDate && !Number.isNaN(eventDate.getTime());
      const eventDateIso = hasEventDate ? eventDate.toISOString() : null;
      const eventDateKey = hasEventDate ? eventDateIso.slice(0, 10) : null;
      const category = categorySectionKey(it.category);
      return {
        canonicalId:       it.id || it.url || it.title,
        rawSourceId:       it.id || it.url || it.title,
        title:             it.title,
        summary:           it.summary,
        description:       it.summary,
        link:              it.url,
        category,
        publishDate:       it.publishedAt ? new Date(it.publishedAt).toISOString() : null,
        eventDate:         eventDateIso,
        eventDateKey,
        dateConfidence:    it.dateConfidence || (eventDateKey ? 'exact' : 'none'),
        locationCanonical: it.city || it.region || null,
        sourceDomain:      it.source,
        source:            it.source,
        displayEligible:   it.displayEligible !== false,
        upAheadEligible:   Boolean(eventDateKey),
        plannerEligible:   Boolean(it.plannerEligible && eventDateKey),
        decisionTrace:     it.decisionTrace || [],
      };
    });
  return buildLegacyDisplayFromRanked(ranked, { auditSummary: null, dropReport: [] });
}

export function sanitizeUpAheadData(data) {
  if (!data || typeof data !== 'object') return null;

  // Python prefetch schema: {schemaVersion, fetchedAt, contentHash, items:[]}
  if (Array.isArray(data.items) && !data.timeline && !data.sections) {
    return sanitizeUpAheadData(transformPythonItemsToDisplay(data.items));
  }

  const timeline = Array.isArray(data.timeline)
    ? data.timeline
        .filter(Boolean)
        .map(day => ({ ...day, items: uniqByKey(day.items || []) }))
        .filter(day => (day.items || []).length > 0)
    : [];
  const sections = data.sections && typeof data.sections === 'object'
    ? Object.fromEntries(Object.entries(data.sections).map(([key, items]) => [key, uniqByKey(items || [])]))
    : {};
  const weekly_plan = Array.isArray(data.weekly_plan) ? data.weekly_plan : generateWeeklyPlan(timeline);
  const hasSectionItems = Object.values(sections).some(items => hasItems(items));
  const hasWeeklyItems = weekly_plan.some(day => hasItems(day.items));
  if (timeline.length === 0 && !hasSectionItems && !hasWeeklyItems) {
    return null;
  }
  return { ...data, timeline, sections, weekly_plan };
}

export function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = sanitizeUpAheadData(JSON.parse(cached));
    if (!parsed) return null;
    const age = Date.now() - new Date(parsed.lastUpdated || 0).getTime();
    if (age > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveToCache(data) {
  try {
    const sanitized = sanitizeUpAheadData(data);
    if (!sanitized) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore cache failures
  }
}

export function clearUpAheadCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore cache failures
  }
}

export async function fetchStaticUpAheadData() {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const response = await fetch(`${cleanBase}data/up_ahead.json`, { cache: 'no-cache' });
    if (!response.ok) return null;
    const parsed = await response.json();
    return sanitizeUpAheadData(parsed);
  } catch {
    return null;
  }
}

export function mergeUpAheadData(baseData, newData) {
  const base = sanitizeUpAheadData(baseData) || { timeline: [], sections: {}, weekly_plan: [] };
  const incoming = sanitizeUpAheadData(newData);
  if (!incoming) return sanitizeUpAheadData(base);
  const timelineMap = new Map();

  for (const day of [...(base.timeline || []), ...(incoming.timeline || [])]) {
    if (!timelineMap.has(day.date)) {
      timelineMap.set(day.date, { ...day, items: uniqByKey(day.items || []) });
    } else {
      const existing = timelineMap.get(day.date);
      existing.items = uniqByKey([...(existing.items || []), ...(day.items || [])]);
    }
  }

  const sections = { ...(base.sections || {}) };
  for (const [key, items] of Object.entries(incoming.sections || {})) {
    sections[key] = uniqByKey([...(sections[key] || []), ...(items || [])]);
  }

  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const merged = {
    timeline,
    sections,
    weekly_plan: generateWeeklyPlan(timeline),
    lastUpdated: incoming.lastUpdated || base.lastUpdated || new Date().toISOString(),
    auditSummary: incoming.auditSummary || base.auditSummary || null,
    dropReport: incoming.dropReport || base.dropReport || []
  };

  return sanitizeUpAheadData(merged);
}

export async function fetchLiveUpAheadData(upAheadSettings = {}) {
  const categories = Object.entries(upAheadSettings.categories || DEFAULT_SETTINGS.upAhead.categories)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);
  const locations = Array.isArray(upAheadSettings.locations) && upAheadSettings.locations.length > 0
    ? upAheadSettings.locations
    : (DEFAULT_SETTINGS.upAhead.locations || ['Chennai', 'Muscat']);

  try {
    const result = await fetchIntelligentUpAheadData({
      categories,
      locations,
      plannerWindowDays: 7,
      asOfDate: new Date(),
      mode: 'offline',
      settings: { upAhead: upAheadSettings }
    });

    persistPlannerCandidates(result.rankedItems || []);
    return buildLegacyDisplayFromRanked(result.rankedItems || [], {
      auditSummary: result.auditSummary,
      dropReport: result.dropReport
    });
  } catch (error) {
    console.error('[UpAheadService] Intelligent fetch failed', error);
    return {
      timeline: [],
      sections: {
        movies: [],
        festivals: [],
        alerts: [],
        events: [],
        sports: [],
        shopping: [],
        civic: [],
        weather_alerts: [],
        airlines: []
      },
      weekly_plan: generateWeeklyPlan([]),
      lastUpdated: new Date().toISOString(),
      auditSummary: { total: 0, dropped: 0, error: error?.message || 'unknown' },
      dropReport: []
    };
  }
}
