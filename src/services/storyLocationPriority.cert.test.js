import { describe, expect, it } from 'vitest';
import {
  applyTravelLocationPriority,
  rankStoriesForLocation,
  scoreStoryForLocation,
} from './storyLocationPriority';
import { getTravelLocationProfile } from './travelLocationProfile';

const colomboProfile = getTravelLocationProfile({
  travelLocation: { city: 'columbo' },
});

describe('Story location priority certification', () => {
  it('scores Colombo and Sri Lanka stories highly', () => {
    const score = scoreStoryForLocation({
      title: 'Colombo airport issues new travel advisory for Sri Lanka visitors',
      sourceGroup: 'travel',
    }, colomboProfile);

    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('ranks travel-local stories from mixed news data', () => {
    const ranked = rankStoriesForLocation({
      frontPage: [
        { id: '1', title: 'Global market update' },
        { id: '2', title: 'Sri Lanka updates Colombo tourism rules' },
      ],
      world: [
        { id: '3', title: 'Colombo weather disruption affects flights' },
      ],
    }, colomboProfile);

    // Story 2 has more location keywords (Sri Lanka + Colombo) so ranks first,
    // story 3 (Colombo only + world section bonus) ranks second, story 1 has no match
    expect(ranked.map(story => story.id)).toContain('2');
    expect(ranked.map(story => story.id)).toContain('3');
    expect(ranked.map(story => story.id)).not.toContain('1');
    expect(ranked[0].id).toBe('2');
  });

  it('applies location priority to arrays without dropping stories', () => {
    const newsData = {
      frontPage: [
        { id: '1', title: 'Global market update' },
        { id: '2', title: 'Colombo local transport update' },
      ],
    };

    const prioritized = applyTravelLocationPriority(newsData, colomboProfile);

    expect(prioritized.frontPage).toHaveLength(2);
    expect(prioritized.frontPage[0].id).toBe('2');
    expect(prioritized.travelLocal[0].id).toBe('2');
    expect(prioritized.travelLocationProfile.key).toBe('colombo');
  });
});
