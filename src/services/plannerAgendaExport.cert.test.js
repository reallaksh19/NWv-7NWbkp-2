import { describe, expect, it } from 'vitest';
import {
  buildPlannerAgendaJson,
  buildPlannerAgendaText,
  getPlannerAgendaExport,
  makePlannerAgendaFilename,
} from './plannerAgendaExport';

const viewModel = {
  totalCount: 3,
  filteredCount: 2,
  groupedDates: [
    {
      dateKey: '2026-01-01',
      displayDate: 'Thursday, Jan 1, 2026',
      items: [
        {
          id: 'a',
          title: 'Concert',
          description: 'Evening event',
          category: 'events',
          dateKey: '2026-01-01',
          displayDate: 'Thursday, Jan 1, 2026',
          link: 'https://example.com/concert',
        },
      ],
    },
    {
      dateKey: '2026-01-03',
      displayDate: 'Saturday, Jan 3, 2026',
      items: [
        {
          id: 'b',
          title: 'Movie',
          category: 'movies',
          dateKey: '2026-01-03',
          displayDate: 'Saturday, Jan 3, 2026',
        },
      ],
    },
  ],
};

describe('Planner agenda export certification', () => {
  it('creates agenda export model from filtered planner view', () => {
    const agenda = getPlannerAgendaExport({
      viewModel,
      controls: {
        query: 'movie',
        category: 'all',
        dateWindow: 'next7',
        sortMode: 'date',
      },
      now: Date.parse('2026-01-01T00:00:00Z'),
    });

    expect(agenda.title).toBe('NWv7 Planner Agenda');
    expect(agenda.totalCount).toBe(3);
    expect(agenda.filteredCount).toBe(2);
    expect(agenda.groupCount).toBe(2);
    expect(agenda.items.length).toBe(2);
    expect(agenda.categoryCount).toBe(2);
    expect(agenda.controls.dateWindow).toBe('next7');
  });

  it('builds readable agenda text', () => {
    const agenda = getPlannerAgendaExport({ viewModel, now: Date.parse('2026-01-01T00:00:00Z') });
    const text = buildPlannerAgendaText(agenda);

    expect(text).toContain('NWv7 Planner Agenda');
    expect(text).toContain('Concert');
    expect(text).toContain('Movie');
    expect(text).toContain('https://example.com/concert');
  });

  it('builds agenda json', () => {
    const agenda = getPlannerAgendaExport({ viewModel, now: Date.parse('2026-01-01T00:00:00Z') });
    const json = buildPlannerAgendaJson(agenda);

    expect(JSON.parse(json).items.length).toBe(2);
  });

  it('creates predictable export filename', () => {
    expect(makePlannerAgendaFilename('txt')).toBe('nwv7_planner_agenda.txt');
    expect(makePlannerAgendaFilename('.json')).toBe('nwv7_planner_agenda.json');
  });

  it('handles empty agenda safely', () => {
    const agenda = getPlannerAgendaExport({ viewModel: { totalCount: 0, filteredCount: 0, groupedDates: [] } });
    const text = buildPlannerAgendaText(agenda);

    expect(agenda.empty).toBe(true);
    expect(text).toContain('No planner items match');
  });
});
