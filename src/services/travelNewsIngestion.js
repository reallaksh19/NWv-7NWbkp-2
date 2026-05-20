import {
  getTravelLocationProfile,
  isTravelLocationProfile,
} from './travelLocationProfile.js';
import {
  rankStoriesForLocation,
  scoreStoryForLocation,
} from './storyLocationPriority.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStoryId(story) {
  return String(story?.id || story?.url || story?.link || story?.title || story?.headline || '')
    .trim()
    .toLowerCase();
}

function normalizeTravelStory(story = {}, profile) {
  const title = story.title || story.headline || '';
  const url = story.url || story.link || story.guid || '';
  const source = story.source || story.sourceGroup || story.publisher || 'Travel local';

  return {
    ...story,
    id: story.id || url || title,
    title,
    headline: story.headline || title,
    url,
    link: story.link || url,
    source,
    sourceGroup: story.sourceGroup || source,
    section: story.section || 'travelLocal',
    category: story.category || 'Travel local',
    city: story.city || profile.display,
    country: story.country || profile.countryLabel,
    locationKey: profile.key,
    _travelLocationKey: profile.key,
    _travelLocationScore: scoreStoryForLocation(story, profile),
  };
}

export function normalizeTravelNewsPayload(payload = {}, profileInput = null) {
  const profile = isTravelLocationProfile(profileInput)
    ? profileInput
    : getTravelLocationProfile(profileInput || {});

  const rawStories = [
    ...asArray(payload.stories),
    ...asArray(payload.items),
    ...asArray(payload.travelLocal),
    ...asArray(payload.news),
  ];

  const seen = new Set();
  const stories = [];

  for (const story of rawStories) {
    const normalized = normalizeTravelStory(story, profile);
    const key = normalizeStoryId(normalized);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    stories.push(normalized);
  }

  return {
    schemaVersion: 1,
    type: 'travel-location-news-payload',
    locationKey: profile.key,
    display: profile.display,
    countryCode: profile.countryCode,
    countryLabel: profile.countryLabel,
    generatedAt: payload.generatedAt || payload.updatedAt || new Date().toISOString(),
    sourceMode: payload.sourceMode || 'runtime-json',
    stories,
  };
}

export function mergeTravelNewsIntoNewsData(newsData = {}, payload = {}, profileInput = null) {
  const profile = isTravelLocationProfile(profileInput)
    ? profileInput
    : getTravelLocationProfile(profileInput || {});

  const normalizedPayload = normalizeTravelNewsPayload(payload, profile);
  const existingTravel = asArray(newsData.travelLocal);
  const merged = [...normalizedPayload.stories, ...existingTravel];

  const seen = new Set();
  const deduped = merged.filter(story => {
    const key = normalizeStoryId(story);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rankedTravel = rankStoriesForLocation({
    travelLocal: deduped,
  }, profile, {
    limit: 12,
    minScore: 1,
  });

  return {
    ...newsData,
    travelLocal: rankedTravel,
    travelLocationPayload: normalizedPayload,
  };
}

export async function fetchTravelNewsPayload({ basePath = '/data', profile } = {}) {
  const resolvedProfile = isTravelLocationProfile(profile)
    ? profile
    : getTravelLocationProfile(profile || {});

  const paths = [
    `${basePath}/travel-local-${resolvedProfile.key}.json`,
    `${basePath}/travel-location-${resolvedProfile.key}.json`,
    `${basePath}/travel/${resolvedProfile.key}.json`,
  ];

  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) continue;

      const payload = await response.json();
      return normalizeTravelNewsPayload(payload, resolvedProfile);
    } catch {
      // Try next path.
    }
  }

  return normalizeTravelNewsPayload({
    stories: [],
    sourceMode: 'missing-json',
  }, resolvedProfile);
}
