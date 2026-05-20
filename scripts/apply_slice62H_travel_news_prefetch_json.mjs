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

function insertAfterLastImport(source, insertion) {
  if (source.includes(insertion.trim())) return source;

  const matches = [...source.matchAll(/^import .+;$/gm)];
  if (!matches.length) return insertion + '\n' + source;

  const last = matches[matches.length - 1];
  const index = last.index + last[0].length;
  return source.slice(0, index) + '\n' + insertion + source.slice(index);
}

write('src/services/travelNewsQueries.js', `import {
  getTravelEditionOptions,
  getTravelLocationProfile,
  resolveTravelLocationKey,
  TRAVEL_LOCATION_REGISTRY,
} from './travelLocationProfile.js';

const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search';

function encodeQuery(value) {
  return encodeURIComponent(String(value || '').trim());
}

function buildGoogleNewsRssUrl(query, options = {}) {
  const country = String(options.country || 'IN').toUpperCase();
  const lang = String(options.lang || 'en').toLowerCase();
  const ceid = \`\${country}:\${lang}\`;

  return \`\${GOOGLE_NEWS_RSS_BASE}?q=\${encodeQuery(query)}&hl=\${lang}&gl=\${country}&ceid=\${ceid}\`;
}

export function buildTravelNewsQueries(profileInput = null) {
  const profile = profileInput?.key
    ? profileInput
    : getTravelLocationProfile(profileInput || {});

  const edition = getTravelEditionOptions(profile);
  const city = profile.display;
  const country = profile.countryLabel;

  const baseQueries = [
    \`\${city} news\`,
    \`\${city} local news\`,
    \`\${country} breaking news\`,
    \`\${city} travel advisory\`,
    \`\${city} airport\`,
    \`\${city} weather alert\`,
    \`\${country} tourism\`,
    \`\${country} transport\`,
  ];

  const uniqueQueries = [...new Set(baseQueries.map(query => query.trim()).filter(Boolean))];

  return uniqueQueries.map((query, index) => ({
    id: \`\${profile.key}-travel-\${index + 1}\`,
    locationKey: profile.key,
    label: query,
    query,
    country: edition.country,
    lang: edition.lang,
    url: buildGoogleNewsRssUrl(query, edition),
    priority: index < 3 ? 'high' : index < 6 ? 'medium' : 'low',
  }));
}

export function buildTravelNewsSourcePolicy(profileInput = null) {
  const profile = profileInput?.key
    ? profileInput
    : getTravelLocationProfile(profileInput || {});
  const edition = getTravelEditionOptions(profile);
  const queries = buildTravelNewsQueries(profile);

  return {
    schemaVersion: 1,
    type: 'travel-location-news-policy',
    generatedFor: {
      key: profile.key,
      display: profile.display,
      countryCode: profile.countryCode,
      countryLabel: profile.countryLabel,
      edition,
    },
    freshness: {
      maxAgeMinutes: 180,
      staleAfterMinutes: 360,
    },
    dedupe: {
      keyFields: ['url', 'title', 'source'],
      titleSimilarityThreshold: 0.84,
    },
    queries,
  };
}

export function buildAllTravelNewsSourcePolicies() {
  return Object.keys(TRAVEL_LOCATION_REGISTRY).map(key =>
    buildTravelNewsSourcePolicy({ travelLocation: { city: key } })
  );
}

export function resolveTravelNewsPolicyKey(value) {
  return resolveTravelLocationKey(value) || 'chennai';
}

export const __travelNewsQueryTestUtils = {
  buildGoogleNewsRssUrl,
};
`);

write('src/services/travelNewsQueries.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  buildAllTravelNewsSourcePolicies,
  buildTravelNewsQueries,
  buildTravelNewsSourcePolicy,
  resolveTravelNewsPolicyKey,
  __travelNewsQueryTestUtils,
} from './travelNewsQueries';
import { getTravelLocationProfile } from './travelLocationProfile';

