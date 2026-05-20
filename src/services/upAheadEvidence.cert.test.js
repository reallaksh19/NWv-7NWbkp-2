import { describe, expect, it } from 'vitest';
import { getUpAheadEvidence } from './upAheadEvidence';

describe('Up Ahead evidence certification', () => {
  it('summarizes category, timeline, plan and visible filtering evidence', () => {
    const evidence = getUpAheadEvidence({
      data: {
        sourceMode: 'live',
        sections: {
          movies: [{ title: 'Movie' }],
          events: [{ title: 'Event' }],
          shopping: [{ title: 'Offer' }],
          alerts: [{ title: 'Alert' }],
          weather_alerts: [{ title: 'Weather alert' }],
        },
        timeline: [
          { date: '2026-01-01', items: [{ title: 'Timeline item' }] },
          { date: '2026-01-02', items: [] },
        ],
        weekly_plan: [
          { date: '2026-01-01', items: [{ title: 'Plan item' }] },
        ],
      },
      settings: {
        upAhead: {
          categories: {
            movies: true,
            events: true,
            shopping: true,
            alerts: true,
            weather_alerts: true,
          },
          locations: ['Chennai', 'Muscat'],
        },
      },
      visible: {
        offerItems: [{ title: 'Offer' }],
        combinedAlerts: [{ title: 'Alert' }],
        weatherAlerts: [{ title: 'Weather alert' }],
        movieCards: [{ title: 'Movie' }],
        festivalCards: [],
      },
    });

    expect(evidence.status).toBe('strong');
    expect(evidence.sourceModeLabel).toBe('Live');
    expect(evidence.locationCount).toBe(2);
    expect(evidence.coveredCategories).toContain('movies');
    expect(evidence.visibleOfferCount).toBe(1);
    expect(evidence.visibleWeatherAlertCount).toBe(1);
    expect(evidence.timelineStats.itemCount).toBe(1);
    expect(evidence.weeklyPlanStats.itemCount).toBe(1);
    expect(evidence.qualityScore).toBeGreaterThanOrEqual(74);
  });

  it('handles empty data safely', () => {
    const evidence = getUpAheadEvidence({
      data: null,
      settings: {},
      visible: {},
    });

    expect(evidence.status).toBe('thin');
    expect(evidence.locationCount).toBe(1);
    expect(evidence.totalVisibleItems).toBe(0);
    expect(evidence.notes.join(' ')).toContain('No enabled category');
  });
});