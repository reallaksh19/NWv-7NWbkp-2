import { describe, expect, it } from 'vitest';
import { flattenPlannerData, getPlannerEvidence } from './plannerEvidence';

const NOW = new Date('2026-01-01T08:00:00Z').getTime();

describe('Planner evidence certification', () => {
  it('summarizes planner readiness, dates and categories', () => {
    const planData = {
      '2026-01-01': [
        { id: 'today-1', title: 'Concert', category: 'events' }
      ],
      '2026-01-03': [
        { id: 'soon-1', title: 'Movie', category: 'movies' },
        { id: 'soon-2', title: 'Offer', category: 'shopping' }
      ],
      '2025-12-30': [
        { id: 'old-1', title: 'Old item', category: 'alerts' }
      ],
      undated: [
        { id: 'undated-1', title: 'Undated item', category: 'events' }
      ]
    };

    const evidence = getPlannerEvidence(planData, { now: NOW });

    expect(evidence.status).toBe('attention');
    expect(evidence.totalItems).toBe(5);
    expect(evidence.todayCount).toBe(1);
    expect(evidence.next7DaysCount).toBe(3);
    expect(evidence.overdueCount).toBe(1);
    expect(evidence.undatedCount).toBe(1);
    expect(evidence.categoryCount).toBeGreaterThanOrEqual(3);
    expect(evidence.upcomingItems.length).toBe(3);
  });

  it('handles empty planner safely', () => {
    const evidence = getPlannerEvidence({}, { now: NOW });

    expect(evidence.status).toBe('empty');
    expect(evidence.totalItems).toBe(0);
    expect(evidence.notes.join(' ')).toContain('No saved planner items');
  });

  it('flattens planner data into normalized items', () => {
    const items = flattenPlannerData({
      '2026-01-02': [
        { title: 'Saved item', type: 'festival' }
      ]
    });

    expect(items.length).toBe(1);
    expect(items[0].dateKey).toBe('2026-01-02');
    expect(items[0].category).toBe('festival');
  });
});