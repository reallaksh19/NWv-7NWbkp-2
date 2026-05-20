import { describe, expect, it } from 'vitest';
import {
  getPlannerStateHygiene,
  isPlannerInspectorStillValid,
  makeInspectorKey,
  reconcilePlannerSelection,
} from './plannerStateHygiene';
import { makePlannerSelectionKey } from './plannerBulkActions';

const filteredItems = [
  { id: 'a', title: 'Concert', dateKey: '2026-01-01', category: 'events' },
  { id: 'b', title: 'Movie', dateKey: '2026-01-02', category: 'movies' },
];

describe('Planner state hygiene certification', () => {
  it('removes stale selected IDs from the filtered view', () => {
    const validKey = makePlannerSelectionKey(filteredItems[0]);
    const result = reconcilePlannerSelection(filteredItems, [
      validKey,
      '2026-01-09::missing',
    ]);

    expect(result.changed).toBe(true);
    expect(result.removedCount).toBe(1);
    expect(result.selectedKeys).toEqual([validKey]);
  });

  it('detects valid and stale inspector items', () => {
    expect(makeInspectorKey(filteredItems[0])).toBe('2026-01-01::a');

    expect(isPlannerInspectorStillValid({
      item: filteredItems[0],
      dateKey: '2026-01-01',
    }, filteredItems)).toBe(true);

    expect(isPlannerInspectorStillValid({
      item: { id: 'missing', title: 'Missing', dateKey: '2026-01-09' },
      dateKey: '2026-01-09',
    }, filteredItems)).toBe(false);
  });

  it('reports clean hygiene state', () => {
    const validKey = makePlannerSelectionKey(filteredItems[0]);

    const hygiene = getPlannerStateHygiene({
      filteredItems,
      selectedKeys: [validKey],
      inspectedPlannerItem: {
        item: filteredItems[0],
        dateKey: '2026-01-01',
      },
    });

    expect(hygiene.status).toBe('clean');
    expect(hygiene.selection.removedCount).toBe(0);
    expect(hygiene.inspectorValid).toBe(true);
  });

  it('reports cleanup state for stale selection and inspector', () => {
    const hygiene = getPlannerStateHygiene({
      filteredItems,
      selectedKeys: ['2026-01-09::missing'],
      inspectedPlannerItem: {
        item: { id: 'missing', title: 'Missing', dateKey: '2026-01-09' },
        dateKey: '2026-01-09',
      },
    });

    expect(hygiene.status).toBe('needs-cleanup');
    expect(hygiene.selection.removedCount).toBe(1);
    expect(hygiene.inspectorValid).toBe(false);
  });
});
