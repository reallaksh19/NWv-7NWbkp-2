import { describe, expect, it } from 'vitest';
import { getUpAheadBriefing } from './upAheadBriefing';

const NOW = new Date('2026-01-01T08:00:00Z').getTime();

describe('Up Ahead briefing certification', () => {
  it('builds urgent briefing from alerts, offers and dated items', () => {
    const briefing = getUpAheadBriefing({
      now: NOW,
      data: {
        sections: {
          events: [
            { id: 'event-1', title: 'Concert today', date: '2026-01-01T18:00:00Z' },
          ],
          sports: [
            { id: 'sports-1', title: 'Match tomorrow', date: '2026-01-02T18:00:00Z' },
          ],
        },
        timeline: [
          { date: '2026-01-01T12:00:00Z', items: [{ id: 'timeline-1', title: 'Timeline item' }] },
        ],
        weekly_plan: [
          { date: '2026-01-02T12:00:00Z', items: [{ id: 'plan-1', title: 'Plan item' }] },
        ],
      },
      settings: {
        upAhead: {
          locations: ['Chennai', 'Muscat'],
        },
      },
      visible: {
        combinedAlerts: [{ id: 'alert-1', title: 'Weather alert' }],
        offerItems: [{ id: 'offer-1', title: 'Airline offer', date: '2026-01-03T12:00:00Z' }],
        movieCards: [{ id: 'movie-1', title: 'Movie release', releaseDate: '2026-01-04T12:00:00Z' }],
        festivalCards: [],
      },
    });

    expect(briefing.status).toBe('urgent');
    expect(briefing.title).toBe('Alerts need attention');
    expect(briefing.locationLabel).toBe('Chennai, Muscat');
    expect(briefing.alertCount).toBe(1);
    expect(briefing.offerCount).toBe(1);
    expect(briefing.todayCount).toBeGreaterThanOrEqual(1);
    expect(briefing.next72hCount).toBeGreaterThanOrEqual(3);
    expect(briefing.highlights.length).toBeGreaterThan(0);
    expect(briefing.buckets.map(bucket => bucket.key)).toContain('next72h');
  });

  it('returns quiet state safely for empty inputs', () => {
    const briefing = getUpAheadBriefing({
      data: null,
      settings: {},
      visible: {},
      now: NOW,
    });

    expect(briefing.status).toBe('quiet');
    expect(briefing.locationLabel).toBe('Chennai');
    expect(briefing.highlights.length).toBe(0);
    expect(briefing.notes.join(' ')).toContain('No urgent');
  });
});