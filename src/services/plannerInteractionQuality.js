function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getStateLabel(state) {
  if (state === 'ready') return 'Ready';
  if (state === 'active') return 'Active';
  if (state === 'focused') return 'Focused';
  if (state === 'empty') return 'Empty';
  return 'Idle';
}

export function getPlannerInteractionQuality(input = {}) {
  const totalCount = asNumber(input.totalCount);
  const filteredCount = asNumber(input.filteredCount);
  const selectedCount = asNumber(input.selectedCount);
  const inspectorOpen = Boolean(input.inspectorOpen);
  const agendaEmpty = Boolean(input.agendaEmpty);
  const copyStatus = String(input.copyStatus || '');

  const checks = [
    {
      key: 'filters',
      label: 'Filtered view',
      state: filteredCount > 0 ? 'ready' : totalCount > 0 ? 'idle' : 'empty',
      detail: `${filteredCount} of ${totalCount} item(s) visible`,
    },
    {
      key: 'selection',
      label: 'Bulk selection',
      state: selectedCount > 0 ? 'active' : filteredCount > 0 ? 'ready' : 'idle',
      detail: selectedCount > 0
        ? `${selectedCount} selected item(s)`
        : 'Selection is available when filtered items are visible',
    },
    {
      key: 'inspector',
      label: 'Item inspector',
      state: inspectorOpen ? 'focused' : filteredCount > 0 ? 'ready' : 'idle',
      detail: inspectorOpen
        ? 'Inspector is open; Escape closes it'
        : 'Inspector can be opened from each planner row',
    },
    {
      key: 'agenda',
      label: 'Agenda export',
      state: agendaEmpty ? 'empty' : 'ready',
      detail: agendaEmpty
        ? 'No filtered agenda items to export'
        : 'Copy, TXT, JSON and print are available',
    },
    {
      key: 'copy',
      label: 'Copy status',
      state: copyStatus ? 'active' : 'idle',
      detail: copyStatus || 'No recent copy action',
    },
  ];

  const status = inspectorOpen
    ? 'focused'
    : selectedCount > 0
      ? 'active'
      : filteredCount > 0
        ? 'ready'
        : 'empty';

  const notes = [];

  if (filteredCount === 0 && totalCount > 0) {
    notes.push('Filters are hiding all saved planner items.');
  }

  if (selectedCount > 0) {
    notes.push('Bulk actions are enabled for selected items.');
  }

  if (inspectorOpen) {
    notes.push('Press Escape to close the item inspector.');
  }

  if (!agendaEmpty) {
    notes.push('Current filtered agenda can be copied, downloaded, or printed.');
  }

  if (notes.length === 0) {
    notes.push('Planner interaction controls are idle.');
  }

  return {
    status,
    statusLabel: getStateLabel(status),
    totalCount,
    filteredCount,
    selectedCount,
    inspectorOpen,
    agendaEmpty,
    copyStatus,
    checks,
    notes,
  };
}

export default getPlannerInteractionQuality;
