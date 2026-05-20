import { describe, expect, it } from 'vitest';
import {
  buildCalendarEvent,
  buildCalendarFile,
  escapeICSText,
  formatUTCDateTimeForICS,
  resolveCalendarDate,
} from './calendar';

describe('Planner calendar export certification', () => {
  it('escapes ICS text safely', () => {
    expect(escapeICSText('A, B; C\\nD')).toBe('A\\, B\\; C\\\\nD');
  });

  it('formats UTC datetime for ICS', () => {
    expect(formatUTCDateTimeForICS('2026-01-01T08:30:15Z')).toBe('20260101T083015Z');
  });

  it('uses planner date keys as all-day calendar events', () => {
    const date = resolveCalendarDate({
      title: 'Concert',
      eventDateKey: '2026-01-03',
    });

    expect(date.allDay).toBe(true);
    expect(date.dateKey).toBe('2026-01-03');
    expect(date.endDateKey).toBe('2026-01-04');

    const event = buildCalendarEvent({
      title: 'Concert',
      description: 'Music event',
      eventDateKey: '2026-01-03',
      category: 'events',
    });

    expect(event).toContain('DTSTART;VALUE=DATE:20260103');
    expect(event).toContain('DTEND;VALUE=DATE:20260104');
    expect(event).toContain('SUMMARY:Concert');
    expect(event).toContain('CATEGORIES:events');
  });

  it('uses timed eventDate when available', () => {
    const event = buildCalendarEvent({
      title: 'Timed event',
      eventDate: '2026-01-03T10:00:00Z',
      endDate: '2026-01-03T11:30:00Z',
    });

    expect(event).toContain('DTSTART:20260103T100000Z');
    expect(event).toContain('DTEND:20260103T113000Z');
  });

  it('builds one ICS file with multiple events', () => {
    const file = buildCalendarFile([
      { title: 'First', eventDateKey: '2026-01-01' },
      { title: 'Second', eventDateKey: '2026-01-02' },
    ]);

    expect(file).toContain('BEGIN:VCALENDAR');
    expect(file.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(file).toContain('SUMMARY:First');
    expect(file).toContain('SUMMARY:Second');
  });

  it('preserves legacy title and description call style', () => {
    const event = buildCalendarEvent('Legacy title', 'Legacy description');

    expect(event).toContain('SUMMARY:Legacy title');
    expect(event).toContain('DESCRIPTION:Legacy description');
    expect(event).toContain('DTSTART:');
    expect(event).toContain('DTEND:');
  });
});
