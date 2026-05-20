function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDateLabel(dateKey) {
  if (!dateKey || dateKey === 'undated') return 'Undated';

  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateKey;

  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function normalizeAgendaItem(item, index) {
  return {
    id: safeText(item?.id || item?.hiddenKey || item?.canonicalId || item?.title || `item-${index}`),
    title: safeText(item?.title, 'Untitled planner item'),
    description: safeText(item?.description || item?.summary || ''),
    category: safeText(item?.category || item?.type || 'event', 'event'),
    dateKey: safeText(item?.dateKey || item?.eventDateKey || item?.planDate || item?.date || 'undated', 'undated'),
    displayDate: safeText(item?.displayDate || formatDateLabel(item?.dateKey), 'Undated'),
    link: safeText(item?.link || item?.url || ''),
  };
}

function normalizeAgendaGroups(groupedDates) {
  return safeArray(groupedDates).map(group => {
    const dateKey = safeText(group?.dateKey, 'undated');
    const items = safeArray(group?.items).map((item, index) => normalizeAgendaItem(item, index));

    return {
      dateKey,
      displayDate: safeText(group?.displayDate || formatDateLabel(dateKey), 'Undated'),
      count: items.length,
      items,
    };
  });
}

export function getPlannerAgendaExport({ viewModel, controls = {}, now = Date.now() } = {}) {
  const groups = normalizeAgendaGroups(viewModel?.groupedDates);
  const items = groups.flatMap(group => group.items);

  const categoryCounts = [...items.reduce((map, item) => {
    map.set(item.category, (map.get(item.category) || 0) + 1);
    return map;
  }, new Map()).entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return {
    title: 'NWv7 Planner Agenda',
    generatedAt: new Date(now).toISOString(),
    totalCount: Number(viewModel?.totalCount || 0),
    filteredCount: Number(viewModel?.filteredCount || items.length),
    groupCount: groups.length,
    categoryCount: categoryCounts.length,
    controls: {
      query: controls.query || '',
      category: controls.category || 'all',
      dateWindow: controls.dateWindow || 'all',
      sortMode: controls.sortMode || 'date',
    },
    groups,
    items,
    categoryCounts,
    empty: items.length === 0,
  };
}

export function buildPlannerAgendaText(agenda) {
  const data = agenda || getPlannerAgendaExport();

  const lines = [
    data.title || 'NWv7 Planner Agenda',
    `Generated: ${data.generatedAt}`,
    `Showing: ${data.filteredCount} of ${data.totalCount} item(s)`,
    `Filters: search="${data.controls?.query || ''}", category=${data.controls?.category || 'all'}, window=${data.controls?.dateWindow || 'all'}, sort=${data.controls?.sortMode || 'date'}`,
    '',
  ];

  if (data.empty) {
    lines.push('No planner items match the current view.');
    return lines.join('\n');
  }

  for (const group of safeArray(data.groups)) {
    lines.push(`## ${group.displayDate} (${group.count})`);

    for (const item of safeArray(group.items)) {
      lines.push(`- ${item.title} [${item.category}]`);
      if (item.description) lines.push(`  ${item.description}`);
      if (item.link) lines.push(`  Link: ${item.link}`);
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function buildPlannerAgendaJson(agenda) {
  return JSON.stringify(agenda || getPlannerAgendaExport(), null, 2);
}

function sanitizeFilename(value) {
  return String(value || 'nwv7_planner_agenda')
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'nwv7_planner_agenda';
}

export function downloadPlannerAgendaFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return false;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
  return true;
}

export function makePlannerAgendaFilename(extension = 'txt') {
  const cleanExtension = String(extension || 'txt').replace(/^\./, '');
  return `${sanitizeFilename('nwv7_planner_agenda')}.${cleanExtension}`;
}

export default getPlannerAgendaExport;
