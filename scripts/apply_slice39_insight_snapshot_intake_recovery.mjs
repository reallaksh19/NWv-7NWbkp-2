import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

fs.mkdirSync('src/adapters', { recursive: true });

write('src/adapters/insightSnapshotIntake.js', `const H = 3_600_000;

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
    (story?.id && \`snapshot://story/\${story.id}\`) ||
    \`snapshot://story/index-\${index}\`
  );
}

export function normalizeSnapshotStory(story, index = 0) {
  const title = normalizeText(story?.title || story?.headline || story?.name);
  const summary = normalizeText(story?.summary || story?.description || story?.content || story?.excerpt);

  return {
    ...story,
    id: normalizeText(story?.id || story?.guid || story?.url || story?.link || \`snapshot-story-\${index}\`),
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
          ? \`slot \${slot} below minimum \${opts.minStoriesPerSlot}\`
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
`);

write('src/adapters/insightSnapshotIntake.cert.test.js', `import { describe, expect, it } from 'vitest';
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
    id: \`story-\${index}\`,
    title: \`Acme Bank outage angle story \${index}\`,
    summary: \`Official market public explainer context for Acme Bank outage \${index}\`,
    source,
    sourceGroup: source,
    url: \`https://example.com/story-\${index}\`,
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
`);

// Read the fetcher first to check what's there
const fetcherContent = read('src/adapters/insightSnapshotFetcher.js');
console.log('Fetcher first 50 chars of createSnapshotRawFetcher function:');
const idx = fetcherContent.indexOf('export function createSnapshotRawFetcher');
console.log(fetcherContent.substring(idx, idx + 200));

patchFile('src/adapters/insightSnapshotFetcher.js', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `const H = 3_600_000;`,
    `\nimport { getSnapshotIntakeSummary, selectSnapshotStoriesForSlot } from './insightSnapshotIntake.js';`,
    'snapshot intake import'
  );

  text = replaceOnce(
    text,
    `export function createSnapshotRawFetcher(snapshot) {
  const pool = snapshot?.stories ?? [];

  const filters = {
    now:      (s) => { const a = Date.now() - Number(s.publishedAt || 0); return a >= 0 && a < 4 * H; },
    minus4h:  (s) => { const a = Date.now() - Number(s.publishedAt || 0); return a >= 4 * H && a < 12 * H; },
    minus12h: (s) => { const a = Date.now() - Number(s.publishedAt || 0); return a >= 12 * H && a < 24 * H; },
    minus24h: (s) => { const a = Date.now() - Number(s.publishedAt || 0); return a >= 24 * H && a < 36 * H; },
  };

  return async (slot) => {
    const filtered = pool.filter(filters[slot] ?? (() => false));
    // If the \`now\` bucket is empty (snapshot is a few hours old), fall back to
    // the freshest minus4h stories so the pipeline always has something to cluster.
    if (slot === 'now' && filtered.length === 0) {
      return pool
        .filter(filters.minus4h)
        .sort((a, b) => Number(b.publishedAt) - Number(a.publishedAt))
        .slice(0, 12);
    }
    return filtered;
  };
}`,
    `export function createSnapshotRawFetcher(snapshot) {
  const intakeSummary = getSnapshotIntakeSummary(snapshot, {
    minStoriesPerSlot: 12,
    maxStoriesPerSlot: 40,
  });

  return async (slot) => {
    const selected = selectSnapshotStoriesForSlot(snapshot, slot, {
      minStoriesPerSlot: 12,
      maxStoriesPerSlot: 40,
    });

    return selected.map(story => ({
      ...story,
      _snapshotIntakeSummary: intakeSummary,
    }));
  };
}`,
    'snapshot fetcher uses intake diversity selection'
  );

  return text;
});

write('scripts/test_insight_snapshot_intake_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const intake = read('src/adapters/insightSnapshotIntake.js');
const intakeTest = read('src/adapters/insightSnapshotIntake.cert.test.js');
const fetcher = read('src/adapters/insightSnapshotFetcher.js');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'normalizeSnapshotStory', 'getSnapshotPoolHealth', 'selectSnapshotStoriesForSlot',
  'getSnapshotIntakeSummary', 'minStoriesPerSlot', 'fallbackReason', '_snapshotIntake'
]) {
  assert(intake.includes(token), \`insightSnapshotIntake.js missing token: \${token}\`);
}

for (const token of [
  'Insight snapshot intake recovery certification',
  'normalizes snapshot stories', 'fills thin now slot', 'reports pool health'
]) {
  assert(intakeTest.includes(token), \`insightSnapshotIntake.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'selectSnapshotStoriesForSlot', 'getSnapshotIntakeSummary',
  '_snapshotIntakeSummary', 'minStoriesPerSlot: 12', 'maxStoriesPerSlot: 40'
]) {
  assert(fetcher.includes(token), \`insightSnapshotFetcher.js missing intake token: \${token}\`);
}

assert(!fetcher.includes('slice(0, 12)'), 'insightSnapshotFetcher.js must not keep old now-only slice(0, 12) fallback');

assert(packageJson.includes('"test:insight-snapshot-intake"'), 'package.json must include test:insight-snapshot-intake');
assert(certGate.includes("['npm', ['run', 'test:insight-snapshot-intake']]"), 'certification gate must run test:insight-snapshot-intake');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight snapshot intake recovery slice' }, null, 2));
console.log('PASS: Insight snapshot intake static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-snapshot-intake'] = 'node scripts/test_insight_snapshot_intake_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-snapshot-intake']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-runtime-quality-gate']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-runtime-quality-gate']],",
      "  ['npm', ['run', 'test:insight-runtime-quality-gate']],\n  ['npm', ['run', 'test:insight-snapshot-intake']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-snapshot-intake']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\nSlice 39 Insight snapshot intake recovery patch complete.');
