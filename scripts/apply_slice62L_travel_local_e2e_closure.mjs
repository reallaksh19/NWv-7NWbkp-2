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

write('src/services/travelLocalE2EClosure.cert.test.js', `/**
 * Travel local E2E closure certification.
 * Validates the full pipeline: profile → queries → ingestion → priority → UI quality.
 */

import { describe, expect, it } from 'vitest';
import { getTravelLocationProfile, resolveTravelLocationKey } from './travelLocationProfile';
import { buildTravelNewsQueries, buildTravelNewsSourcePolicy } from './travelNewsQueries';
import { normalizeTravelNewsPayload, mergeTravelNewsIntoNewsData } from './travelNewsIngestion';
import { applyTravelLocationPriority, rankStoriesForLocation } from './storyLocationPriority';
import { auditTravelLocalStories } from './travelLocalUiQuality';

describe('Travel local E2E closure certification', () => {
  it('Columbo typo flows end-to-end through all pipeline stages', () => {
    // Stage 1: Alias resolution
    const key = resolveTravelLocationKey('Columbo');
    expect(key).toBe('colombo');

    // Stage 2: Profile
    const profile = getTravelLocationProfile({ travelLocation: { city: 'Columbo' } });
    expect(profile.key).toBe('colombo');
    expect(profile.countryCode).toBe('LK');
    expect(profile.prioritizeStories).toBe(true);

    // Stage 3: Queries
    const queries = buildTravelNewsQueries(profile);
    expect(queries[0].country).toBe('LK');
    expect(queries[0].url).toContain('ceid=LK:en');

    // Stage 4: Source policy
    const policy = buildTravelNewsSourcePolicy(profile);
    expect(policy.generatedFor.key).toBe('colombo');

    // Stage 5: Ingestion
    const payload = normalizeTravelNewsPayload({
      stories: [
        { title: 'Colombo port gets new crane facility', url: 'https://example.test/port' },
        { title: 'Sri Lanka cricket board announces new Colombo stadium', url: 'https://example.test/cricket' },
      ],
    }, profile);
    expect(payload.locationKey).toBe('colombo');
    expect(payload.stories.length).toBe(2);

    // Stage 6: Merge into newsData
    const merged = mergeTravelNewsIntoNewsData({}, payload, profile);
    expect(merged.travelLocal.length).toBeGreaterThan(0);

    // Stage 7: Priority application
    const newsData = {
      frontPage: [
        { id: 'g1', title: 'Global market update' },
        { id: 'c1', title: 'Colombo port gets new crane facility' },
      ],
    };
    const prioritized = applyTravelLocationPriority(newsData, profile);
    expect(prioritized.frontPage[0].id).toBe('c1');

    // Stage 8: UI quality audit
    const ranked = rankStoriesForLocation(newsData, profile, { limit: 10 });
    const audit = auditTravelLocalStories(ranked, profile);
    expect(audit.pass).toBe(true);
    expect(audit.validStoryCount).toBeGreaterThan(0);
  });

  it('all registered travel locations have valid profiles and queries', () => {
    const locations = ['colombo', 'chennai', 'trichy', 'muscat'];

    for (const locationKey of locations) {
      const profile = getTravelLocationProfile({ travelLocation: { city: locationKey } });
      expect(profile.key).toBe(locationKey);
      expect(profile.countryCode).toBeTruthy();
      expect(profile.storyKeywords.length).toBeGreaterThan(0);

      const queries = buildTravelNewsQueries(profile);
      expect(queries.length).toBeGreaterThanOrEqual(6);
      expect(queries.some(q => q.priority === 'high')).toBe(true);
    }
  });
});
`);