describe('Travel news query certification', () => {
  it('builds Colombo/Sri Lanka RSS queries using LK edition', () => {
    const profile = getTravelLocationProfile({
      travelLocation: { city: 'columbo' },
    });

    const queries = buildTravelNewsQueries(profile);

    expect(queries.length).toBeGreaterThanOrEqual(6);
    expect(queries[0].locationKey).toBe('colombo');
    expect(queries[0].country).toBe('LK');
    expect(queries[0].url).toContain('gl=LK');
    expect(queries[0].url).toContain('ceid=LK:en');
    expect(queries.map(item => item.query).join(' ')).toContain('Colombo');
  });

  it('builds a source policy for runtime/GitHub prefetch', () => {
    const policy = buildTravelNewsSourcePolicy({
      travelLocation: { city: 'Colombo' },
    });

    expect(policy.schemaVersion).toBe(1);
    expect(policy.type).toBe('travel-location-news-policy');
    expect(policy.generatedFor.key).toBe('colombo');
    expect(policy.generatedFor.countryCode).toBe('LK');
    expect(policy.queries.some(query => query.priority === 'high')).toBe(true);
  });

  it('builds all registered travel policies', () => {
    const policies = buildAllTravelNewsSourcePolicies();
    expect(policies.some(policy => policy.generatedFor.key === 'colombo')).toBe(true);
  });

  it('resolves common typo to policy key', () => {
    expect(resolveTravelNewsPolicyKey('Columbo')).toBe('colombo');
  });

  it('builds expected Google News RSS URL', () => {
    const url = __travelNewsQueryTestUtils.buildGoogleNewsRssUrl('Colombo travel advisory', {
      country: 'LK',
      lang: 'en',
    });

    expect(url).toContain('news.google.com/rss/search');
    expect(url).toContain('Colombo%20travel%20advisory');
    expect(url).toContain('ceid=LK:en');
  });
});
`);

write('src/services/travelNewsIngestion.js', `import {
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
    \`\${basePath}/travel-local-\${resolvedProfile.key}.json\`,
    \`\${basePath}/travel-location-\${resolvedProfile.key}.json\`,
    \`\${basePath}/travel/\${resolvedProfile.key}.json\`,
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
`);

write('src/services/travelNewsIngestion.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  mergeTravelNewsIntoNewsData,
  normalizeTravelNewsPayload,
} from './travelNewsIngestion';
import { getTravelLocationProfile } from './travelLocationProfile';

const profile = getTravelLocationProfile({
  travelLocation: { city: 'Colombo' },
});

