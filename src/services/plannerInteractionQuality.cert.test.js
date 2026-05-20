import { describe, expect, it } from 'vitest';
import { getPlannerInteractionQuality } from './plannerInteractionQuality';

describe('Planner interaction quality certification', () => {
  it('reports ready state when filtered planner items are visible', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 5,
      filteredCount: 3,
      selectedCount: 0,
      inspectorOpen: false,
      agendaEmpty: false,
    });

    expect(quality.status).toBe('ready');
    expect(quality.checks.map(check => check.key)).toContain('agenda');
    expect(quality.notes.join(' ')).toContain('copied');
  });

  it('reports active state when bulk selection exists', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 5,
      filteredCount: 3,
      selectedCount: 2,
      inspectorOpen: false,
      agendaEmpty: false,
    });

    expect(quality.status).toBe('active');
    expect(quality.notes.join(' ')).toContain('Bulk actions');
  });

  it('reports focused state when inspector is open', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 5,
      filteredCount: 3,
      selectedCount: 0,
      inspectorOpen: true,
      agendaEmpty: false,
    });

    expect(quality.status).toBe('focused');
    expect(quality.notes.join(' ')).toContain('Escape');
  });

  it('reports empty state safely', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 0,
      filteredCount: 0,
      selectedCount: 0,
      inspectorOpen: false,
      agendaEmpty: true,
    });

    expect(quality.status).toBe('empty');
    expect(quality.checks.length).toBeGreaterThanOrEqual(5);
  });
});