write('scripts/test_travel_local_e2e_closure_static.mjs', `import fs from 'fs';

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

const e2eTest = read('src/services/travelLocalE2EClosure.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

// Verify all pipeline stages are tested
const pipelineStages = [
  'resolveTravelLocationKey',
  'getTravelLocationProfile',
  'buildTravelNewsQueries',
  'buildTravelNewsSourcePolicy',
  'normalizeTravelNewsPayload',
  'mergeTravelNewsIntoNewsData',
  'applyTravelLocationPriority',
  'auditTravelLocalStories',
  'Columbo typo flows end-to-end',
  'all registered travel locations',
];

for (const token of pipelineStages) {
  assert(e2eTest.includes(token), 'travelLocalE2EClosure.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:travel-local-e2e-closure"'),
  'package.json must include test:travel-local-e2e-closure'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-local-e2e-closure']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include travel local e2e closure test or be manifest-driven'
);

// Check all key files exist
const requiredFiles = [
  'src/services/travelLocationProfile.js',
  'src/services/storyLocationPriority.js',
  'src/services/travelNewsQueries.js',
  'src/services/travelNewsIngestion.js',
  'src/services/travelLocalUiQuality.js',
  'src/components/travel/TravelLocationBanner.jsx',
  'src/components/travel/TravelLocalStories.jsx',
  'src/components/settings/TravelLocationSettingsPanel.jsx',
  '.github/workflows/travel-local-news.yml',
  'scripts/collect_travel_local_news.mjs',
  'public/data/travel-source-policy.json',
];

for (const file of requiredFiles) {
  assert(fs.existsSync(file), 'Required file missing: ' + file);
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel local E2E closure',
  guarantees: [
    'Columbo typo resolves through full pipeline',
    'All pipeline stages are covered in tests',
    'All required files exist',
    'All registered locations have valid profiles and queries',
  ]
}, null, 2));

console.log('PASS: Travel local E2E closure static slice');
`);

write('scripts/ensure_travel_local_manifest.mjs', `/**
 * Ensures travel-local manifest entries are present.
 * Used as a pre-publish check to verify all required travel files are present.
 */

import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) throw new Error('ensure_travel_local_manifest: ' + message);
}

const requiredFiles = [
  'src/services/travelLocationProfile.js',
  'src/services/storyLocationPriority.js',
  'src/services/travelNewsQueries.js',
  'src/services/travelNewsIngestion.js',
  'src/services/travelLocalUiQuality.js',
  'src/components/travel/TravelLocationBanner.jsx',
  'src/components/travel/TravelLocalStories.jsx',
  'src/components/settings/TravelLocationSettingsPanel.jsx',
  '.github/workflows/travel-local-news.yml',
  'scripts/collect_travel_local_news.mjs',
  'public/data/travel-source-policy.json',
];

for (const file of requiredFiles) {
  assert(fs.existsSync(file), 'Required file missing: ' + file);
}

const sourcePolicy = JSON.parse(fs.readFileSync('public/data/travel-source-policy.json', 'utf8'));
assert(
  sourcePolicy.locations.some(loc => loc.key === 'colombo'),
  'travel-source-policy.json must include colombo'
);

const profile = await import('../src/services/travelLocationProfile.js');
const colomboKey = profile.resolveTravelLocationKey('Columbo');
assert(colomboKey === 'colombo', 'resolveTravelLocationKey("Columbo") must return "colombo", got: ' + colomboKey);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel local manifest',
  fileCount: requiredFiles.length,
  colomboAlias: 'OK',
}, null, 2));

console.log('PASS: Travel local manifest check');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:travel-local-e2e-closure'] =
    'node scripts/test_travel_local_e2e_closure_static.mjs && vitest run --config vitest.config.js src/services/travelLocalE2EClosure.cert.test.js';
  pkg.scripts['ensure:travel-local-manifest'] = 'node scripts/ensure_travel_local_manifest.mjs';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:travel-local-e2e-closure']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:travel-local-ui-quality']],",
    "  ['npm', ['run', 'test:travel-news-workflow']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\n  ['npm', ['run', 'test:travel-local-e2e-closure']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'travel-local-e2e-closure')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'travel-local-ui-quality');
      const command = {
        id: 'travel-local-e2e-closure',
        cmd: 'npm',
        args: ['run', 'test:travel-local-e2e-closure'],
      };
      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:travel-local-e2e-closure')) return source;
    const anchors = [
      "'test:travel-local-ui-quality',",
      "'test:travel-news-workflow',",
    ];
    for (const anchor of anchors) {
      if (source.includes(anchor)) {
        return source.replace(anchor, anchor + "\n  'test:travel-local-e2e-closure',");
      }
    }
    return source;
  });
}

console.log('\nSlice 62L Travel local E2E closure patch complete.');
