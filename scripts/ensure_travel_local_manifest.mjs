/**
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
