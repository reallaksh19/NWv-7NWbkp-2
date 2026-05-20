import { describe, expect, it } from 'vitest';
import {
  auditTravelLocalStories,
  getStoriesDisplayMode,
  TRAVEL_UI_QUALITY_THRESHOLDS,
} from './travelLocalUiQuality';
import { getTravelLocationProfile } from './travelLocationProfile';

const profile = getTravelLocationProfile({ travelLocation: { city: 'colombo' } });

describe('Travel local UI quality gate certification', () => {
  it('passes a valid set of Colombo stories', () => {
    const audit = auditTravelLocalStories([
      { title: 'Colombo airport resumes full operations after weather alert', _travelLocationScore: 80 },
      { title: 'Sri Lanka tourism ministry announces Colombo heritage walk', _travelLocationScore: 65 },
    ], profile);

    expect(audit.pass).toBe(true);
    expect(audit.issues).toHaveLength(0);
    expect(audit.validStoryCount).toBeGreaterThanOrEqual(1);
  });

  it('fails with no stories', () => {
    const audit = auditTravelLocalStories([], profile);
    expect(audit.pass).toBe(false);
    expect(audit.issues.some(i => i.code === 'NO_STORIES')).toBe(true);
  });

  it('warns on near-duplicate titles', () => {
    const audit = auditTravelLocalStories([
      { title: 'Colombo airport resumes full operations after weather alert', _travelLocationScore: 80 },
      { title: 'Colombo airport resumes full operations after weather alert', _travelLocationScore: 78 },
    ], profile);

    expect(audit.warnings.some(w => w.code === 'NEAR_DUPLICATE')).toBe(true);
  });

  it('returns correct display mode', () => {
    const goodAudit = { pass: true, validStoryCount: 3, storyCount: 3 };
    const emptyAudit = { pass: false, validStoryCount: 0, storyCount: 0 };

    expect(getStoriesDisplayMode(goodAudit, profile)).toBe('stories');
    expect(getStoriesDisplayMode(emptyAudit, profile)).toBe('empty');
    expect(getStoriesDisplayMode(null, profile)).toBe('loading');
    expect(getStoriesDisplayMode(goodAudit, { ...profile, prioritizeStories: false })).toBe('hidden');
  });
});
