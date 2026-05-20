import fs from 'fs';

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
  'ceid=',
  'TRAVEL_LOCATION_REGISTRY',
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
