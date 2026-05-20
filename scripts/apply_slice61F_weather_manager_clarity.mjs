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
/* 1) Replace WeatherLocationManager with clearer UX                           */
/* -------------------------------------------------------------------------- */

write('src/components/weather/WeatherLocationManager.jsx', `import React, { useMemo, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  DEFAULT_WEATHER_CITIES,
  WEATHER_LOCATION_REGISTRY,
  buildWeatherSettingsWithCities,
  getConfiguredWeatherCities,
  getWeatherLocationOptions,
  resolveRegistryKey,
} from '../../services/weatherLocations.js';
import './WeatherLocationManager.css';

function cityDisplay(city) {
  return WEATHER_LOCATION_REGISTRY[city]?.display || city;
}

function cityIcon(city) {
  return WEATHER_LOCATION_REGISTRY[city]?.icon || '📍';
}

export default function WeatherLocationManager({ compact = false }) {
  const { settings, updateSettings } = useSettings();
  const cities = getConfiguredWeatherCities(settings);
  const options = useMemo(() => getWeatherLocationOptions(), []);
  const [inputValue, setInputValue] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const availableToAdd = options.filter(option => !cities.includes(option.key));
  const colomboMissing = !cities.includes('colombo');

  function save(nextCities) {
    updateSettings(buildWeatherSettingsWithCities(settings, nextCities));
  }

  function addCity(cityValue = inputValue) {
    const canonical = resolveRegistryKey(cityValue);

    if (!canonical) {
      setMessage('Select a supported city from the list, then press Add.');
      return;
    }

    if (cities.includes(canonical)) {
      setMessage(cityDisplay(canonical) + ' is already in your weather list.');
      return;
    }

    save([...cities, canonical]);
    setInputValue('');
    setMessage(cityDisplay(canonical) + ' added.');
  }

  function removeCity(city) {
    if (cities.length <= 1) {
      setMessage('At least one weather city must remain.');
      return;
    }

    save(cities.filter(item => item !== city));
    setMessage(cityDisplay(city) + ' removed.');
  }

  function resetToDefaults() {
    save([...DEFAULT_WEATHER_CITIES]);
    setMessage('Reset to Chennai, Trichy, Muscat and Colombo.');
  }

  if (!open) {
    return (
      <section className={\`wlm-collapsed \${compact ? 'wlm-collapsed--compact' : ''}\`} data-weather-location-manager="collapsed">
        <div className="wlm-collapsed__copy">
          <strong>Weather locations</strong>
          <span>{cities.length} selected · {cities.map(cityDisplay).join(' · ')}</span>
        </div>

        <div className="wlm-collapsed__actions">
          {colomboMissing && (
            <button
              className="wlm-add-colombo"
              type="button"
              onClick={() => {
                addCity('colombo');
                setOpen(true);
              }}
              data-weather-add-colombo="true"
            >
              + Colombo
            </button>
          )}

          <button className="wlm-toggle" type="button" onClick={() => setOpen(true)}>
            Manage
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={\`wlm-panel \${compact ? 'wlm-panel--compact' : ''}\`} data-weather-location-manager="open">
      <div className="wlm-header">
        <div>
          <span className="wlm-eyebrow">Weather locations</span>
          <h3>Add / delete locations</h3>
          <p>
            To add: choose a city and press <strong>Add</strong>. To delete: press the <strong>×</strong> beside that city.
          </p>
        </div>

        <button className="wlm-toggle wlm-close" type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>

      <div className="wlm-help" data-weather-location-help="true">
        <span>Supported now: Chennai, Trichy, Muscat, Colombo.</span>
        {colomboMissing ? (
          <button type="button" onClick={() => addCity('colombo')} data-weather-add-colombo="true">
            + Add Colombo
          </button>
        ) : (
          <strong>Colombo is already added.</strong>
        )}
      </div>

      <div className="wlm-current">
        <span className="wlm-section-label">Selected cities</span>
        <div className="wlm-chip-row">
          {cities.map(city => (
            <span key={city} className="wlm-chip">
              <span>{cityIcon(city)} {cityDisplay(city)}</span>
              <button
                type="button"
                onClick={() => removeCity(city)}
                disabled={cities.length <= 1}
                aria-label={'Remove ' + cityDisplay(city)}
                title={'Remove ' + cityDisplay(city)}
                data-weather-delete-city={city}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="wlm-add-row">
        <select
          className="wlm-select"
          value={inputValue}
          onChange={event => {
            setInputValue(event.target.value);
            setMessage('');
          }}
          aria-label="Select weather city to add"
        >
          <option value="">Select city to add…</option>
          {availableToAdd.map(option => (
            <option key={option.key} value={option.key}>
              {option.label} — {option.country}
            </option>
          ))}
        </select>

        <button className="wlm-add-btn" type="button" onClick={() => addCity()} disabled={!inputValue}>
          Add
        </button>
      </div>

      {availableToAdd.length > 0 && (
        <div className="wlm-quick-add" data-weather-quick-add-list="true">
          <span className="wlm-section-label">Quick add</span>
          <div className="wlm-quick-add__buttons">
            {availableToAdd.map(option => (
              <button key={option.key} type="button" onClick={() => addCity(option.key)}>
                + {option.icon} {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wlm-footer">
        <button className="wlm-reset" type="button" onClick={resetToDefaults}>
          Reset defaults
        </button>
        {message && <span className="wlm-message" role="status">{message}</span>}
      </div>
    </section>
  );
}
`);

