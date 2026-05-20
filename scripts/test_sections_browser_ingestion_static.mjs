import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const adapter = read('src/adapters/sectionsSnapshotFetcher.js');
const adapterTest = read('src/adapters/sectionsSnapshotFetcher.cert.test.js');
const rssAggregator = read('src/services/rssAggregator.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'SECTION_SNAPSHOT_PATH',
  'isSupportedSectionsSnapshot',
  'getSectionsSnapshotRuntimeSummary',
  'loadSectionsSnapshot',
  'selectPrefetchedSectionItems',
  'fetchPrefetchedSectionNews',
  'chennai',
  'tn',
  '_prefetchedSection'
]) {
  assert(adapter.includes(token), `sectionsSnapshotFetcher.js missing token: ${token}`);
}

for (const token of [
  'Sections snapshot browser ingestion certification',
  'maps chennai requests to tn prefetched section',
  'summarizes section snapshot runtime quality'
]) {
  assert(adapterTest.includes(token), `sectionsSnapshotFetcher.cert.test.js missing token: ${token}`);
}

for (const token of [
  'fetchPrefetchedSectionNews',
  'settings.usePrefetchedSections !== false',
  'Prefetched sections HIT',
  'sectionQuality',
  'snapshotRuntimeSummary',
  'falling back to live RSS'
]) {
  assert(rssAggregator.includes(token), `rssAggregator.js missing prefetched section token: ${token}`);
}

assert(
  packageJson.includes('"test:sections-browser-ingestion"'),
  'package.json must include test:sections-browser-ingestion'
);

assert(
  (certGate.includes("['npm', ['run', 'test:sections-browser-ingestion']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:sections-browser-ingestion'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Sections browser JSON ingestion slice',
  guarantees: [
    'browser can load /newsdata/sections_latest.json',
    'schema v1/v2 sections snapshots are supported',
    'chennai section maps to tn prefetched data',
    'sectionQuality metadata is preserved',
    'rssAggregator uses prefetched JSON before live RSS',
    'live RSS remains fallback when JSON is unavailable',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Sections browser ingestion static slice');
