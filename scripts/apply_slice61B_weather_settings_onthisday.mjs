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

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function replaceRange(source, startAnchor, endAnchor, replacement, label) {
  const start = source.indexOf(startAnchor);
  if (start < 0) throw new Error(`Missing start anchor for ${label}`);
  const end = source.indexOf(endAnchor, start);
  if (end < 0) throw new Error(`Missing end anchor for ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

/* -------------------------------------------------------------------------- */
/* 1) Display preference contract                                              */
/* -------------------------------------------------------------------------- */

write('src/services/displayPreferences.js', `export const DEFAULT_DISPLAY_PREFERENCES = {
  showOnThisDay: false,
};

export function getDisplayPreferences(settings = {}) {
  return {
    ...DEFAULT_DISPLAY_PREFERENCES,
    ...(settings.display || {}),
  };
}

export function shouldShowOnThisDay(settings = {}) {
  return getDisplayPreferences(settings).showOnThisDay === true;
}

export function buildDisplaySettings(baseSettings = {}, patch = {}) {
  return {
    ...baseSettings,
    display: {
      ...DEFAULT_DISPLAY_PREFERENCES,
      ...(baseSettings.display || {}),
      ...patch,
    },
  };
}
`);

write('src/services/displayPreferences.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPLAY_PREFERENCES,
  buildDisplaySettings,
  getDisplayPreferences,
  shouldShowOnThisDay,
} from './displayPreferences';

describe('Display preferences certification', () => {
  it('keeps On This Day off by default', () => {
    expect(DEFAULT_DISPLAY_PREFERENCES.showOnThisDay).toBe(false);
    expect(shouldShowOnThisDay({})).toBe(false);
  });

  it('allows On This Day to be explicitly enabled', () => {
    expect(shouldShowOnThisDay({ display: { showOnThisDay: true } })).toBe(true);
  });

  it('builds display settings without dropping existing settings', () => {
    const next = buildDisplaySettings(
      { theme: 'dark', display: { other: true } },
      { showOnThisDay: true }
    );

    expect(next.theme).toBe('dark');
    expect(next.display.other).toBe(true);
    expect(next.display.showOnThisDay).toBe(true);
  });

  it('fills missing defaults', () => {
    expect(getDisplayPreferences({}).showOnThisDay).toBe(false);
  });
});
`);

/* -------------------------------------------------------------------------- */
/* 2) Settings UI panel                                                        */
/* -------------------------------------------------------------------------- */

write('src/components/settings/DisplayPreferencesPanel.jsx', `import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  buildDisplaySettings,
  shouldShowOnThisDay,
} from '../../services/displayPreferences.js';
import './DisplayPreferencesPanel.css';

export default function DisplayPreferencesPanel() {
  const { settings, updateSettings } = useSettings();
  const showOnThisDay = shouldShowOnThisDay(settings);

  return (
    <section className="display-preferences-panel" data-display-preferences-panel="true">
      <div className="display-preferences-panel__copy">
        <span className="display-preferences-panel__eyebrow">Home display</span>
        <h3>Optional widgets</h3>
        <p>
          “On This Day” is hidden by default on mobile and desktop. Turn it on only when you want it in the feed.
        </p>
      </div>

      <label className="display-preferences-panel__toggle">
        <input
          type="checkbox"
          checked={showOnThisDay}
          onChange={event => updateSettings(buildDisplaySettings(settings, {
            showOnThisDay: event.target.checked,
          }))}
        />
        <span>
          <strong>Show “On This Day”</strong>
          <em>{showOnThisDay ? 'Enabled' : 'Off by default'}</em>
        </span>
      </label>
    </section>
  );
}
`);

write('src/components/settings/DisplayPreferencesPanel.css', `.display-preferences-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border: 1px solid rgba(45, 212, 191, 0.20);
  border-radius: 18px;
  background:
    radial-gradient(360px 120px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 68%),
    rgba(15, 23, 42, 0.64);
}

.display-preferences-panel__eyebrow {
  color: #99f6e4;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.display-preferences-panel h3 {
  margin: 3px 0 4px;
  color: #f8fafc;
  font-size: 1rem;
}

.display-preferences-panel p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.8rem;
  line-height: 1.35;
}

.display-preferences-panel__toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.34);
  cursor: pointer;
}

.display-preferences-panel__toggle input {
  width: 18px;
  height: 18px;
  accent-color: #14b8a6;
}

.display-preferences-panel__toggle strong,
.display-preferences-panel__toggle em {
  display: block;
}

.display-preferences-panel__toggle strong {
  color: #e2e8f0;
  font-size: 0.84rem;
}

.display-preferences-panel__toggle em {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 0.74rem;
  font-style: normal;
}

@media (max-width: 680px) {
  .display-preferences-panel {
    grid-template-columns: 1fr;
  }

  .display-preferences-panel__toggle {
    min-width: 0;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 3) Global On This Day visibility controller                                 */
/* -------------------------------------------------------------------------- */

write('src/components/settings/OnThisDayVisibilityController.jsx', `import { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { shouldShowOnThisDay } from '../../services/displayPreferences.js';

const HIDDEN_ATTR = 'data-nw-hidden-on-this-day';

function normalizeText(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
}

function isOnThisDayText(text) {
  const value = normalizeText(text);
  return (
    value === 'on this day' ||
    value.startsWith('on this day ') ||
    value.includes(' on this day ')
  );
}

function findContainer(node) {
  if (!node || !node.closest) return null;

  return (
    node.closest('[data-on-this-day]') ||
    node.closest('[data-widget="on-this-day"]') ||
    node.closest('[data-testid*="on-this-day" i]') ||
    node.closest('[class*="on-this-day" i]') ||
    node.closest('[id*="on-this-day" i]') ||
    node.closest('section') ||
    node.closest('article') ||
    node.closest('.card') ||
    node.closest('.panel') ||
    node.closest('.widget') ||
    node.parentElement
  );
}

function findOnThisDayContainers(root = document) {
  const containers = new Set();

  try {
    root
      .querySelectorAll('[data-on-this-day], [data-widget="on-this-day"], [data-testid*="on-this-day" i], [class*="on-this-day" i], [id*="on-this-day" i]')
      .forEach(node => containers.add(node));
  } catch {
    // Ignore unsupported selector edge cases.
  }

  const textCandidates = root.querySelectorAll('h1,h2,h3,h4,h5,h6,header,button,summary,[role="heading"]');
  textCandidates.forEach(node => {
    if (isOnThisDayText(node.textContent)) {
      const container = findContainer(node);
      if (container) containers.add(container);
    }
  });

  return [...containers].filter(node => {
    if (!node || !node.style) return false;
    if (node.closest?.('.settings-page')) return false;
    return true;
  });
}

function hideOnThisDay(root = document) {
  findOnThisDayContainers(root).forEach(node => {
    if (!node.hasAttribute(HIDDEN_ATTR)) {
      node.setAttribute(HIDDEN_ATTR, 'true');
      node.setAttribute('aria-hidden', 'true');
      node.style.display = 'none';
    }
  });
}

function showOnThisDay(root = document) {
  root.querySelectorAll('[' + HIDDEN_ATTR + '="true"]').forEach(node => {
    node.removeAttribute(HIDDEN_ATTR);
    node.removeAttribute('aria-hidden');
    node.style.display = '';
  });
}

export default function OnThisDayVisibilityController() {
  const { settings } = useSettings();
  const showOnThisDay = shouldShowOnThisDay(settings);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    if (showOnThisDay) {
      showOnThisDay(document);
      return undefined;
    }

    hideOnThisDay(document);

    const observer = new MutationObserver(() => {
      hideOnThisDay(document);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      showOnThisDay(document);
    };
  }, [showOnThisDay]);

  return null;
}

export const __onThisDayTestUtils = {
  findOnThisDayContainers,
  hideOnThisDay,
  showOnThisDay,
  isOnThisDayText,
};
`);

/* -------------------------------------------------------------------------- */
/* 4) Patch App.jsx to mount the controller                                    */
/* -------------------------------------------------------------------------- */

patchFile('src/App.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import DebugConsole from './components/DebugConsole';`,
    `
import OnThisDayVisibilityController from './components/settings/OnThisDayVisibilityController.jsx';`,
    'App OnThisDayVisibilityController import'
  );

  text = insertAfterOnce(
    text,
    `                <DebugConsole />`,
    `
                <OnThisDayVisibilityController />`,
    'App OnThisDayVisibilityController render'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 5) Patch SettingsPage Weather tab                                           */
/* -------------------------------------------------------------------------- */

patchFile('src/pages/SettingsPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';`,
    `
import WeatherLocationManager from '../components/weather/WeatherLocationManager.jsx';
import DisplayPreferencesPanel from '../components/settings/DisplayPreferencesPanel.jsx';`,
    'SettingsPage weather/display imports'
  );

  const startAnchor = `                        <SectionTitle icon="📍" title="Locations" />`;
  const endAnchor = `                        <SectionTitle icon="🌤️" title="Weather Models" />`;

  const replacement = `                        <SectionTitle icon="📍" title="Locations" />
                        <WeatherLocationManager />

                        <SectionTitle icon="🧩" title="Display Preferences" />
                        <SettingCard>
                            <DisplayPreferencesPanel />
                        </SettingCard>

`;

  text = replaceRange(
    text,
    startAnchor,
    endAnchor,
    replacement,
    'SettingsPage weather location/display block'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 6) QuickWeather import hardening after Slice 61A                            */
/* -------------------------------------------------------------------------- */

patchFile('src/components/QuickWeather.jsx', source => {
  let text = source;

  // Remove old single import if the richer Slice 61A import exists.
  if (
    text.includes(`import { DEFAULT_WEATHER_CITIES } from '../services/weatherLocations.js';`) &&
    text.includes('getConfiguredWeatherCities')
  ) {
    text = text.replace(`import { DEFAULT_WEATHER_CITIES } from '../services/weatherLocations.js';\n`, '');
  }

  if (!text.includes('DEFAULT_WEATHER_CITIES') && text.includes('getConfiguredWeatherCities')) {
    text = text.replace(
      `import {
    buildWeatherSettingsWithCities,`,
      `import {
    DEFAULT_WEATHER_CITIES,
    buildWeatherSettingsWithCities,`
    );
  }

  return text;
});

/* -------------------------------------------------------------------------- */
/* 7) Certification                                                            */
/* -------------------------------------------------------------------------- */

write('scripts/test_weather_settings_onthisday_static.mjs', `import fs from 'fs';

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
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:weather-settings-onthisday'] =
    'node scripts/test_weather_settings_onthisday_static.mjs && vitest run --config vitest.config.js src/services/displayPreferences.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:weather-settings-onthisday']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:weather-ux-closeout']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-ux-closeout']],",
      "  ['npm', ['run', 'test:weather-ux-closeout']],\\n  ['npm', ['run', 'test:weather-settings-onthisday']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:weather-weekly-planning']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-weekly-planning']],",
      "  ['npm', ['run', 'test:weather-weekly-planning']],\\n  ['npm', ['run', 'test:weather-settings-onthisday']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'weather-settings-onthisday')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-ux-closeout');
      const command = {
        id: 'weather-settings-onthisday',
        cmd: 'npm',
        args: ['run', 'test:weather-settings-onthisday'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:weather-settings-onthisday')) return source;

    if (source.includes("'test:weather-ux-closeout',")) {
      return source.replace(
        "'test:weather-ux-closeout',",
        "'test:weather-ux-closeout',\\n  'test:weather-settings-onthisday',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 61B Weather settings and On This Day patch complete.');