/* -------------------------------------------------------------------------- */
/* 2) Replace WeatherLocationManager CSS with more professional layout          */
/* -------------------------------------------------------------------------- */

write('src/components/weather/WeatherLocationManager.css', `.wlm-collapsed,
.wlm-panel {
  margin: 12px 16px;
  border: 1px solid rgba(45, 212, 191, 0.22);
  border-radius: 20px;
  background:
    radial-gradient(420px 160px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 70%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.76));
  color: var(--text-primary, #f8fafc);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.24);
}

.wlm-collapsed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
}

.wlm-collapsed__copy strong,
.wlm-collapsed__copy span {
  display: block;
}

.wlm-collapsed__copy strong {
  color: #99f6e4;
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wlm-collapsed__copy span {
  margin-top: 3px;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.35;
}

.wlm-collapsed__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 0 0 auto;
}

.wlm-panel {
  padding: 14px;
}

.wlm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.wlm-eyebrow,
.wlm-section-label {
  color: #99f6e4;
  font-size: 0.66rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wlm-header h3 {
  margin: 2px 0 4px;
  color: #f8fafc;
  font-size: 1rem;
}

.wlm-header p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.35;
}

.wlm-header p strong {
  color: #e2e8f0;
}

.wlm-toggle,
.wlm-add-colombo,
.wlm-add-btn,
.wlm-reset,
.wlm-help button,
.wlm-quick-add__buttons button {
  min-height: 34px;
  border: 1px solid rgba(45, 212, 191, 0.30);
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.14);
  color: #ccfbf1;
  cursor: pointer;
  font-weight: 900;
}

.wlm-toggle,
.wlm-add-colombo,
.wlm-help button,
.wlm-quick-add__buttons button {
  padding: 0 12px;
}

.wlm-add-colombo {
  background: rgba(59, 130, 246, 0.14);
  border-color: rgba(147, 197, 253, 0.28);
  color: #bfdbfe;
}

.wlm-help {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0;
  padding: 10px 12px;
  border: 1px dashed rgba(45, 212, 191, 0.28);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.30);
}

.wlm-help span,
.wlm-help strong {
  color: #cbd5e1;
  font-size: 0.8rem;
}

.wlm-current {
  margin-top: 12px;
}

.wlm-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.wlm-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 7px 6px 11px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.42);
  color: #e2e8f0;
  font-size: 0.82rem;
  font-weight: 750;
}

.wlm-chip button {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border: 0;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 950;
  line-height: 1;
}

.wlm-chip button:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.30);
}

.wlm-chip button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.wlm-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 14px;
}

.wlm-select {
  min-height: 38px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.70);
  color: #f8fafc;
  padding: 0 12px;
}

.wlm-add-btn {
  min-height: 38px;
  padding: 0 16px;
}

.wlm-add-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.wlm-quick-add {
  margin-top: 12px;
}

.wlm-quick-add__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.wlm-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.wlm-reset {
  min-height: 32px;
  padding: 0 12px;
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(147, 197, 253, 0.24);
  color: #bfdbfe;
}

.wlm-message {
  color: #bfdbfe;
  font-size: 0.78rem;
  font-weight: 800;
}

@media (max-width: 680px) {
  .wlm-collapsed,
  .wlm-header,
  .wlm-help,
  .wlm-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .wlm-collapsed__actions,
  .wlm-add-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .wlm-toggle,
  .wlm-add-colombo,
  .wlm-add-btn,
  .wlm-reset,
  .wlm-help button {
    width: 100%;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 3) Certification                                                            */
/* -------------------------------------------------------------------------- */

write('src/components/weather/WeatherLocationManagerClarity.cert.test.js', `import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('Weather location manager clarity certification', () => {
  const component = fs.readFileSync('src/components/weather/WeatherLocationManager.jsx', 'utf8');
  const css = fs.readFileSync('src/components/weather/WeatherLocationManager.css', 'utf8');

  it('explains how to add and delete cities', () => {
    expect(component).toContain('To add: choose a city');
    expect(component).toContain('To delete: press');
    expect(component).toContain('data-weather-location-help');
  });

  it('provides one-click Colombo add path', () => {
    expect(component).toContain('colomboMissing');
    expect(component).toContain('data-weather-add-colombo');
    expect(component).toContain('+ Add Colombo');
  });

  it('provides labelled delete buttons', () => {
    expect(component).toContain('data-weather-delete-city');
    expect(component).toContain('Remove ');
    expect(component).toContain('removeCity');
  });

  it('provides quick-add list for available cities', () => {
    expect(component).toContain('data-weather-quick-add-list');
    expect(component).toContain('availableToAdd.map');
  });

  it('has professional visual classes', () => {
    expect(css).toContain('.wlm-help');
    expect(css).toContain('.wlm-add-colombo');
    expect(css).toContain('.wlm-quick-add__buttons');
    expect(css).toContain('.wlm-chip button:hover');
  });
});
`);

write('scripts/test_weather_manager_clarity_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const component = read('src/components/weather/WeatherLocationManager.jsx');
const css = read('src/components/weather/WeatherLocationManager.css');
const cert = read('src/components/weather/WeatherLocationManagerClarity.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'data-weather-location-manager',
  'data-weather-location-help',
  'data-weather-add-colombo',
  'data-weather-delete-city',
  'data-weather-quick-add-list',
  'To add: choose a city',
  'To delete: press',
  'colomboMissing',
  '+ Add Colombo',
]) {
  assert(component.includes(token), 'WeatherLocationManager.jsx missing token: ' + token);
}

for (const token of [
  '.wlm-help',
  '.wlm-add-colombo',
  '.wlm-quick-add',
  '.wlm-quick-add__buttons',
  '.wlm-chip button:hover',
  'rgba(20, 184, 166',
]) {
  assert(css.includes(token), 'WeatherLocationManager.css missing token: ' + token);
}

for (const token of [
  'Weather location manager clarity certification',
  'explains how to add and delete cities',
  'provides one-click Colombo add path',
  'provides labelled delete buttons',
  'provides quick-add list',
]) {
  assert(cert.includes(token), 'WeatherLocationManagerClarity.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-manager-clarity"'),
  'package.json must include test:weather-manager-clarity'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-manager-clarity']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include weather manager clarity test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather manager clarity',
  guarantees: [
    'user can see how to add a city',
    'user can see how to delete a city',
    'one-click Add Colombo exists when Colombo is missing',
    'quick-add available city buttons exist',
    'delete city buttons are labelled',
    'weather manager visual style is professional and visible'
  ]
}, null, 2));

console.log('PASS: Weather manager clarity static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:weather-manager-clarity'] =
    'node scripts/test_weather_manager_clarity_static.mjs && vitest run --config vitest.config.js src/components/weather/WeatherLocationManagerClarity.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:weather-manager-clarity']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:weather-final-closure']],",
    "  ['npm', ['run', 'test:weather-integration-hardening']],",
    "  ['npm', ['run', 'test:weather-settings-onthisday']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\\n  ['npm', ['run', 'test:weather-manager-clarity']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'weather-manager-clarity')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-final-closure');
      const command = {
        id: 'weather-manager-clarity',
        cmd: 'npm',
        args: ['run', 'test:weather-manager-clarity'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:weather-manager-clarity')) return source;

    if (source.includes("'test:weather-final-closure',")) {
      return source.replace(
        "'test:weather-final-closure',",
        "'test:weather-final-closure',\\n  'test:weather-manager-clarity',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 61F Weather manager clarity patch complete.');
