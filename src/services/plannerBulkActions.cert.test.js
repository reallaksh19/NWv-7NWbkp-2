import { describe, expect, it } from 'vitest';
import {
  getPlannerBulkActionSummary,
  makePlannerSelectionKey,
} from './plannerBulkActions';

const items = [
  { id: 'a', title: 'Concert', dateKey: '2026-01-01', category: 'events' },
  { id: 'b', title: 'Movie', dateKey: '2026-01-02', category: 'movies' },
  { id: 'c', title: 'Offer', dateKey: '2026-01-02', category: 'shopping' },
];

describe('Planner bulk actions certification', () => {
  it('creates stable planner selection keys', () => {
    expect(makePlannerSelectionKey(items[0])).toBe('2026-01-01::a');
  });

  it('summarizes selected planner items', () => {
    const selectedKeys = [
      makePlannerSelectionKey(items[0]),
      makePlannerSelectionKey(items[2]),
    ];

    const summary = getPlannerBulkActionSummary(items, selectedKeys);

    expect(summary.selectedCount).toBe(2);
    expect(summary.filteredCount).toBe(3);
    expect(summary.hasSelection).toBe(true);
    expect(summary.allFilteredSelected).toBe(false);
    expect(summary.categoryCounts.map(entry => entry.key)).toContain('events');
    expect(summary.dateCounts.map(entry => entry.key)).toContain('2026-01-02');
    expect(summary.canExportCalendar).toBe(true);
    expect(summary.canRemove).toBe(true);
  });

  it('detects select-all state', () => {
    const summary = getPlannerBulkActionSummary(
      items,
      items.map(makePlannerSelectionKey)
    );

    expect(summary.selectedCount).toBe(3);
    expect(summary.allFilteredSelected).toBe(true);
  });

  it('handles empty selection safely', () => {
    const summary = getPlannerBulkActionSummary(items, []);

    expect(summary.selectedCount).toBe(0);
    expect(summary.hasSelection).toBe(false);
    expect(summary.canExportCalendar).toBe(false);
    expect(summary.canRemove).toBe(false);
  });
});
