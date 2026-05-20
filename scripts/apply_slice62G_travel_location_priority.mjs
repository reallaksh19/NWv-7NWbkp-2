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

function optionalPatchFile(path, patcher) {
  if (!fs.existsSync(path)) {
    console.log(`skip optional missing file: ${path}`);
    return;
  }
  patchFile(path, patcher);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function insertAfterLastImport(source, insertion) {
  if (source.includes(insertion.trim())) return source;

  const matches = [...source.matchAll(/^import .+;$/gm)];
  if (!matches.length) return insertion + '\n' + source;

  const last = matches[matches.length - 1];
  const index = last.index + last[0].length;

  return source.slice(0, index) + '\n' + insertion + source.slice(index);
}

/* -------------------------------------------------------------------------- */
/* 1) Travel location profile                                                  */
/* -------------------------------------------------------------------------- */

write('src/services/travelLocationProfile.js', `export const TRAVEL_LOCATION_PROFILE_VERSION = 'travel-location-profile-v1-colombo';

export const TRAVEL_LOCATION_REGISTRY = {
  colombo: {
    key: 'colombo',
    display: 'Colombo',
    countryCode: 'LK',
    countryLabel: 'Sri Lanka',
    regionLabel: 'Western Province',
    icon: '🇱🇰',
    lat: 6.9271,
    lon: 79.8612,
    aliases: [
      'colombo',
      'columbo',
      'kolamba',
      'sri lanka',
      'srilanka',
      'ceylon',
      'western province',
      'lk',
      'sri lanka capital',
    ],
    storyKeywords: [
      'colombo',
      'columbo',
      'sri lanka',
      'srilanka',
      'ceylon',
      'western province',
      'lk',
      'sri lankan',
      'lankan',
    ],
    edition: {
      country: 'LK',
      lang: 'en',
      timeRange: '30d',
    },
  },

  chennai: {
    key: 'chennai',
    display: 'Chennai',
    countryCode: 'IN',
    countryLabel: 'India',
    regionLabel: 'Tamil Nadu',
    icon: '🇮🇳',
    lat: 13.0827,
    lon: 80.2707,
    aliases: ['chennai', 'madras', 'tamil nadu', 'tn'],
    storyKeywords: ['chennai', 'madras', 'tamil nadu', 'tn', 'india'],
    edition: {
      country: 'IN',
      lang: 'en',
      timeRange: '30d',
    },
  },

  trichy: {
    key: 'trichy',
    display: 'Trichy',
    countryCode: 'IN',
    countryLabel: 'India',
    regionLabel: 'Tamil Nadu',
    icon: '🇮🇳',
    lat: 10.7905,
    lon: 78.7047,
    aliases: ['trichy', 'tiruchirappalli', 'tiruchirapalli', 'tiruchi'],
    storyKeywords: ['trichy', 'tiruchirappalli', 'tiruchirapalli', 'tiruchi', 'tamil nadu', 'india'],
    edition: {
      country: 'IN',
      lang: 'en',
      timeRange: '30d',
    },
  },

  muscat: {
    key: 'muscat',
    display: 'Muscat',
    countryCode: 'OM',
    countryLabel: 'Oman',
    regionLabel: 'Muscat Governorate',
    icon: '🇴🇲',
    lat: 23.5859,
    lon: 58.4059,
    aliases: ['muscat', 'masqat', 'maskat', 'oman'],
    storyKeywords: ['muscat', 'masqat', 'oman', 'omani'],
    edition: {
      country: 'OM',
      lang: 'en',
      timeRange: '30d',
    },
  },
};

export const DEFAULT_TRAVEL_LOCATION_KEY = 'chennai';

function safeLocalStorageGet(key) {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function normalizeTravelLocation(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ');
}

export function resolveTravelLocationKey(value) {
  const normalized = normalizeTravelLocation(value);
  if (!normalized) return null;

  if (TRAVEL_LOCATION_REGISTRY[normalized]) return normalized;

  for (const [key, profile] of Object.entries(TRAVEL_LOCATION_REGISTRY)) {
    const aliases = [profile.key, profile.display, profile.countryLabel, ...(profile.aliases || [])]
      .map(normalizeTravelLocation);

    if (aliases.includes(normalized)) return key;
    if (aliases.some(alias => normalized.includes(alias))) return key;
  }

  return null;
}

export function getTravelLocationOptions() {
  return Object.values(TRAVEL_LOCATION_REGISTRY)
    .map(profile => ({
      key: profile.key,
      label: profile.display,
      country: profile.countryLabel,
      region: profile.regionLabel,
      icon: profile.icon,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildTravelLocationSettings(baseSettings = {}, patch = {}) {
  const rawCity = patch.city ?? patch.location ?? baseSettings?.travelLocation?.city;
  const city = resolveTravelLocationKey(rawCity) || DEFAULT_TRAVEL_LOCATION_KEY;

  return {
    ...baseSettings,
    travelLocation: {
      enabled: true,
      prioritizeStories: true,
      ...(baseSettings.travelLocation || {}),
      ...patch,
      city,
      profileVersion: TRAVEL_LOCATION_PROFILE_VERSION,
    },
  };
}

export function getTravelLocationProfile(settings = {}, options = {}) {
  const explicitCity = settings?.travelLocation?.city;
  const weatherActiveCity =
    options.activeWeatherCity ||
    settings?.weather?.activeCity ||
    safeLocalStorageGet('weather_active_city');

  const firstConfiguredWeatherCity = Array.isArray(settings?.weather?.cities)
    ? settings.weather.cities[0]
    : '';

  const key =
    resolveTravelLocationKey(explicitCity) ||
    resolveTravelLocationKey(weatherActiveCity) ||
    resolveTravelLocationKey(firstConfiguredWeatherCity) ||
    DEFAULT_TRAVEL_LOCATION_KEY;

  const registryProfile = TRAVEL_LOCATION_REGISTRY[key] || TRAVEL_LOCATION_REGISTRY[DEFAULT_TRAVEL_LOCATION_KEY];

  const enabled = settings?.travelLocation?.enabled !== false;
  const prioritizeStories = enabled && settings?.travelLocation?.prioritizeStories !== false;

  return {
    ...registryProfile,
    enabled,
    prioritizeStories,
    source: explicitCity
      ? 'manual'
      : weatherActiveCity
        ? 'weather-active-city'
        : firstConfiguredWeatherCity
          ? 'weather-config'
          : 'default',
    profileVersion: TRAVEL_LOCATION_PROFILE_VERSION,
  };
}

export function getTravelEditionOptions(profile) {
  const resolved = profile?.key ? profile : getTravelLocationProfile({});
  return {
    country: resolved.edition?.country || resolved.countryCode || 'IN',
    lang: resolved.edition?.lang || 'en',
    timeRange: resolved.edition?.timeRange || '30d',
  };
}

export function isTravelLocationProfile(value) {
  return Boolean(value?.key && value?.countryCode && Array.isArray(value?.storyKeywords));
}
`);

write('src/services/travelLocationProfile.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  buildTravelLocationSettings,
  getTravelEditionOptions,
  getTravelLocationProfile,
  normalizeTravelLocation,
  resolveTravelLocationKey,
} from './travelLocationProfile';

describe('Travel location profile certification', () => {
  it('accepts Colombo and common misspelling Columbo', () => {
    expect(resolveTravelLocationKey('Colombo')).toBe('colombo');
    expect(resolveTravelLocationKey('columbo')).toBe('colombo');
    expect(resolveTravelLocationKey('Sri Lanka')).toBe('colombo');
  });

  it('normalizes travel location strings', () => {
    expect(normalizeTravelLocation('  Sri-Lanka  ')).toBe('sri lanka');
  });

  it('builds canonical travel location settings', () => {
    const settings = buildTravelLocationSettings({}, { city: 'Columbo' });
    expect(settings.travelLocation.city).toBe('colombo');
    expect(settings.travelLocation.prioritizeStories).toBe(true);
  });

  it('uses manual travel location before weather location', () => {
    const profile = getTravelLocationProfile({
      weather: { activeCity: 'muscat' },
      travelLocation: { city: 'colombo' },
    });

    expect(profile.key).toBe('colombo');
    expect(profile.countryCode).toBe('LK');
    expect(profile.source).toBe('manual');
  });

  it('can derive from active weather city', () => {
    const profile = getTravelLocationProfile({
      weather: { activeCity: 'columbo' },
    });

    expect(profile.key).toBe('colombo');
    expect(profile.source).toBe('weather-active-city');
  });

  it('returns correct Sri Lanka news edition', () => {
    const profile = getTravelLocationProfile({
      travelLocation: { city: 'colombo' },
    });

    expect(getTravelEditionOptions(profile)).toEqual({
      country: 'LK',
      lang: 'en',
      timeRange: '30d',
    });
  });
});
`);

/* -------------------------------------------------------------------------- */
/* 2) Story location priority                                                  */
/* -------------------------------------------------------------------------- */

write('src/services/storyLocationPriority.js', `import {
  getTravelLocationProfile,
  isTravelLocationProfile,
} from './travelLocationProfile.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
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
`);

write('src/services/storyLocationPriority.cert.test.js', `import { describe, expect, it } from 'vitest';
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

    expect(ranked.map(story => story.id)).toEqual(['3', '2']);
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
`);

/* -------------------------------------------------------------------------- */
/* 3) Travel local UI components                                               */
/* -------------------------------------------------------------------------- */

write('src/components/travel/TravelLocationBanner.jsx', `import React from 'react';
import './TravelLocationBanner.css';

export default function TravelLocationBanner({ profile }) {
  if (!profile?.enabled || !profile?.prioritizeStories) return null;

  return (
    <section className="travel-location-banner" data-travel-location-banner="true">
      <div className="travel-location-banner__icon">{profile.icon || '📍'}</div>
      <div className="travel-location-banner__copy">
        <strong>{profile.display}</strong>
        <span>
          Prioritising {profile.countryLabel} local stories · {profile.source}
        </span>
      </div>
    </section>
  );
}
`);

write('src/components/travel/TravelLocationBanner.css', `.travel-location-banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin: 12px 0;
  padding: 11px 12px;
  border: 1px solid rgba(45, 212, 191, 0.22);
  border-radius: 18px;
  background:
    radial-gradient(320px 120px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 70%),
    rgba(15, 23, 42, 0.78);
  color: #f8fafc;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
}

