import { describe, expect, it } from 'vitest';
import { getPlannerViewModel } from './plannerViewModel';

const NOW = new Date('2026-01-01T08:00:00Z').getTime();

const planData = {
  '2026-01-01': [
    { id: 'today-event', title: 'Concert today', category: 'events' }
  ],
  '2026-01-03': [
    { id: 'movie-soon', title: 'Movie release', category: 'movies' },
    { id: 'offer-soon', title: 'Airline offer', category: 'shopping' }
  ],
  '2025-12-30': [
    { id: 'old-alert', title: 'Old alert', category: 'alerts' }
  ],
  undated: [
    { id: 'undated-note', title: 'Undated reminder', category: 'notes' }
  ]
};

describe('Planner view model certification', () => {
  it('filters planner items by search query', () => {
    const view = getPlannerViewModel(planData, { query: 'movie' }, { now: NOW });

    expect(view.totalCount).toBe(5);
    expect(view.filteredCount).toBe(1);
    expect(view.filteredItems[0].title).toBe('Movie release');
  });

  it('filters planner items by category', () => {
    const view = getPlannerViewModel(planData, { category: 'shopping' }, { now: NOW });

    expect(view.filteredCount).toBe(1);
    expect(view.filteredItems[0].category).toBe('shopping');
  });

  it('filters planner items by next 7 days', () => {
    const view = getPlannerViewModel(planData, { dateWindow: 'next7' }, { now: NOW });

    expect(view.filteredCount).toBe(3);
    expect(view.filteredItems.map(item => item.id)).toContain('today-event');
    expect(view.filteredItems.map(item => item.id)).toContain('movie-soon');
    expect(view.filteredItems.map(item => item.id)).toContain('offer-soon');
  });

  it('filters overdue and undated items separately', () => {
    const overdue = getPlannerViewModel(planData, { dateWindow: 'overdue' }, { now: NOW });
    const undated = getPlannerViewModel(planData, { dateWindow: 'undated' }, { now: NOW });

    expect(overdue.filteredCount).toBe(1);
    expect(overdue.filteredItems[0].id).toBe('old-alert');

    expect(undated.filteredCount).toBe(1);
    expect(undated.filteredItems[0].id).toBe('undated-note');
  });

  it('groups filtered planner items by date', () => {
    const view = getPlannerViewModel(planData, { dateWindow: 'next7' }, { now: NOW });

    expect(view.groupedDates.length).toBe(2);
    expect(view.groupedDates[0].dateKey).toBe('2026-01-01');
    expect(view.groupedDates[1].dateKey).toBe('2026-01-03');
  });
});