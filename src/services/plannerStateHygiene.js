import { makePlannerSelectionKey } from './plannerBulkActions';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKey(value) {
  return String(value || '').trim();
}

export function reconcilePlannerSelection(filteredItems, selectedKeys) {
  const validKeys = new Set(safeArray(filteredItems).map(makePlannerSelectionKey));
  const before = safeArray(selectedKeys);
  const after = before.filter(key => validKeys.has(key));

  return {
    selectedKeys: after,
    removedCount: before.length - after.length,
    changed: before.length !== after.length,
    validCount: validKeys.size,
  };
}

export function makeInspectorKey(item, fallbackDateKey = 'undated') {
  if (!item) return '';

  const dateKey = normalizeKey(
    item.dateKey ||
    item.eventDateKey ||
    item.planDate ||
    item.date ||
    item.releaseDate ||
    fallbackDateKey ||
    'undated'
  );

  const itemKey = normalizeKey(
    item.hiddenKey ||
    item.canonicalId ||
    item.id ||
    item.title
  );

  return `${dateKey}::${itemKey}`;
}

export function isPlannerInspectorStillValid(inspectedPlannerItem, filteredItems) {
  if (!inspectedPlannerItem?.item) return false;

  const inspectedKey = makeInspectorKey(
    inspectedPlannerItem.item,
    inspectedPlannerItem.dateKey
  );

  return safeArray(filteredItems).some(item => makeInspectorKey(item, item.dateKey) === inspectedKey);
}

export function getPlannerStateHygiene({
  filteredItems = [],
  selectedKeys = [],
  inspectedPlannerItem = null,
} = {}) {
  const selection = reconcilePlannerSelection(filteredItems, selectedKeys);
  const inspectorValid = inspectedPlannerItem
    ? isPlannerInspectorStillValid(inspectedPlannerItem, filteredItems)
    : true;

  const status = selection.removedCount > 0 || !inspectorValid ? 'needs-cleanup' : 'clean';

  const notes = [];

  if (selection.removedCount > 0) {
    notes.push(`${selection.removedCount} stale selected item(s) should be cleared.`);
  }

  if (!inspectorValid) {
    notes.push('Inspector item is no longer visible in the filtered planner view.');
  }

  if (notes.length === 0) {
    notes.push('Planner selection and inspector state are in sync with the filtered view.');
  }

  return {
    status,
    selection,
    inspectorValid,
    filteredCount: safeArray(filteredItems).length,
    selectedCount: safeArray(selectedKeys).length,
    cleanSelectedCount: selection.selectedKeys.length,
    notes,
  };
}

export default getPlannerStateHygiene;