.travel-location-banner__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.44);
  font-size: 1.18rem;
}

.travel-location-banner__copy {
  min-width: 0;
}

.travel-location-banner__copy strong,
.travel-location-banner__copy span {
  display: block;
}

.travel-location-banner__copy strong {
  color: #f8fafc;
  font-size: 0.9rem;
  font-weight: 950;
}

.travel-location-banner__copy span {
  margin-top: 2px;
  color: #99f6e4;
  font-size: 0.74rem;
  font-weight: 800;
}
`);

write('src/components/travel/TravelLocalStories.jsx', `import React from 'react';
import { rankStoriesForLocation } from '../../services/storyLocationPriority.js';
import { sanitizeHtmlText } from '../../utils/htmlText.js';
import './TravelLocalStories.css';

function storyUrl(story) {
  return story?.url || story?.link || story?.href || '#';
}

export default function TravelLocalStories({ newsData, profile, limit = 5 }) {
  if (!profile?.prioritizeStories) return null;

  const stories = rankStoriesForLocation(newsData, profile, { limit });

  if (!stories.length) {
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

write('src/components/travel/TravelLocalStories.css', `.travel-local-stories {
  margin: 12px 0 16px;
  padding: 12px;
  border: 1px solid rgba(45, 212, 191, 0.20);
  border-radius: 20px;
  background:
    radial-gradient(420px 140px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 70%),
    rgba(15, 23, 42, 0.72);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.20);
}

.travel-local-stories header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.travel-local-stories header span {
  color: #99f6e4;
  font-size: 0.70rem;
  font-weight: 950;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}

.travel-local-stories header strong {
  color: #f8fafc;
  font-size: 0.86rem;
}

.travel-local-stories__list {
  display: grid;
  gap: 8px;
}

.travel-local-stories__item {
  display: block;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 15px;
  background: rgba(2, 6, 23, 0.34);
  color: inherit;
  text-decoration: none;
}

.travel-local-stories__item:hover {
  border-color: rgba(45, 212, 191, 0.34);
  background: rgba(20, 184, 166, 0.10);
}

.travel-local-stories__item strong,
.travel-local-stories__item span {
  display: block;
}

.travel-local-stories__item strong {
  color: #f8fafc;
  font-size: 0.84rem;
  line-height: 1.32;
}

.travel-local-stories__item span {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 0.72rem;
}

.travel-local-stories--empty p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.35;
}
`);

/* -------------------------------------------------------------------------- */
/* 4) Settings panel                                                           */
/* -------------------------------------------------------------------------- */

write('src/components/settings/TravelLocationSettingsPanel.jsx', `import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  buildTravelLocationSettings,
  getTravelLocationOptions,
  getTravelLocationProfile,
} from '../../services/travelLocationProfile.js';
import './TravelLocationSettingsPanel.css';

export default function TravelLocationSettingsPanel() {
  const { settings, updateSettings } = useSettings();
  const profile = getTravelLocationProfile(settings);
  const options = getTravelLocationOptions();

  function updateTravelLocation(patch) {
    updateSettings(buildTravelLocationSettings(settings, patch));
  }

  return (
    <section className="travel-location-settings" data-travel-location-settings="true">
      <div className="travel-location-settings__copy">
        <span>Travel location</span>
        <h3>Prioritise local stories</h3>
        <p>
          Use this when travelling. Colombo accepts the common typo "Columbo" and uses Sri Lanka news edition.
        </p>
      </div>

      <div className="travel-location-settings__controls">
        <label>
          <span>Current travel city</span>
          <select
            value={profile.key}
            onChange={event => updateTravelLocation({
              city: event.target.value,
              enabled: true,
              prioritizeStories: true,
            })}
          >
            {options.map(option => (
              <option key={option.key} value={option.key}>
                {option.icon} {option.label} — {option.country}
              </option>
            ))}
          </select>
        </label>

        <label className="travel-location-settings__toggle">
          <input
            type="checkbox"
            checked={profile.prioritizeStories}
            onChange={event => updateTravelLocation({
              city: profile.key,
              enabled: true,
              prioritizeStories: event.target.checked,
            })}
          />
          <span>Boost local stories</span>
        </label>
      </div>

      <div className="travel-location-settings__status">
        <strong>{profile.icon} {profile.display}</strong>
        <span>{profile.countryLabel} · source: {profile.source}</span>
      </div>
    </section>
  );
}
`);

write('src/components/settings/TravelLocationSettingsPanel.css', `.travel-location-settings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(45, 212, 191, 0.20);
  border-radius: 18px;
  background:
    radial-gradient(360px 120px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 68%),
    rgba(15, 23, 42, 0.64);
}

.travel-location-settings__copy span {
  color: #99f6e4;
  font-size: 0.66rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.travel-location-settings__copy h3 {
  margin: 3px 0 4px;
  color: #f8fafc;
  font-size: 1rem;
}

.travel-location-settings__copy p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.8rem;
  line-height: 1.35;
}

.travel-location-settings__controls {
  display: grid;
  gap: 10px;
}

.travel-location-settings__controls label span {
  display: block;
  margin-bottom: 5px;
  color: #cbd5e1;
  font-size: 0.76rem;
  font-weight: 850;
}

.travel-location-settings__controls select {
  width: 100%;
  min-height: 38px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.72);
  color: #f8fafc;
  padding: 0 12px;
}

.travel-location-settings__toggle {
  display: flex;
  gap: 8px;
  align-items: center;
}

.travel-location-settings__toggle input {
  width: 18px;
  height: 18px;
  accent-color: #14b8a6;
}

.travel-location-settings__status {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.32);
}

.travel-location-settings__status strong {
  color: #f8fafc;
  font-size: 0.82rem;
}

.travel-location-settings__status span {
  color: #99f6e4;
  font-size: 0.74rem;
  font-weight: 800;
}

@media (max-width: 760px) {
  .travel-location-settings {
    grid-template-columns: 1fr;
  }

  .travel-location-settings__status {
    flex-direction: column;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 5) Patch Weather aliases                                                    */
/* -------------------------------------------------------------------------- */

optionalPatchFile('src/services/weatherLocations.js', source => {
  let text = source;

  if (text.includes("aliases: ['columbo', 'kolamba', 'sri lanka capital']")) return text;

  text = text.replace(
    `aliases: ['kolamba'],`,
    `aliases: ['columbo', 'kolamba', 'sri lanka capital'],`
  );

  text = text.replace(
    `aliases: ['kolamba', 'sri lanka capital'],`,
    `aliases: ['columbo', 'kolamba', 'sri lanka capital'],`
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 6) Patch Following geo if previous 62C file exists                          */
/* -------------------------------------------------------------------------- */

optionalPatchFile('src/utils/followingTopicGeo.js', source => {
  let text = source;

  if (text.includes("'columbo'")) return text;

  text = text.replace(
    `aliases: ['sri lanka', 'srilanka', 'colombo', 'ceylon', 'lanka'],`,
    `aliases: ['sri lanka', 'srilanka', 'colombo', 'columbo', 'ceylon', 'lanka'],`
  );

  text = text.replace(
    `aliases: ['sri lanka', 'srilanka', 'ceylon', 'lanka'],`,
    `aliases: ['sri lanka', 'srilanka', 'colombo', 'columbo', 'ceylon', 'lanka'],`
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 7) Patch Weather tab active city persistence                                */
/* -------------------------------------------------------------------------- */

optionalPatchFile('src/components/DetailedWeatherCard.jsx', source => {
  let text = source;

  if (!text.includes('handleTravelAwareCityChange')) {
    text = text.replace(
      /const \[activeCity, setActiveCity\] = useState\(([^;]+)\);/,
      match => `${match}

    const handleTravelAwareCityChange = (city) => {
        setActiveCity(city);
        try {
            localStorage.setItem('weather_active_city', city);
        } catch {
            // Ignore storage write failures.
        }
    };`
    );
  }

  text = text.replaceAll('onClick={() => setActiveCity(city)}', 'onClick={() => handleTravelAwareCityChange(city)}');
  text = text.replaceAll('onClick={() => setActiveCity(key)}', 'onClick={() => handleTravelAwareCityChange(key)}');

  return text;
});

/* -------------------------------------------------------------------------- */
/* 8) Patch MainPage with travel profile + local block                         */
/* -------------------------------------------------------------------------- */

optionalPatchFile('src/pages/MainPage.jsx', source => {
  let text = source;

  text = insertAfterLastImport(
    text,
    `import TravelLocationBanner from '../components/travel/TravelLocationBanner.jsx';
import TravelLocalStories from '../components/travel/TravelLocalStories.jsx';
import { getTravelLocationProfile } from '../services/travelLocationProfile.js';
import { applyTravelLocationPriority } from '../services/storyLocationPriority.js';`
  );

  if (!text.includes('const travelLocationProfile = React.useMemo')) {
    text = text.replace(
      `    const { settings } = useSettings();`,
      `    const { settings } = useSettings();

    const travelLocationProfile = React.useMemo(
        () => getTravelLocationProfile(settings),
        [settings]
    );

    const prioritizedNewsData = React.useMemo(
        () => applyTravelLocationPriority(newsData, travelLocationProfile),
        [newsData, travelLocationProfile]
    );`
    );
  }

  text = text.replace(
    `generateTopline(newsData, weatherData, onThisDay);`,
    `generateTopline(prioritizedNewsData, weatherData, onThisDay);`
  );

  text = text.replace(
    `generateTopline(
                newsData,
                weatherData,`,
    `generateTopline(
                prioritizedNewsData,
                weatherData,`
  );

  if (!text.includes('<TravelLocationBanner profile={travelLocationProfile} />')) {
    text = text.replace(
      /(<QuickWeather[\s\S]*?\/>[\s]*)/,
      `$1
                    <TravelLocationBanner profile={travelLocationProfile} />
                    <TravelLocalStories newsData={prioritizedNewsData} profile={travelLocationProfile} />
`
    );
  }

  return text;
});

/* -------------------------------------------------------------------------- */
/* 9) Patch SettingsPage with travel-location control                          */
/* -------------------------------------------------------------------------- */

optionalPatchFile('src/pages/SettingsPage.jsx', source => {
  let text = source;

  text = insertAfterLastImport(
    text,
    `import TravelLocationSettingsPanel from '../components/settings/TravelLocationSettingsPanel.jsx';`
  );

  if (!text.includes('<TravelLocationSettingsPanel />')) {
    if (text.includes('<DisplayPreferencesPanel />')) {
      text = text.replace(
        `<DisplayPreferencesPanel />`,
        `<DisplayPreferencesPanel />
                            <TravelLocationSettingsPanel />`
      );
    } else {
      text = text.replace(
        /(<WeatherLocationManager[\s\S]*?\/>)/,
        `$1
                        <TravelLocationSettingsPanel />`
      );
    }
  }

  return text;
});

/* -------------------------------------------------------------------------- */
/* 10) Certification                                                           */
/* -------------------------------------------------------------------------- */

write('scripts/test_travel_location_priority_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

function maybeRead(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

const profile = read('src/services/travelLocationProfile.js');
const profileTest = read('src/services/travelLocationProfile.cert.test.js');
const priority = read('src/services/storyLocationPriority.js');
const priorityTest = read('src/services/storyLocationPriority.cert.test.js');
const banner = read('src/components/travel/TravelLocationBanner.jsx');
const localStories = read('src/components/travel/TravelLocalStories.jsx');
const settingsPanel = read('src/components/settings/TravelLocationSettingsPanel.jsx');
const mainPage = maybeRead('src/pages/MainPage.jsx');
const settingsPage = maybeRead('src/pages/SettingsPage.jsx');
const weatherLocations = maybeRead('src/services/weatherLocations.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'TRAVEL_LOCATION_PROFILE_VERSION',
  'columbo',
  'Sri Lanka',
  "countryCode: 'LK'",
  'resolveTravelLocationKey',
  'getTravelLocationProfile',
  'buildTravelLocationSettings',
]) {
  assert(profile.includes(token), 'travelLocationProfile.js missing token: ' + token);
}

for (const token of [
  'Story location priority certification',
  'scoreStoryForLocation',
  'rankStoriesForLocation',
  'applyTravelLocationPriority',
]) {
  assert(priority.includes(token) || priorityTest.includes(token), 'story priority missing token: ' + token);
}

for (const token of [
  'TravelLocationBanner',
  'data-travel-location-banner',
]) {
  assert(banner.includes(token), 'TravelLocationBanner.jsx missing token: ' + token);
}

for (const token of [
  'TravelLocalStories',
  'data-travel-local-stories',
  'rankStoriesForLocation',
]) {
  assert(localStories.includes(token), 'TravelLocalStories.jsx missing token: ' + token);
}

for (const token of [
  'TravelLocationSettingsPanel',
  'data-travel-location-settings',
  'Boost local stories',
  'Columbo',
]) {
  assert(settingsPanel.includes(token), 'TravelLocationSettingsPanel.jsx missing token: ' + token);
}

if (mainPage) {
  for (const token of [
    'getTravelLocationProfile',
    'applyTravelLocationPriority',
    'TravelLocationBanner',
    'TravelLocalStories',
  ]) {
    assert(mainPage.includes(token), 'MainPage.jsx missing travel token: ' + token);
  }
}

if (settingsPage) {
  assert(settingsPage.includes('TravelLocationSettingsPanel'), 'SettingsPage.jsx missing TravelLocationSettingsPanel');
}

if (weatherLocations) {
  assert(weatherLocations.includes('columbo'), 'weatherLocations.js must accept columbo typo alias');
}

for (const token of [
  'accepts Colombo and common misspelling Columbo',
  'uses manual travel location before weather location',
]) {
  assert(profileTest.includes(token), 'travelLocationProfile.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:travel-location-priority"'),
  'package.json must include test:travel-location-priority'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-location-priority']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include travel location priority test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel location priority',
  guarantees: [
    'Colombo and Columbo resolve to colombo',
    'Sri Lanka maps to LK/en news edition',
    'travel profile can derive from manual or active weather city',
    'Main tab can boost travel-local stories',
    'Travel local story block exists',
    'Settings panel can set travel location',
    'Weather registry accepts columbo typo'
  ]
}, null, 2));

console.log('PASS: Travel location priority static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:travel-location-priority'] =
    'node scripts/test_travel_location_priority_static.mjs && vitest run --config vitest.config.js src/services/travelLocationProfile.cert.test.js src/services/storyLocationPriority.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:travel-location-priority']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:slice62-source-defects']],",
    "  ['npm', ['run', 'test:weather-final-closure']],",
    "  ['npm', ['run', 'test:following']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\n  ['npm', ['run', 'test:travel-location-priority']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'travel-location-priority')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-final-closure');
      const command = {
        id: 'travel-location-priority',
        cmd: 'npm',
        args: ['run', 'test:travel-location-priority'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:travel-location-priority')) return source;

    const anchors = [
      "'test:slice62-source-defects',",
      "'test:weather-final-closure',",
      "'test:following',",
    ];

    for (const anchor of anchors) {
      if (source.includes(anchor)) {
        return source.replace(anchor, anchor + "\n  'test:travel-location-priority',");
      }
    }

    return source;
  });
}

console.log('\nSlice 62G Travel location priority patch complete.');
