import {
  getTravelLocationProfile,
  isTravelLocationProfile,
} from './travelLocationProfile.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function storyText(story) {
  return normalize([
    story?.title,
    story?.headline,
    story?.summary,
    story?.description,
    story?.source,
    story?.sourceGroup,
    story?.category,
    story?.section,
    story?.location,
    story?.city,
    story?.country,
  ].filter(Boolean).join(' '));
}

function storyKey(story) {
  return String(story?.id || story?.url || story?.link || story?.title || story?.headline || '').trim();
}

function collectStories(newsData = {}) {
  const sections = [
    'frontPage',
    'topStories',
    'india',
    'chennai',
    'local',
    'world',
    'business',
    'sports',
    'buzz',
    'tech',
    'technology',
    'travel',
  ];

  const stories = [];

  for (const section of sections) {
    for (const story of asArray(newsData?.[section])) {
      stories.push({
        ...story,
        _travelSection: section,
      });
    }
  }

  for (const [key, value] of Object.entries(newsData || {})) {
    if (sections.includes(key)) continue;
    if (!Array.isArray(value)) continue;

    for (const story of value) {
      stories.push({
        ...story,
        _travelSection: key,
      });
    }
  }

  return stories;
}

export function scoreStoryForLocation(story, profile) {
  if (!story || !profile?.prioritizeStories) return 0;

  const text = storyText(story);
  if (!text) return 0;

  const keywords = [
    profile.key,
    profile.display,
    profile.countryLabel,
    profile.regionLabel,
    ...(profile.aliases || []),
    ...(profile.storyKeywords || []),
  ]
    .map(normalize)
    .filter(Boolean);

  let score = 0;

  for (const keyword of keywords) {
    if (!keyword) continue;

    if (text === keyword) score += 60;
    else if (text.includes(keyword)) {
      if (keyword === normalize(profile.display) || keyword === normalize(profile.key)) score += 42;
      else if (keyword === normalize(profile.countryLabel)) score += 30;
      else score += 18;
    }
  }

  const section = normalize(story?._travelSection || story?.section || story?.category);
  if (section.includes('local')) score += 12;
  if (section.includes('travel')) score += 10;
  if (section.includes('world') && profile.countryCode !== 'IN') score += 6;

  if (normalize(story?.country) === normalize(profile.countryLabel) || normalize(story?.country) === normalize(profile.countryCode)) {
    score += 30;
  }

  if (normalize(story?.city) === normalize(profile.display) || normalize(story?.location).includes(normalize(profile.display))) {
    score += 38;
  }

  return score;
}

export function rankStoriesForLocation(newsData = {}, profileInput = null, options = {}) {
  const profile = isTravelLocationProfile(profileInput)
    ? profileInput
    : getTravelLocationProfile(profileInput || {});

  const limit = options.limit || 8;
  const minScore = options.minScore ?? 18;
  const seen = new Set();

  return collectStories(newsData)
    .map(story => ({
      ...story,
      _travelLocationScore: scoreStoryForLocation(story, profile),
      _travelLocationKey: profile.key,
    }))
    .filter(story => story._travelLocationScore >= minScore)
    .sort((a, b) => b._travelLocationScore - a._travelLocationScore)
    .filter(story => {
      const key = storyKey(story);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function prioritizeStoryArrayForLocation(stories = [], profileInput = null) {
  const profile = isTravelLocationProfile(profileInput)
    ? profileInput
    : getTravelLocationProfile(profileInput || {});

  return asArray(stories)
    .map((story, index) => ({
      story,
      index,
      score: scoreStoryForLocation(story, profile),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map(item => ({
      ...item.story,
      _travelLocationScore: item.score,
      _travelLocationKey: profile.key,
    }));
}

export function applyTravelLocationPriority(newsData = {}, profileInput = null) {
  const profile = isTravelLocationProfile(profileInput)
    ? profileInput
    : getTravelLocationProfile(profileInput || {});

  if (!profile?.prioritizeStories) return newsData;

  const next = { ...newsData };

  for (const [key, value] of Object.entries(newsData || {})) {
    if (Array.isArray(value)) {
      next[key] = prioritizeStoryArrayForLocation(value, profile);
    }
  }

  next.travelLocal = rankStoriesForLocation(newsData, profile, { limit: 8 });
  next.travelLocationProfile = profile;

  return next;
}
