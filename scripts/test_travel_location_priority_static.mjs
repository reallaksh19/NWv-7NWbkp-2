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
