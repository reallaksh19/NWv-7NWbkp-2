import { describe, expect, it } from 'vitest';
import { getPlannerItemInspector } from './plannerItemInspector';

describe('Planner item inspector certification', () => {
  it('normalizes item metadata for inspector display', () => {
    const detail = getPlannerItemInspector({
      id: 'movie-1',
      title: 'Movie release',
      description: 'A saved movie item',
      category: 'Movies',
      dateKey: '2026-01-03',
      link: 'https://example.com/movie',
      raw: {
        source: 'Cinema Desk',
      },
    });

    expect(detail.title).toBe('Movie release');
    expect(detail.category).toBe('movies');
    expect(detail.dateKey).toBe('2026-01-03');
    expect(detail.displayDate).toContain('2026');
    expect(detail.hasLink).toBe(true);
    expect(detail.source).toBe('Cinema Desk');
    expect(detail.facts.length).toBeGreaterThanOrEqual(4);
  });

  it('falls back safely for incomplete items', () => {
    const detail = getPlannerItemInspector({ title: 'Loose note' });

    expect(detail.title).toBe('Loose note');
    expect(detail.dateKey).toBe('undated');
    expect(detail.displayDate).toBe('Undated');
    expect(detail.hasLink).toBe(false);
    expect(detail.actionHints).toContain('Remove item with undo protection');
  });

  it('returns null safely for missing item', () => {
    expect(getPlannerItemInspector(null)).toBe(null);
  });
});
