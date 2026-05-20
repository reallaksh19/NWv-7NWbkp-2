const H = 3_600_000;

export const INSIGHT_SNAPSHOT_SLOT_NAMES = ['now', 'minus4h', 'minus12h', 'minus24h'];

const SLOT_WINDOWS = {
  now:      { min: 0,  max: 4  * H, center: 2  * H },
  minus4h:  { min: 4  * H, max: 12 * H, center: 8  * H },
  minus12h: { min: 12 * H, max: 24 * H, center: 18 * H },
  minus24h: { min: 24 * H, max: 36 * H, center: 30 * H },
};

const DEFAULT_INTAKE_OPTIONS = {
  minStoriesPerSlot: 12,
  maxStoriesPerSlot: 40,
  maxFallbackAgeHours: 48,
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeSourceGroup(story) {
  return normalizeText(
    story?.sourceGroup ||
    story?.source ||
    story?.publisher ||
    story?.provider ||
    'unknown_source',
    'unknown_source'
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown_source';
}

function normalizeUrl(story, index) {
  return normalizeText(
    story?.url ||
    story?.link ||
    story?.guid ||
    (story?.id && `snapshot://story/${story.id}`) ||
    `snapshot://story/index-${index}`
  );
}

export function normalizeSnapshotStory(story, index = 0) {
  const title = normalizeText(story?.title || story?.headline || story?.name);
  const summary = normalizeText(story?.summary || story?.description || story?.content || story?.excerpt);

  return {
    ...story,
    id: normalizeText(story?.id || story?.guid || story?.url || story?.link || `snapshot-story-${index}`),
    title,
    summary,
    source: normalizeText(story?.source || story?.publisher || story?.provider || story?.sourceGroup, 'Unknown source'),
    sourceGroup: normalizeSourceGroup(story),
    url: normalizeUrl(story, index),
    publishedAt: asNumber(story?.publishedAt || story?.published_at || story?.pubDate || story?.date),
    category: normalizeText(story?.category || story?.section || story?.topic || 'general', 'general'),
    region: normalizeText(story?.region || story?.country || ''),
    language: normalizeText(story?.language || 'en', 'en'),
  };
}

export function getSnapshotStoryAgeMs(story, nowMs = Date.now()) {
  return Math.max(0, nowMs - asNumber(story?.publishedAt));
}

export function getSnapshotStorySlot(story, nowMs = Date.now()) {
  const ageMs = getSnapshotStoryAgeMs(story, nowMs);

  for (const slot of INSIGHT_SNAPSHOT_SLOT_NAMES) {
    const win = SLOT_WINDOWS[slot];
    if (ageMs >= win.min && ageMs < win.max) return slot;
  }

  return ageMs >= SLOT_WINDOWS.minus24h.max ? 'older' : 'future';
}

function isValidSnapshotStory(story) {
  return Boolean(
    normalizeText(story?.title || story?.headline) &&
    normalizeText(story?.url || story?.link || story?.guid || story?.id) &&
    asNumber(story?.publishedAt || story?.published_at || story?.pubDate || story?.date) > 0
  );
}

function sortBySlotFit(stories, slot, nowMs) {
  const win = SLOT_WINDOWS[slot];

  return [...stories].sort((a, b) => {
    const aAge = getSnapshotStoryAgeMs(a, nowMs);
    const bAge = getSnapshotStoryAgeMs(b, nowMs);
    const aDistance = Math.abs(aAge - win.center);
    const bDistance = Math.abs(bAge - win.center);

    if (aDistance !== bDistance) return aDistance - bDistance;

    const bPublished = asNumber(b.publishedAt);
    const aPublished = asNumber(a.publishedAt);
    if (bPublished !== aPublished) return bPublished - aPublished;

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function uniqueStories(stories) {
  const seen = new Set();
  const result = [];

  for (const story of stories) {
    const key = normalizeText(story.url || story.link || story.id || story.title).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(story);
  }

  return result;
}

export function getSnapshotPoolHealth(snapshot, nowMs = Date.now()) {
  const normalizedStories = safeArray(snapshot?.stories)
    .map((story, index) => normalizeSnapshotStory(story, index))
    .filter(isValidSnapshotStory);

  const bySlot = {
    now: [],
    minus4h: [],
    minus12h: [],
    minus24h: [],
    older: [],
    future: [],
  };

  for (const story of normalizedStories) {
    const slot = getSnapshotStorySlot(story, nowMs);
    bySlot[slot].push(story);
  }

  const sourceGroups = new Set(normalizedStories.map(story => story.sourceGroup));
  const categories = new Set(normalizedStories.map(story => story.category));

  return {
    totalStories: normalizedStories.length,
    sourceGroupCount: sourceGroups.size,
    categoryCount: categories.size,
    slots: Object.fromEntries(
      Object.entries(bySlot).map(([slot, stories]) => [slot, stories.length])
    ),
    bySlot,
    usable24hStories:
      bySlot.now.length +
      bySlot.minus4h.length +
      bySlot.minus12h.length +
      bySlot.minus24h.length,
  };
}

export function selectSnapshotStoriesForSlot(snapshot, slot, options = {}) {
  const opts = {
    ...DEFAULT_INTAKE_OPTIONS,
    ...options,
  };

  const nowMs = asNumber(opts.nowMs, Date.now());
  const health = getSnapshotPoolHealth(snapshot, nowMs);
  const direct = health.bySlot[slot] || [];

  const maxFallbackAgeMs = opts.maxFallbackAgeHours * H;
  const fallbackPool = health.bySlot.now
    .concat(health.bySlot.minus4h)
    .concat(health.bySlot.minus12h)
    .concat(health.bySlot.minus24h)
    .concat(health.bySlot.older.filter(story => getSnapshotStoryAgeMs(story, nowMs) <= maxFallbackAgeMs));

  const directSorted = sortBySlotFit(direct, slot, nowMs);
  const selected = uniqueStories(directSorted).slice(0, opts.maxStoriesPerSlot);

  if (selected.length >= Math.min(opts.minStoriesPerSlot, opts.maxStoriesPerSlot)) {
    return selected.map(story => ({
      ...story,
      _snapshotIntake: {
        requestedSlot: slot,
        selectedFromSlot: getSnapshotStorySlot(story, nowMs),
        fallback: false,
        poolHealth: health.slots,
      },
    }));
  }

  const selectedKeys = new Set(selected.map(story => normalizeText(story.url || story.id || story.title).toLowerCase()));
  const fallbackCandidates = sortBySlotFit(fallbackPool, slot, nowMs)
    .filter(story => !selectedKeys.has(normalizeText(story.url || story.id || story.title).toLowerCase()));

  const filled = uniqueStories([...selected, ...fallbackCandidates])
    .slice(0, opts.maxStoriesPerSlot);

  return filled.map(story => {
    const selectedFromSlot = getSnapshotStorySlot(story, nowMs);

    return {
      ...story,
      _snapshotIntake: {
        requestedSlot: slot,
        selectedFromSlot,
        fallback: selectedFromSlot !== slot,
        fallbackReason: selected.length < opts.minStoriesPerSlot
          ? `slot ${slot} below minimum ${opts.minStoriesPerSlot}`
          : '',
        poolHealth: health.slots,
      },
    };
  });
}

export function getSnapshotIntakeSummary(snapshot, options = {}) {
  const nowMs = asNumber(options.nowMs, Date.now());
  const health = getSnapshotPoolHealth(snapshot, nowMs);

  const selectedBySlot = Object.fromEntries(
    INSIGHT_SNAPSHOT_SLOT_NAMES.map(slot => [
      slot,
      selectSnapshotStoriesForSlot(snapshot, slot, { ...options, nowMs }).length,
    ])
  );

  return {
    totalStories: health.totalStories,
    usable24hStories: health.usable24hStories,
    sourceGroupCount: health.sourceGroupCount,
    categoryCount: health.categoryCount,
    directSlots: health.slots,
    selectedBySlot,
    minStoriesPerSlot: options.minStoriesPerSlot || DEFAULT_INTAKE_OPTIONS.minStoriesPerSlot,
    maxStoriesPerSlot: options.maxStoriesPerSlot || DEFAULT_INTAKE_OPTIONS.maxStoriesPerSlot,
  };
}

export default selectSnapshotStoriesForSlot;
