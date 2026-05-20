import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) return '';
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  if (!before) throw new Error(`Missing file: ${path}`);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

write('src/services/travelLocalUiQuality.js', `/**
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
  return String(value || '').toLowerCase().replace(/\\s+/g, ' ').trim();
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
      message: \`Only \${validStories.length} valid stories (need \${TRAVEL_UI_QUALITY_THRESHOLDS.minStories})\`,
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
`);

write('src/services/travelLocalUiQuality.cert.test.js', `import { describe, expect, it } from 'vitest';
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
`);

// Replace TravelLocalStories with quality-aware version
write('src/components/travel/TravelLocalStories.jsx', `import React from 'react';
import { rankStoriesForLocation } from '../../services/storyLocationPriority.js';
import { auditTravelLocalStories, getStoriesDisplayMode } from '../../services/travelLocalUiQuality.js';
import { sanitizeHtmlText } from '../../utils/htmlText.js';
import './TravelLocalStories.css';

function storyUrl(story) {
  return story?.url || story?.link || story?.href || '#';
}

export default function TravelLocalStories({ newsData, profile, limit = 5 }) {
  if (!profile?.prioritizeStories) return null;

  const stories = rankStoriesForLocation(newsData, profile, { limit });
  const audit = auditTravelLocalStories(stories, profile);
  const displayMode = getStoriesDisplayMode(audit, profile);

  if (displayMode === 'hidden') return null;

  if (displayMode === 'empty' || displayMode === 'low-quality') {
    return (
      <section className="travel-local-stories travel-local-stories--empty" data-travel-local-stories="empty">
        <header>
          <span>{profile.icon || '📍'} Travel local</span>
          <strong>{profile.display}</strong>
        </header>
        <p>No strong {profile.display} local story match yet. The GitHub prefetch/local source workflow should add more coverage.</p>
      </section>
    );
  }

  return (
    <section className="travel-local-stories" data-travel-local-stories="true">
      <header>
        <span>{profile.icon || '📍'} Travel local</span>
        <strong>{profile.display} / {profile.countryLabel}</strong>
      </header>

      <div className="travel-local-stories__list">
        {stories.map(story => (
          <a
            key={story.id || story.url || story.title}
            href={storyUrl(story)}
            target="_blank"
            rel="noopener noreferrer"
            className="travel-local-stories__item"
          >
            <strong>{sanitizeHtmlText(story.title || story.headline)}</strong>
            <span>
              {sanitizeHtmlText(story.source || story.sourceGroup || story._travelSection || 'Local source')}
              {' · score '}
              {story._travelLocationScore}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
`);

write('scripts/test_travel_local_ui_quality_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const quality = read('src/services/travelLocalUiQuality.js');
const qualityTest = read('src/services/travelLocalUiQuality.cert.test.js');
const storiesComponent = read('src/components/travel/TravelLocalStories.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'TRAVEL_UI_QUALITY_VERSION',
  'auditTravelLocalStories',
  'getStoriesDisplayMode',
  'NEAR_DUPLICATE',
  'NO_STORIES',
  'INSUFFICIENT_STORIES',
]) {
  assert(quality.includes(token), 'travelLocalUiQuality.js missing token: ' + token);
}

for (const token of [
  'Travel local UI quality gate certification',
  'passes a valid set of Colombo stories',
  'warns on near-duplicate titles',
  'returns correct display mode',
]) {
  assert(qualityTest.includes(token), 'travelLocalUiQuality.cert.test.js missing token: ' + token);
}

for (const token of [
  'auditTravelLocalStories',
  'getStoriesDisplayMode',
  'data-travel-local-stories',
]) {
  assert(storiesComponent.includes(token), 'TravelLocalStories.jsx missing quality gate token: ' + token);
}

assert(
  packageJson.includes('"test:travel-local-ui-quality"'),
  'package.json must include test:travel-local-ui-quality'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-local-ui-quality']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include travel local ui quality test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel local UI quality gate',
  guarantees: [
    'Quality audit function exists',
    'Near-duplicate detection exists',
    'TravelLocalStories uses quality gate',
    'Display mode logic exists',
  ]
}, null, 2));

console.log('PASS: Travel local UI quality gate static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:travel-local-ui-quality'] =
    'node scripts/test_travel_local_ui_quality_static.mjs && vitest run --config vitest.config.js src/services/travelLocalUiQuality.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:travel-local-ui-quality']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:travel-news-workflow']],",
    "  ['npm', ['run', 'test:travel-location-browser-smoke:static']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\n  ['npm', ['run', 'test:travel-local-ui-quality']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'travel-local-ui-quality')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'travel-news-workflow');
      const command = {
        id: 'travel-local-ui-quality',
        cmd: 'npm',
        args: ['run', 'test:travel-local-ui-quality'],
      };
      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:travel-local-ui-quality')) return source;
    const anchors = [
      "'test:travel-news-workflow',",
      "'test:travel-location-browser-smoke:static',",
    ];
    for (const anchor of anchors) {
      if (source.includes(anchor)) {
        return source.replace(anchor, anchor + "\n  'test:travel-local-ui-quality',");
      }
    }
    return source;
  });
}

console.log('\nSlice 62K Travel local UI quality gate patch complete.');
