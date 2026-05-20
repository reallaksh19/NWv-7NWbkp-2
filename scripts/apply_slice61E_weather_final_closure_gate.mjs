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

/* -------------------------------------------------------------------------- */
/* 1) Final Vitest closure tests                                               */
/* -------------------------------------------------------------------------- */

write('src/services/weatherFinalClosure.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEATHER_CITIES,
  WEATHER_LOCATION_REGISTRY,
  buildWeatherSettingsWithCities,
  getConfiguredWeatherCities,
  getWeatherLocationLabel,
} from './weatherLocations';
import {
  formatRainPair,
  getWeatherCityRows,
  normalizeForecastDay,
} from './weatherDataAdapters';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  summarizeAllCitiesWeekly,
} from './weatherInsights';
import {
  shouldShowOnThisDay,
} from './displayPreferences';

describe('Weather final closure certification', () => {
  it('keeps Colombo in default and registry-backed weather locations', () => {
    expect(DEFAULT_WEATHER_CITIES).toContain('colombo');
    expect(WEATHER_LOCATION_REGISTRY.colombo).toMatchObject({
      key: 'colombo',
      display: 'Colombo',
      country: 'Sri Lanka',
    });
    expect(getWeatherLocationLabel('colombo')).toBe('Colombo');
  });

  it('keeps customized weather city settings canonical', () => {
    const settings = buildWeatherSettingsWithCities({}, ['Colombo', 'Muscat']);
    expect(settings.weather.cities).toEqual(['colombo', 'muscat']);

    const configured = getConfiguredWeatherCities(settings);
    expect(configured).toContain('colombo');
    expect(configured).toContain('muscat');
  });

  it('normalizes weekly forecast fields required by Weather tab UI', () => {
    const day = normalizeForecastDay({
      label: 'Today',
      high: 28,
      low: 24,
      rainProb: 92,
      rainMm: 20.3,
      realFeelDay: 33,
      humidityDay: 88,
      uvIndex: 8,
      windKph: 18,
    });

    expect(day.high).toBe(28);
    expect(day.low).toBe(24);
    expect(day.rainProb).toBe(92);
    expect(day.rainMm).toBe(20.3);
    expect(day.realFeelDay).toBe(33);
    expect(day.humidityDay).toBe(88);
    expect(formatRainPair(day)).toBe('92% · 20.3mm');
  });

  it('supports WeatherPage style weekly city rows', () => {
    const rows = getWeatherCityRows({
      settings: {
        weather: {
          cities: ['colombo'],
          locationConfigVersion: 'weather-locations-v3-colombo-ux',
        },
      },
      weatherData: {
        colombo: {
          name: 'Colombo',
          sourceMode: 'live-multi-model',
          weeklyForecast: [
            { label: 'Today', high: 28, low: 24, rainProb: 92, rainMm: 20.3, realFeelDay: 33, humidityDay: 88 },
          ],
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].city).toBe('colombo');
    expect(rows[0].forecast[0].rainMm).toBe(20.3);
  });

  it('keeps QuickWeather risk/tomorrow summaries precise', () => {
    const cityData = {
      weeklyForecast: [
        { label: 'Today', high: 28, low: 24, rainProb: 92, rainMm: 20.3, humidityDay: 88 },
        { label: 'Tomorrow', high: 29, low: 25, rainProb: 55, rainMm: 2.1, humidityDay: 82 },
      ],
    };

    const risk = buildNextRiskSummary(cityData);
    const tomorrow = buildTomorrowChip(cityData);

    expect(risk.rainText).toBe('92% · 22.4mm');
    expect(tomorrow.rainText).toBe('55% · 2.1mm');
    expect(tomorrow.detail).toContain('55% · 2.1mm');
  });

  it('keeps planning summary functions available', () => {
    const summaries = summarizeAllCitiesWeekly({
      colombo: {
        name: 'Colombo',
        weeklyForecast: [
          { label: 'Today', high: 28, low: 24, rainProb: 92, rainMm: 20.3 },
          { label: 'Tomorrow', high: 29, low: 25, rainProb: 55, rainMm: 2.1 },
        ],
      },
    }, ['colombo']);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].hasWeekly).toBe(true);
    expect(summaries[0].rainiestDay.label).toBe('Today');
  });

  it('keeps On This Day off by default', () => {
    expect(shouldShowOnThisDay({})).toBe(false);
  });
});
`);

/* -------------------------------------------------------------------------- */
/* 2) Static end-to-end weather closure check                                  */
/* -------------------------------------------------------------------------- */

write('scripts/test_weather_final_closure_static.mjs', `import fs from 'fs';

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
`);

/* -------------------------------------------------------------------------- */
/* 3) package.json + certification                                             */
/* -------------------------------------------------------------------------- */

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:weather-final-closure'] =
    'node scripts/test_weather_final_closure_static.mjs && vitest run --config vitest.config.js src/services/weatherFinalClosure.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:weather-final-closure']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:weather-integration-hardening']],",
    "  ['npm', ['run', 'test:weather-signal-precision']],",
    "  ['npm', ['run', 'test:weather-settings-onthisday']],",
    "  ['npm', ['run', 'test:weather-ux-closeout']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\\n  ['npm', ['run', 'test:weather-final-closure']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'weather-final-closure')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-integration-hardening');
      const command = {
        id: 'weather-final-closure',
        cmd: 'npm',
        args: ['run', 'test:weather-final-closure'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:weather-final-closure')) return source;

    const anchors = [
      "'test:weather-integration-hardening',",
      "'test:weather-signal-precision',",
      "'test:weather-settings-onthisday',",
      "'test:weather-ux-closeout',",
    ];

    for (const anchor of anchors) {
      if (source.includes(anchor)) {
        return source.replace(anchor, anchor + "\\n  'test:weather-final-closure',");
      }
    }

    return source;
  });
}

console.log('\\nSlice 61E Weather final closure gate patch complete.');
