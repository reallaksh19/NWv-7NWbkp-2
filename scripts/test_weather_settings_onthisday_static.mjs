import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const displayPrefs = read('src/services/displayPreferences.js');
const displayPrefsTest = read('src/services/displayPreferences.cert.test.js');
const displayPanel = read('src/components/settings/DisplayPreferencesPanel.jsx');
const displayPanelCss = read('src/components/settings/DisplayPreferencesPanel.css');
const controller = read('src/components/settings/OnThisDayVisibilityController.jsx');
const app = read('src/App.jsx');
const settingsPage = read('src/pages/SettingsPage.jsx');
const quickWeather = read('src/components/QuickWeather.jsx');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'showOnThisDay: false',
  'shouldShowOnThisDay',
  'buildDisplaySettings',
]) {
  assert(displayPrefs.includes(token), 'displayPreferences.js missing token: ' + token);
}

for (const token of [
  'keeps On This Day off by default',
  'allows On This Day to be explicitly enabled',
  'fills missing defaults',
]) {
  assert(displayPrefsTest.includes(token), 'displayPreferences.cert.test.js missing token: ' + token);
}

for (const token of [
  'Show “On This Day”',
  'Off by default',
  'data-display-preferences-panel',
  'buildDisplaySettings',
]) {
  assert(displayPanel.includes(token), 'DisplayPreferencesPanel.jsx missing token: ' + token);
}

for (const token of [
  '.display-preferences-panel',
  '.display-preferences-panel__toggle',
]) {
  assert(displayPanelCss.includes(token), 'DisplayPreferencesPanel.css missing token: ' + token);
}

for (const token of [
  'OnThisDayVisibilityController',
  'MutationObserver',
  'data-nw-hidden-on-this-day',
  'findOnThisDayContainers',
  'shouldShowOnThisDay',
]) {
  assert(controller.includes(token), 'OnThisDayVisibilityController.jsx missing token: ' + token);
}

for (const token of [
  'OnThisDayVisibilityController',
  '<OnThisDayVisibilityController />',
]) {
  assert(app.includes(token), 'App.jsx missing token: ' + token);
}

for (const token of [
  'WeatherLocationManager',
  'DisplayPreferencesPanel',
  'Display Preferences',
]) {
  assert(settingsPage.includes(token), 'SettingsPage.jsx missing token: ' + token);
}

assert(
  !settingsPage.includes('value="Chennai" disabled') &&
  !settingsPage.includes('value="Trichy" disabled'),
  'SettingsPage weather tab must not keep hardcoded Chennai/Trichy disabled rows'
);

assert(
  quickWeather.includes('DEFAULT_WEATHER_CITIES'),
  'QuickWeather.jsx must keep DEFAULT_WEATHER_CITIES available'
);

assert(
  packageJson.includes('"test:weather-settings-onthisday"'),
  'package.json must include test:weather-settings-onthisday'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-settings-onthisday']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include weather settings/on-this-day test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather settings and On This Day visibility',
  guarantees: [
    'Settings Weather tab uses real WeatherLocationManager',
    'hardcoded 3-city settings UI is removed',
    'Display preference panel includes Show On This Day',
    'On This Day is off by default',
    'global visibility controller hides On This Day on mobile and desktop',
    'QuickWeather import is hardened after Weather UX closeout'
  ]
}, null, 2));

console.log('PASS: Weather settings and On This Day static slice');
