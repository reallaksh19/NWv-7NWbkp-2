/**
 * Travel local UI quality gate.
 * Checks whether the travel local story set meets minimum quality thresholds.
 */

export const TRAVEL_UI_QUALITY_VERSION = 'travel-ui-quality-v1';

export const TRAVEL_UI_QUALITY_THRESHOLDS = {
  minStories: 1,
  minScore: 18,
  titleMinLength: 12,
  titleMaxLength: 300,
  maxDuplicateTitleDistance: 0.84,
};

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function titleSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;

  if (longer.includes(shorter)) return shorter.length / longer.length;

  const words = new Set(na.split(' '));
  const bWords = nb.split(' ');
  const overlap = bWords.filter(w => words.has(w)).length;
  const total = new Set([...na.split(' '), ...nb.split(' ')]).size;

  return total > 0 ? overlap / total : 0;
}

// eslint-disable-next-line no-unused-vars
export function auditTravelLocalStories(stories = [], profile = null) {
  const issues = [];
  const warnings = [];

  if (!Array.isArray(stories) || stories.length === 0) {
    issues.push({ code: 'NO_STORIES', message: 'No travel local stories found' });
    return { pass: false, issues, warnings, storyCount: 0 };
  }

  const validStories = [];
  const seenTitles = [];

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    const title = story?.title || story?.headline || '';
    const score = story?._travelLocationScore ?? 0;

    if (!title) {
      warnings.push({ code: 'MISSING_TITLE', index: i, message: 'Story missing title' });
      continue;
    }

    if (title.length < TRAVEL_UI_QUALITY_THRESHOLDS.titleMinLength) {
      warnings.push({ code: 'TITLE_TOO_SHORT', index: i, title, message: 'Story title too short' });
    }

    if (score < TRAVEL_UI_QUALITY_THRESHOLDS.minScore) {
      warnings.push({ code: 'LOW_SCORE', index: i, title, score, message: 'Story score below threshold' });
    }

    const duplicate = seenTitles.find(
      seen => titleSimilarity(title, seen) >= TRAVEL_UI_QUALITY_THRESHOLDS.maxDuplicateTitleDistance
    );

    if (duplicate) {
      warnings.push({ code: 'NEAR_DUPLICATE', index: i, title, duplicate, message: 'Near-duplicate story title' });
    } else {
      seenTitles.push(title);
      validStories.push(story);
    }
  }

  if (validStories.length < TRAVEL_UI_QUALITY_THRESHOLDS.minStories) {
    issues.push({
      code: 'INSUFFICIENT_STORIES',
      message: `Only ${validStories.length} valid stories (need ${TRAVEL_UI_QUALITY_THRESHOLDS.minStories})`,
    });
  }

  return {
    pass: issues.length === 0,
    issues,
    warnings,
    storyCount: stories.length,
    validStoryCount: validStories.length,
    qualityVersion: TRAVEL_UI_QUALITY_VERSION,
  };
}

export function getStoriesDisplayMode(audit, profile) {
  if (!profile?.prioritizeStories) return 'hidden';
  if (!audit) return 'loading';
  if (audit.validStoryCount > 0) return 'stories';
  if (audit.storyCount > 0) return 'low-quality';
  return 'empty';
}
