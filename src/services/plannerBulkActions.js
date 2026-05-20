function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKeyPart(value) {
  return String(value || '').trim();
}

export function makePlannerSelectionKey(item) {
  const dateKey = normalizeKeyPart(item?.dateKey || item?.eventDateKey || item?.planDate || item?.date || 'undated');
  const itemKey = normalizeKeyPart(item?.hiddenKey || item?.canonicalId || item?.id || item?.title);

  return `${dateKey}::${itemKey}`;
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

export function getPlannerBulkActionSummary(filteredItems, selectedKeys) {
  const items = safeArray(filteredItems);
  const selectedSet = new Set(safeArray(selectedKeys));
  const selectedItems = items.filter(item => selectedSet.has(makePlannerSelectionKey(item)));

  const selectedCount = selectedItems.length;
  const filteredCount = items.length;

  return {
    filteredCount,
    selectedCount,
    selectedItems,
    hasSelection: selectedCount > 0,
    allFilteredSelected: filteredCount > 0 && selectedCount === filteredCount,
    categoryCounts: countBy(selectedItems, item => item.category),
    dateCounts: countBy(selectedItems, item => item.dateKey),
    title:
      selectedCount === 0
        ? 'No planner items selected'
        : `${selectedCount} planner item(s) selected`,
    canExportCalendar: selectedCount > 0,
    canRemove: selectedCount > 0,
  };
}

export default getPlannerBulkActionSummary;
