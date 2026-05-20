import { describe, expect, it } from 'vitest';
import {
  getSnapshotIntakeSummary,
  getSnapshotPoolHealth,
  getSnapshotStorySlot,
  normalizeSnapshotStory,
  selectSnapshotStoriesForSlot,
} from './insightSnapshotIntake';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const H = 3_600_000;

function rawStory(index, ageHours, source = 'Source A', category = 'general') {
  return {
    id: `story-${index}`,
    title: `Acme Bank outage angle story ${index}`,
    summary: `Official market public explainer context for Acme Bank outage ${index}`,
    source,
    sourceGroup: source,
    url: `https://example.com/story-${index}`,
    publishedAt: NOW - ageHours * H,
    category,
    language: 'en',
  };
}

describe('Insight snapshot intake recovery certification', () => {
  it('normalizes snapshot stories before pipeline intake', () => {
    const normalized = normalizeSnapshotStory({
      headline: 'Headline only',
      description: 'Description only',
      publisher: 'My Publisher',
      link: 'https://example.com/a',
      pubDate: NOW,
    }, 0);

    expect(normalized.title).toBe('Headline only');
    expect(normalized.summary).toBe('Description only');
    expect(normalized.sourceGroup).toBe('my_publisher');
    expect(normalized.url).toBe('https://example.com/a');
    expect(normalized.publishedAt).toBe(NOW);
  });

  it('assigns snapshot stories to expected age slots', () => {
    expect(getSnapshotStorySlot(rawStory(1, 2), NOW)).toBe('now');
    expect(getSnapshotStorySlot(rawStory(2, 8), NOW)).toBe('minus4h');
    expect(getSnapshotStorySlot(rawStory(3, 18), NOW)).toBe('minus12h');
    expect(getSnapshotStorySlot(rawStory(4, 30), NOW)).toBe('minus24h');
  });

  it('fills thin now slot from nearby snapshot pool deterministically', () => {
    const snapshot = {
      schemaVersion: 2,
      fetchedAt: NOW,
      stories: [
        rawStory(1, 7, 'Gov Desk', 'policy'),
        rawStory(2, 8, 'Market Desk', 'business'),
        rawStory(3, 9, 'Analysis Desk', 'analysis'),
        rawStory(4, 10, 'Public Desk', 'society'),
        rawStory(5, 11, 'Explainer Desk', 'explainer'),
      ],
    };

    const selected = selectSnapshotStoriesForSlot(snapshot, 'now', {
      nowMs: NOW,
      minStoriesPerSlot: 4,
      maxStoriesPerSlot: 5,
    });

    expect(selected.length).toBe(5);
    expect(selected.some(story => story._snapshotIntake.fallback)).toBe(true);
    expect(selected[0]._snapshotIntake.requestedSlot).toBe('now');
  });

  it('reports pool health and selected slot coverage', () => {
    const snapshot = {
      schemaVersion: 2,
      fetchedAt: NOW,
      stories: [
        rawStory(1, 2, 'Wire', 'national'),
        rawStory(2, 7, 'Gov', 'policy'),
        rawStory(3, 18, 'Market', 'business'),
        rawStory(4, 31, 'Explainer', 'explainer'),
      ],
    };

    const health = getSnapshotPoolHealth(snapshot, NOW);
    const summary = getSnapshotIntakeSummary(snapshot, {
      nowMs: NOW,
      minStoriesPerSlot: 2,
      maxStoriesPerSlot: 4,
    });

    expect(health.usable24hStories).toBe(4);
    expect(summary.selectedBySlot.now).toBeGreaterThanOrEqual(2);
    expect(summary.sourceGroupCount).toBeGreaterThanOrEqual(4);
  });
});
