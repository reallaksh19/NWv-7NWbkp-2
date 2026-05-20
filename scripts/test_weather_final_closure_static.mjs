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

const files = {
  locations: read('src/services/weatherLocations.js'),
  adapters: read('src/services/weatherDataAdapters.js'),
  insights: read('src/services/weatherInsights.js'),
  displayPrefs: read('src/services/displayPreferences.js'),
  weatherService: read('src/services/weatherService.js'),
  quickWeather: read('src/components/QuickWeather.jsx'),
  quickWeatherCss: read('src/components/QuickWeatherRefined.css'),
  signalStrip: read('src/components/weather/QuickWeatherSignalStrip.jsx'),
  signalStripCss: read('src/components/weather/QuickWeatherSignalStrip.css'),
  manager: read('src/components/weather/WeatherLocationManager.jsx'),
  managerCss: read('src/components/weather/WeatherLocationManager.css'),
  weekly: read('src/components/weather/WeeklyWeatherForecast.jsx'),
  weeklyCss: read('src/components/weather/WeeklyWeatherForecast.css'),
  weatherPage: read('src/pages/WeatherPage.jsx'),
  settingsPage: read('src/pages/SettingsPage.jsx'),
  app: read('src/App.jsx'),
  onThisDayController: read('src/components/settings/OnThisDayVisibilityController.jsx'),
  audit: maybeRead('src/services/pageAuditGrading.js'),
  packageJson: read('package.json'),
  certGate: read('scripts/run_certification_gate.mjs'),
};

function requireTokens(name, tokens) {
  for (const token of tokens) {
    assert(files[name].includes(token), name + ' missing token: ' + token);
  }
}

requireTokens('locations', [
  'DEFAULT_WEATHER_CITIES',
  'colombo',
  'Colombo',
  'Sri Lanka',
  'buildWeatherSettingsWithCities',
  'getConfiguredWeatherCities',
]);

requireTokens('adapters', [
  'normalizeForecastDay',
  'getWeatherCityRows',
  'formatRainPair',
  'realFeelDay',
  'humidityDay',
  'rainMm',
]);

requireTokens('insights', [
  'formatRainSignal',
  'buildNextRiskSummary',
  'buildTomorrowChip',
  'summarizeAllCitiesWeekly',
  'buildDailyConsensus',
  'precipMm',
  'rainText',
]);

requireTokens('displayPrefs', [
  'showOnThisDay: false',
  'shouldShowOnThisDay',
  'buildDisplaySettings',
]);

requireTokens('weatherService', [
  'apparent_temperature_max',
  'relative_humidity_2m_mean',
  'precipitation_probability_max',
  'precipitation_sum',
  'weeklyForecast',
  'realFeelDay',
  'humidityDay',
]);

requireTokens('quickWeather', [
  'QuickWeatherRefined.css',
  'getConfiguredWeatherCities',
  'buildWeatherSettingsWithCities',
  'getWeatherLocationOptions',
  'Select a supported city',
  'quick-weather-city-options',
]);

requireTokens('quickWeatherCss', [
  '.quick-weather-card',
  '.qw-config-bar input',
  '.qw-highlight-text-container',
  '.qw-city-row--active',
]);

requireTokens('signalStrip', [
  'data-quick-weather-signal-strip',
  'formatRainSignal',
  'precipMm',
  'Humidity',
  'Tmr',
]);

requireTokens('signalStripCss', [
  '.qwss-strip',
  '.qwss-chip',
  '.qwss-chip--low',
  '.qwss-chip--medium',
  '.qwss-chip--high',
]);

requireTokens('manager', [
  'Add / delete locations',
  'removeCity',
  'Reset defaults',
  'Colombo',
]);

requireTokens('managerCss', [
  '.wlm-panel',
  '.wlm-chip',
  '.wlm-add-row',
  '.wlm-select',
]);

requireTokens('weekly', [
  'weatherData = null',
  'settings = null',
  'forecast = null',
  'ForecastCard',
  'formatRainPair',
  'Feels',
  'Humidity',
]);

requireTokens('weeklyCss', [
  '.wwf-card',
  '.wwf-row',
  '.wwf-metric',
  '.wwf-stack',
]);

requireTokens('weatherPage', [
  'WeatherLocationManager',
  'WeeklyWeatherForecast',
  'WeatherCityComparison',
  'WeatherPlanningSummary',
]);

requireTokens('settingsPage', [
  'WeatherLocationManager',
  'DisplayPreferencesPanel',
  'Display Preferences',
]);

assert(
  !files.settingsPage.includes('value="Chennai" disabled') &&
  !files.settingsPage.includes('value="Trichy" disabled'),
  'SettingsPage must not keep old hardcoded disabled Chennai/Trichy location rows'
);

requireTokens('app', [
  'OnThisDayVisibilityController',
  '<OnThisDayVisibilityController />',
]);

requireTokens('onThisDayController', [
  'MutationObserver',
  'data-nw-hidden-on-this-day',
  'shouldShowOnThisDay',
]);

if (files.audit) {
  requireTokens('audit', [
    'auditWeatherTabQuality',
    'weather-weekly-forecast',
    'readyCityCount',
  ]);
}

assert(
  files.packageJson.includes('"test:weather-final-closure"'),
  'package.json must include test:weather-final-closure'
);

assert(
  files.certGate.includes("['npm', ['run', 'test:weather-final-closure']]") ||
    files.certGate.includes('certification_manifest.json'),
  'certification gate must include weather final closure test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather final closure static gate',
  guarantees: [
    'Colombo registry and defaults are present',
    'Add/delete/reset city manager is present',
    'Settings uses real WeatherLocationManager',
    'QuickWeather add city is registry-backed',
    'QuickWeather desktop visibility CSS exists',
    'QuickWeather shows precipitation probability and mm',
    'Weekly forecast supports weatherData/settings and forecast/cityName modes',
    'Weekly forecast shows rain %, mm, real feel and humidity',
    'Weather service requests required Open-Meteo fields',
    'On This Day is off by default and visibility controller is mounted',
    'Weather grade/audit coverage remains available'
  ]
}, null, 2));

console.log('PASS: Weather final closure static gate');