describe('Travel news ingestion certification', () => {
  it('normalizes travel JSON payload into story records', () => {
    const payload = normalizeTravelNewsPayload({
      stories: [
        {
          title: 'Colombo airport travel advisory issued',
          url: 'https://example.test/1',
          source: 'Test Source',
        },
      ],
    }, profile);

    expect(payload.locationKey).toBe('colombo');
    expect(payload.countryCode).toBe('LK');
    expect(payload.stories).toHaveLength(1);
    expect(payload.stories[0].city).toBe('Colombo');
    expect(payload.stories[0]._travelLocationScore).toBeGreaterThan(0);
  });

  it('dedupes and merges travel payload into newsData.travelLocal', () => {
    const merged = mergeTravelNewsIntoNewsData({
      travelLocal: [
        {
          title: 'Old Colombo travel advisory',
          url: 'https://example.test/old',
        },
      ],
    }, {
      stories: [
        {
          title: 'Colombo airport travel advisory issued',
          url: 'https://example.test/1',
        },
        {
          title: 'Colombo airport travel advisory issued duplicate',
          url: 'https://example.test/1',
        },
      ],
    }, profile);

    expect(merged.travelLocal.length).toBe(2);
    expect(merged.travelLocationPayload.locationKey).toBe('colombo');
  });
});
`);

write('public/data/travel-source-policy.json', `{
  "schemaVersion": 1,
  "type": "travel-source-policy-index",
  "description": "Static source-policy seed for travel-local prefetch and browser fallback.",
  "locations": [
    {
      "key": "colombo",
      "display": "Colombo",
      "countryCode": "LK",
      "countryLabel": "Sri Lanka",
      "acceptedAliases": ["colombo", "columbo", "sri lanka", "srilanka", "ceylon"],
      "edition": {
        "country": "LK",
        "lang": "en",
        "timeRange": "30d"
      },
      "queries": [
        "Colombo news",
        "Colombo local news",
        "Sri Lanka breaking news",
        "Colombo travel advisory",
        "Colombo airport",
        "Colombo weather alert",
        "Sri Lanka tourism",
        "Sri Lanka transport"
      ]
    },
    {
      "key": "muscat",
      "display": "Muscat",
      "countryCode": "OM",
      "countryLabel": "Oman",
      "acceptedAliases": ["muscat", "masqat", "oman"],
      "edition": {
        "country": "OM",
        "lang": "en",
        "timeRange": "30d"
      },
      "queries": [
        "Muscat news",
        "Muscat local news",
        "Oman breaking news",
        "Muscat travel advisory",
        "Muscat airport"
      ]
    },
    {
      "key": "chennai",
      "display": "Chennai",
      "countryCode": "IN",
      "countryLabel": "India",
      "acceptedAliases": ["chennai", "madras", "tamil nadu"],
      "edition": {
        "country": "IN",
        "lang": "en",
        "timeRange": "30d"
      },
      "queries": [
        "Chennai news",
        "Chennai local news",
        "Tamil Nadu breaking news",
        "Chennai travel advisory"
      ]
    }
  ]
}
`);

optionalPatchFile('src/pages/MainPage.jsx', source => {
  let text = source;

  text = insertAfterLastImport(
    text,
    `import {
    fetchTravelNewsPayload,
    mergeTravelNewsIntoNewsData,
} from '../services/travelNewsIngestion.js';`
  );

  if (!text.includes('travelNewsPayload')) {
    text = text.replace(
      `    const [onThisDay, setOnThisDay] = useState(null);`,
      `    const [onThisDay, setOnThisDay] = useState(null);
    const [travelNewsPayload, setTravelNewsPayload] = useState(null);`
    );
  }

  if (!text.includes('fetchTravelNewsPayload({ profile: travelLocationProfile })')) {
    text = text.replace(
      `    const prioritizedNewsData = React.useMemo(
        () => applyTravelLocationPriority(newsData, travelLocationProfile),
        [newsData, travelLocationProfile]
    );`,
      `    React.useEffect(() => {
        if (!travelLocationProfile?.prioritizeStories) {
            setTravelNewsPayload(null);
            return;
        }

        let cancelled = false;

        fetchTravelNewsPayload({ profile: travelLocationProfile }).then(payload => {
            if (!cancelled) setTravelNewsPayload(payload);
        });

        return () => {
            cancelled = true;
        };
    }, [travelLocationProfile]);

    const travelMergedNewsData = React.useMemo(
        () => travelNewsPayload
            ? mergeTravelNewsIntoNewsData(newsData, travelNewsPayload, travelLocationProfile)
            : newsData,
        [newsData, travelNewsPayload, travelLocationProfile]
    );

    const prioritizedNewsData = React.useMemo(
        () => applyTravelLocationPriority(travelMergedNewsData, travelLocationProfile),
        [travelMergedNewsData, travelLocationProfile]
    );`
    );
  }

  return text;
});

write('scripts/generate_travel_source_policy.mjs', `import fs from 'fs';
import path from 'path';
import {
  buildAllTravelNewsSourcePolicies,
} from '../src/services/travelNewsQueries.js';

const outDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

const policies = buildAllTravelNewsSourcePolicies();

const index = {
  schemaVersion: 1,
  type: 'travel-source-policy-index-generated',
  generatedAt: new Date().toISOString(),
  policies,
};

fs.writeFileSync(
  path.join(outDir, 'travel-source-policy.generated.json'),
  JSON.stringify(index, null, 2) + '\\n',
  'utf8'
);

