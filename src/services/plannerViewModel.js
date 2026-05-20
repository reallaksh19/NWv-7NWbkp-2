import { flattenPlannerData } from './plannerEvidence';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function startOfDayMs(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.NaN;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getDateWindowBounds(dateWindow, nowMs) {
  const todayMs = startOfDayMs(nowMs);
  const dayMs = 24 * 60 * 60 * 1000;

  if (dateWindow === 'today') {
    return { min: todayMs, max: todayMs };
  }

  if (dateWindow === 'next7') {
    return { min: todayMs, max: todayMs + 7 * dayMs };
  }

  if (dateWindow === 'future') {
    return { min: todayMs, max: Number.POSITIVE_INFINITY };
  }

  if (dateWindow === 'overdue') {
    return { min: Number.NEGATIVE_INFINITY, max: todayMs - dayMs };
  }

  if (dateWindow === 'undated') {
    return { undatedOnly: true };
  }

  return { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY };
}

function itemMatchesSearch(item, query) {
  const q = normalizeText(query);
  if (!q) return true;

  const haystack = [
    item.title,
    item.description,
    item.category,
    item.type,
    item.displayDate
  ].map(normalizeText).join(' ');

  return haystack.includes(q);
}

function itemMatchesCategory(item, category) {
  if (!category || category === 'all') return true;
  return normalizeText(item.category) === normalizeText(category);
}

function itemMatchesDateWindow(item, dateWindow, nowMs) {
  if (!dateWindow || dateWindow === 'all') return true;

  const bounds = getDateWindowBounds(dateWindow, nowMs);
  const itemMs = startOfDayMs(item.dateKey);
  const isUndated = item.dateKey === 'undated' || Number.isNaN(itemMs);

  if (bounds.undatedOnly) return isUndated;
  if (isUndated) return false;

  return itemMs >= bounds.min && itemMs <= bounds.max;
}

function compareItems(a, b, sortMode) {
  if (sortMode === 'title') {
    return String(a.title).localeCompare(String(b.title));
  }

  if (sortMode === 'category') {
    const byCategory = String(a.category).localeCompare(String(b.category));
    if (byCategory !== 0) return byCategory;
    return String(a.title).localeCompare(String(b.title));
  }

  const byDate = String(a.dateKey).localeCompare(String(b.dateKey));
  if (byDate !== 0) return byDate;
  return String(a.title).localeCompare(String(b.title));
}

function groupItemsByDate(items) {
  const grouped = new Map();

  for (const item of items) {
    if (!grouped.has(item.dateKey)) grouped.set(item.dateKey, []);
    grouped.get(item.dateKey).push(item);
  }

  return [...grouped.entries()]
    .map(([dateKey, groupItems]) => ({
      dateKey,
      displayDate: groupItems[0]?.displayDate || dateKey,
      items: groupItems
    }))
    .sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
}

export function getPlannerViewModel(planData, controls = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();

  const query = controls.query || '';
  const category = controls.category || 'all';
  const dateWindow = controls.dateWindow || 'all';
  const sortMode = controls.sortMode || 'date';

  const allItems = flattenPlannerData(planData);
  const categoryOptions = [
    'all',
    ...new Set(allItems.map(item => item.category).filter(Boolean).sort())
  ];

  const filteredItems = allItems
    .filter(item => itemMatchesSearch(item, query))
    .filter(item => itemMatchesCategory(item, category))
    .filter(item => itemMatchesDateWindow(item, dateWindow, nowMs))
    .sort((a, b) => compareItems(a, b, sortMode));

  const groupedDates = groupItemsByDate(filteredItems);

  return {
    query,
    category,
    dateWindow,
    sortMode,
    totalCount: allItems.length,
    filteredCount: filteredItems.length,
    categoryOptions,
    filteredItems,
    groupedDates,
    emptyReason: allItems.length === 0
      ? 'planner-empty'
      : filteredItems.length === 0
        ? 'filters-empty'
        : 'has-results'
  };
}

export default getPlannerViewModel;