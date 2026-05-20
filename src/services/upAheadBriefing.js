function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function asDateValue(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function normalizeItemDate(item) {
  return item?.date || item?.releaseDate || item?.eventDate || item?.planDate || '';
}

function getItemId(item, fallbackPrefix, index) {
  return item?.hiddenKey || item?.canonicalId || item?.id || `${fallbackPrefix}-${index}`;
}

function getItemType(item, fallbackType) {
  return item?.type || item?.category || item?.tags?.[0] || fallbackType;
}

function makeBriefingItem(item, fallbackType, index) {
  const date = normalizeItemDate(item);

  return {
    id: getItemId(item, fallbackType, index),
    title: item?.title || 'Untitled item',
    description: item?.description || item?.summary || '',
    date,
    dateValue: asDateValue(date),
    type: getItemType(item, fallbackType),
    source: item?.source || item?.platform || item?.category || 'Up Ahead',
    link: item?.link || item?.url || '',
    icon: item?.icon || '•',
    raw: item,
  };
}

function sortByDateThenTitle(items) {
  return [...items].sort((a, b) => {
    if (a.dateValue !== b.dateValue) return a.dateValue - b.dateValue;
    return String(a.title).localeCompare(String(b.title));
  });
}

function takeUnique(items, limit) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = `${String(item.title).toLowerCase()}|${item.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

function getLocations(settings) {
  const locations = safeArray(settings?.upAhead?.locations)
    .map(location => String(location || '').trim())
    .filter(Boolean);

  return locations.length > 0 ? locations : ['Chennai'];
}

function fromSection(data, key, fallbackType) {
  return safeArray(safeObject(data?.sections)[key]).map((item, index) => (
    makeBriefingItem(item, fallbackType, index)
  ));
}

function fromTimeline(data) {
  return safeArray(data?.timeline).flatMap(day => (
    safeArray(day?.items).map((item, index) => makeBriefingItem({
      ...item,
      date: item?.date || day?.date,
    }, item?.type || 'timeline', index))
  ));
}

function fromWeeklyPlan(data) {
  return safeArray(data?.weekly_plan).flatMap(day => (
    safeArray(day?.items).map((item, index) => makeBriefingItem({
      ...item,
      date: item?.planDate || item?.eventDate || day?.date,
    }, item?.type || 'plan', index))
  ));
}

function buildUrgencyLabel(alertCount, offerCount, todayCount) {
  if (alertCount > 0) return 'Alerts need attention';
  if (todayCount > 0) return 'Today has actionable items';
  if (offerCount > 0) return 'Offers are available';
  return 'No urgent action';
}

export function getUpAheadBriefing({ data, settings, visible = {}, now = Date.now() }) {
  const locations = getLocations(settings);

  const alertItems = sortByDateThenTitle(
    safeArray(visible.combinedAlerts).map((item, index) => makeBriefingItem(item, 'alert', index))
  );

  const offerItems = sortByDateThenTitle(
    safeArray(visible.offerItems).map((item, index) => makeBriefingItem(item, 'offer', index))
  );

  const movieItems = sortByDateThenTitle(
    safeArray(visible.movieCards).map((item, index) => makeBriefingItem(item, 'movie', index))
  );

  const festivalItems = sortByDateThenTitle(
    safeArray(visible.festivalCards).map((item, index) => makeBriefingItem(item, 'festival', index))
  );

  const eventItems = sortByDateThenTitle([
    ...fromSection(data, 'events', 'event'),
    ...fromSection(data, 'sports', 'sports'),
  ]);

  const timelineItems = sortByDateThenTitle(fromTimeline(data));
  const planItems = sortByDateThenTitle(fromWeeklyPlan(data));

  const soonCutoff = now + 72 * 60 * 60 * 1000;
  const todayCutoff = now + 24 * 60 * 60 * 1000;

  const allDated = sortByDateThenTitle([
    ...eventItems,
    ...movieItems,
    ...festivalItems,
    ...offerItems,
    ...timelineItems,
    ...planItems,
  ]).filter(item => Number.isFinite(item.dateValue));

  const todayItems = takeUnique(
    allDated.filter(item => item.dateValue >= now && item.dateValue <= todayCutoff),
    5
  );

  const next72hItems = takeUnique(
    allDated.filter(item => item.dateValue >= now && item.dateValue <= soonCutoff),
    8
  );

  const highlights = [
    ...takeUnique(alertItems, 2),
    ...takeUnique(todayItems, 2),
    ...takeUnique(eventItems, 2),
    ...takeUnique(movieItems, 1),
    ...takeUnique(offerItems, 1),
  ];

  const buckets = [
    {
      key: 'alerts',
      label: 'Alerts',
      count: alertItems.length,
      items: takeUnique(alertItems, 3),
    },
    {
      key: 'today',
      label: 'Today',
      count: todayItems.length,
      items: todayItems,
    },
    {
      key: 'next72h',
      label: 'Next 72h',
      count: next72hItems.length,
      items: next72hItems,
    },
    {
      key: 'events',
      label: 'Events',
      count: eventItems.length,
      items: takeUnique(eventItems, 4),
    },
    {
      key: 'releases',
      label: 'Releases',
      count: movieItems.length,
      items: takeUnique(movieItems, 4),
    },
    {
      key: 'offers',
      label: 'Offers',
      count: offerItems.length,
      items: takeUnique(offerItems, 4),
    },
    {
      key: 'festivals',
      label: 'Festivals',
      count: festivalItems.length,
      items: takeUnique(festivalItems, 4),
    },
  ];

  const plannerReadyCount = planItems.length + todayItems.length + next72hItems.length;
  const urgencyLabel = buildUrgencyLabel(alertItems.length, offerItems.length, todayItems.length);

  const notes = [];

  if (alertItems.length > 0) notes.push(`${alertItems.length} alert item(s) should be reviewed first.`);
  if (todayItems.length > 0) notes.push(`${todayItems.length} item(s) fall within the next 24 hours.`);
  if (next72hItems.length > 0) notes.push(`${next72hItems.length} item(s) are visible within the next 72 hours.`);
  if (offerItems.length > 0) notes.push(`${offerItems.length} offer item(s) can be saved or dismissed.`);
  if (plannerReadyCount > 0) notes.push(`${plannerReadyCount} planner-ready item(s) available.`);
  if (notes.length === 0) notes.push('No urgent Up Ahead actions found.');

  return {
    status: alertItems.length > 0 ? 'urgent' : plannerReadyCount > 0 ? 'active' : 'quiet',
    title: urgencyLabel,
    locations,
    locationLabel: locations.join(', '),
    highlights: takeUnique(highlights, 6),
    buckets,
    alertCount: alertItems.length,
    offerCount: offerItems.length,
    eventCount: eventItems.length,
    movieCount: movieItems.length,
    festivalCount: festivalItems.length,
    todayCount: todayItems.length,
    next72hCount: next72hItems.length,
    plannerReadyCount,
    notes,
  };
}

export default getUpAheadBriefing;