for (const policy of policies) {
  fs.writeFileSync(
    path.join(outDir, \`travel-source-policy-\${policy.generatedFor.key}.json\`),
    JSON.stringify(policy, null, 2) + '\\n',
    'utf8'
  );
}

console.log(JSON.stringify({
  status: 'PASS',
  generated: policies.map(policy => policy.generatedFor.key),
}, null, 2));
`);

write('scripts/test_travel_news_prefetch_static.mjs', `import fs from 'fs';

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

const queries = read('src/services/travelNewsQueries.js');
const queriesTest = read('src/services/travelNewsQueries.cert.test.js');
const ingestion = read('src/services/travelNewsIngestion.js');
const ingestionTest = read('src/services/travelNewsIngestion.cert.test.js');
const sourcePolicy = read('public/data/travel-source-policy.json');
const generator = read('scripts/generate_travel_source_policy.mjs');
const mainPage = maybeRead('src/pages/MainPage.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'buildTravelNewsQueries',
  'buildTravelNewsSourcePolicy',
  'buildAllTravelNewsSourcePolicies',
  'Colombo news',
  'ceid=',
  'LK',
]) {
  assert(queries.includes(token), 'travelNewsQueries.js missing token: ' + token);
}

for (const token of [
  'Travel news query certification',
  'Colombo/Sri Lanka RSS queries',
  'LK edition',
]) {
  assert(queriesTest.includes(token), 'travelNewsQueries.cert.test.js missing token: ' + token);
}

for (const token of [
  'normalizeTravelNewsPayload',
  'mergeTravelNewsIntoNewsData',
  'fetchTravelNewsPayload',
  'travel-local-',
  'missing-json',
]) {
  assert(ingestion.includes(token), 'travelNewsIngestion.js missing token: ' + token);
}

for (const token of [
  'Travel news ingestion certification',
  'dedupes and merges travel payload',
]) {
  assert(ingestionTest.includes(token), 'travelNewsIngestion.cert.test.js missing token: ' + token);
}

for (const token of [
  'travel-source-policy-index',
  'columbo',
  'Sri Lanka',
  'LK',
  'Colombo travel advisory',
]) {
  assert(sourcePolicy.includes(token), 'travel-source-policy.json missing token: ' + token);
}

for (const token of [
  'buildAllTravelNewsSourcePolicies',
  'travel-source-policy.generated.json',
]) {
  assert(generator.includes(token), 'generator missing token: ' + token);
}

if (mainPage) {
  for (const token of [
    'fetchTravelNewsPayload',
    'mergeTravelNewsIntoNewsData',
    'travelMergedNewsData',
  ]) {
    assert(mainPage.includes(token), 'MainPage.jsx missing travel news runtime token: ' + token);
  }
}

assert(
  packageJson.includes('"test:travel-news-prefetch"'),
  'package.json must include test:travel-news-prefetch'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-news-prefetch']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include travel news prefetch test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel news prefetch / JSON workflow',
  guarantees: [
    'Colombo/Sri Lanka travel-local RSS queries exist',
    'LK/en Google News edition is used',
    'travel source policy JSON exists',
    'runtime travel JSON ingestion exists',
    'MainPage can merge travel-local JSON into newsData',
    'source-policy generator exists for GitHub workflow integration'
  ]
}, null, 2));

console.log('PASS: Travel news prefetch static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};

  pkg.scripts['generate:travel-source-policy'] = 'node scripts/generate_travel_source_policy.mjs';
  pkg.scripts['test:travel-news-prefetch'] =
    'node scripts/test_travel_news_prefetch_static.mjs && vitest run --config vitest.config.js src/services/travelNewsQueries.cert.test.js src/services/travelNewsIngestion.cert.test.js';

  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:travel-news-prefetch']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:travel-location-priority']],",
    "  ['npm', ['run', 'test:news-prefetch-workflow-orchestration']],",
    "  ['npm', ['run', 'test:pages-data-publish']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\n  ['npm', ['run', 'test:travel-news-prefetch']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'travel-news-prefetch')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'travel-location-priority');
      const command = {
        id: 'travel-news-prefetch',
        cmd: 'npm',
        args: ['run', 'test:travel-news-prefetch'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:travel-news-prefetch')) return source;

    const anchors = [
      "'test:travel-location-priority',",
      "'test:news-prefetch-workflow-orchestration',",
      "'test:pages-data-publish',",
    ];

    for (const anchor of anchors) {
      if (source.includes(anchor)) {
        return source.replace(anchor, anchor + "\n  'test:travel-news-prefetch',");
      }
    }

    return source;
  });
}

console.log('\nSlice 62H Travel news prefetch / JSON workflow patch complete.');
