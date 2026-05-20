function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function toDateKey(value) {
  if (!value) return 'undated';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'undated';

  return parsed.toISOString().slice(0, 10);
}

function startOfDayMs(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.NaN;

  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDisplayDate(dateKey) {
  if (dateKey === 'undated') return 'Undated';

  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function normalizeCategory(item) {
  return String(item?.category || item?.type || 'event')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizePlannerItem(item, dateKey, index) {
  const resolvedDateKey = toDateKey(
    item?.eventDateKey ||
    item?.eventDate ||
    item?.planDate ||
    dateKey ||
    item?.date ||
    item?.releaseDate
  );

  return {
    id: item?.hiddenKey || item?.canonicalId || item?.id || `${resolvedDateKey}-${index}`,
    title: item?.title || 'Untitled planner item',
    description: item?.description || item?.summary || '',
    category: normalizeCategory(item),
    type: item?.type || normalizeCategory(item),
    dateKey: resolvedDateKey,
    displayDate: formatDisplayDate(resolvedDateKey),
    link: item?.link || item?.url || '',
    icon: item?.icon || '📌',
    raw: item
  };
}

export function flattenPlannerData(planData) {
  return Object.entries(safeObject(planData)).flatMap(([dateKey, items]) => (
    safeArray(items).map((item, index) => normalizePlannerItem(item, dateKey, index))
  ));
}

function countBy(items, mapper) {
  const counts = new Map();

  for (const item of items) {
    const key = mapper(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function getDateGroups(items, nowMs) {
  const todayMs = startOfDayMs(nowMs);
  const next7Ms = todayMs + 7 * 24 * 60 * 60 * 1000;

  return countBy(items, item => item.dateKey).map(group => {
    const dayMs = startOfDayMs(group.key);
    const isUndated = group.key === 'undated' || Number.isNaN(dayMs);

    return {
      dateKey: group.key,
      label: formatDisplayDate(group.key),
      count: group.count,
      isToday: !isUndated && dayMs === todayMs,
      isOverdue: !isUndated && dayMs < todayMs,
      isNext7Days: !isUndated && dayMs >= todayMs && dayMs <= next7Ms,
      isUndated
    };
  }).sort((a, b) => {
    if (a.isUndated !== b.isUndated) return a.isUndated ? 1 : -1;
    return String(a.dateKey).localeCompare(String(b.dateKey));
  });
}

function getStatus({ totalItems, overdueCount, todayCount, next7DaysCount }) {
  if (totalItems === 0) return 'empty';
  if (overdueCount > 0) return 'attention';
  if (todayCount > 0 || next7DaysCount > 0) return 'active';
  return 'quiet';
}

function getTitle(status) {
  if (status === 'empty') return 'Your planner is empty';
  if (status === 'attention') return 'Planner needs cleanup';
  if (status === 'active') return 'Planner is ready';
  return 'Planner has future items';
}

export function getPlannerEvidence(planData, options = {}) {
  const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const todayMs = startOfDayMs(nowMs);
  const next7Ms = todayMs + 7 * 24 * 60 * 60 * 1000;

  const items = flattenPlannerData(planData);
  const dateGroups = getDateGroups(items, nowMs);
  const categoryCounts = countBy(items, item => item.category);

  const todayCount = dateGroups
    .filter(group => group.isToday)
    .reduce((sum, group) => sum + group.count, 0);

  const next7DaysCount = dateGroups
    .filter(group => group.isNext7Days)
    .reduce((sum, group) => sum + group.count, 0);

  const overdueCount = dateGroups
    .filter(group => group.isOverdue)
    .reduce((sum, group) => sum + group.count, 0);

  const undatedCount = dateGroups
    .filter(group => group.isUndated)
    .reduce((sum, group) => sum + group.count, 0);

  const totalItems = items.length;
  const status = getStatus({ totalItems, overdueCount, todayCount, next7DaysCount });

  const notes = [];

  if (totalItems === 0) {
    notes.push('No saved planner items yet. Add events from Up Ahead.');
  } else {
    notes.push(`${totalItems} saved planner item(s) across ${dateGroups.length} date group(s).`);
  }

  if (todayCount > 0) notes.push(`${todayCount} item(s) are scheduled for today.`);
  if (next7DaysCount > 0) notes.push(`${next7DaysCount} item(s) fall within the next 7 days.`);
  if (overdueCount > 0) notes.push(`${overdueCount} overdue item(s) need review.`);
  if (undatedCount > 0) notes.push(`${undatedCount} undated item(s) need a date.`);
  if (categoryCounts.length > 0) notes.push(`${categoryCounts.length} category bucket(s) represented.`);

  return {
    status,
    title: getTitle(status),
    totalItems,
    todayCount,
    next7DaysCount,
    overdueCount,
    undatedCount,
    dateGroupCount: dateGroups.length,
    categoryCount: categoryCounts.length,
    dateGroups,
    categoryCounts,
    upcomingItems: items
      .filter(item => {
        const dayMs = startOfDayMs(item.dateKey);
        return !Number.isNaN(dayMs) && dayMs >= todayMs && dayMs <= next7Ms;
      })
      .sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)))
      .slice(0, 6),
    notes
  };
}

export default getPlannerEvidence;