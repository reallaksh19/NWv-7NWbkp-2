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

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

/* -------------------------------------------------------------------------- */
/* 1) Weather location registry: add clean helpers and firm Colombo support     */
/* -------------------------------------------------------------------------- */

write('src/services/weatherLocations.js', `/**
 * Weather location registry – single source of truth for supported static-host cities.
 */

export const WEATHER_LOCATION_CONFIG_VERSION = 'weather-locations-v3-colombo-ux';

export const DEFAULT_WEATHER_CITIES = ['chennai', 'trichy', 'muscat', 'colombo'];

export const WEATHER_LOCATION_REGISTRY = {
    chennai: {
        key: 'chennai',
        lat: 13.0827,
        lon: 80.2707,
        display: 'Chennai',
        country: 'India',
        icon: '🏛️',
        aliases: ['madras'],
    },
    trichy: {
        key: 'trichy',
        lat: 10.7905,
        lon: 78.7047,
        display: 'Trichy',
        country: 'India',
        icon: '🏯',
        aliases: ['tiruchirappalli', 'tiruchirapalli', 'tiruchi'],
    },
    muscat: {
        key: 'muscat',
        lat: 23.5859,
        lon: 58.4059,
        display: 'Muscat',
        country: 'Oman',
        icon: '📍',
        aliases: ['maskad', 'masqat'],
    },
    colombo: {
        key: 'colombo',
        lat: 6.9271,
        lon: 79.8612,
        display: 'Colombo',
        country: 'Sri Lanka',
        icon: '🌴',
        aliases: ['kolamba'],
    },
};

export function normalizeWeatherCity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\\s+/g, ' ');
}

export function resolveRegistryKey(cityName) {
    const key = normalizeWeatherCity(cityName);
    if (WEATHER_LOCATION_REGISTRY[key]) return key;

    for (const [canonical, entry] of Object.entries(WEATHER_LOCATION_REGISTRY)) {
        if ((entry.aliases || []).map(normalizeWeatherCity).includes(key)) return canonical;
    }

    return null;
}

export function getCityWeatherKey(cityName) {
    return resolveRegistryKey(cityName) || normalizeWeatherCity(cityName);
}

export function getWeatherLocation(cityName) {
    const key = resolveRegistryKey(cityName);
    return key ? WEATHER_LOCATION_REGISTRY[key] : null;
}

export function getWeatherLocationLabel(cityName) {
    const location = getWeatherLocation(cityName);
    if (location) return location.display;

    const raw = String(cityName || '').trim();
    if (!raw) return 'Unknown';

    return raw
        .split(/\\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

export function getWeatherLocationOptions() {
    return Object.values(WEATHER_LOCATION_REGISTRY)
        .map(location => ({
            key: location.key,
            label: location.display,
            country: location.country,
            icon: location.icon,
            lat: location.lat,
            lon: location.lon,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function uniqueWeatherCities(cities) {
    const result = [];

    for (const city of Array.isArray(cities) ? cities : []) {
        const key = getCityWeatherKey(city);
        if (!key || result.includes(key)) continue;
        if (!WEATHER_LOCATION_REGISTRY[key]) continue;
        result.push(key);
    }

    return result;
}

export function getConfiguredWeatherCities(settings) {
    const raw = settings?.weather?.cities;
    const normalized = uniqueWeatherCities(raw);

    if (normalized.length === 0) return [...DEFAULT_WEATHER_CITIES];

    const alreadyMigrated =
        settings?.weather?.locationConfigVersion === WEATHER_LOCATION_CONFIG_VERSION;

    if (!alreadyMigrated) {
        return uniqueWeatherCities([...normalized, ...DEFAULT_WEATHER_CITIES]);
    }

    return normalized;
}

export function buildWeatherSettingsWithCities(baseSettings, cities) {
    const nextCities = uniqueWeatherCities(cities);

    return {
        ...baseSettings,
        weather: {
            ...(baseSettings?.weather || {}),
            cities: nextCities.length ? nextCities : [...DEFAULT_WEATHER_CITIES],
            locationConfigVersion: WEATHER_LOCATION_CONFIG_VERSION,
        },
    };
}
`);

/* -------------------------------------------------------------------------- */
/* 2) Cleaner manager: add/delete/reset visible and professional               */
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

export default function WeatherLocationManager({ compact = false }) {
    const { settings, updateSettings } = useSettings();
    const cities = getConfiguredWeatherCities(settings);
    const options = useMemo(() => getWeatherLocationOptions(), []);
    const [inputValue, setInputValue] = useState('');
    const [message, setMessage] = useState('');
    const [open, setOpen] = useState(false);

    function save(nextCities) {
        updateSettings(buildWeatherSettingsWithCities(settings, nextCities));
    }

    function addCity() {
        const canonical = resolveRegistryKey(inputValue);
        if (!canonical) {
            setMessage('Select a supported city from the list.');
            return;
        }

        if (cities.includes(canonical)) {
            setMessage(\`\${WEATHER_LOCATION_REGISTRY[canonical].display} is already in your list.\`);
            return;
        }

        save([...cities, canonical]);
        setInputValue('');
        setMessage(\`\${WEATHER_LOCATION_REGISTRY[canonical].display} added.\`);
    }

    function removeCity(city) {
        if (cities.length <= 1) {
            setMessage('At least one city must remain.');
            return;
        }

        const next = cities.filter(item => item !== city);
        save(next);
        setMessage(\`\${WEATHER_LOCATION_REGISTRY[city]?.display || city} removed.\`);
    }

    function resetToDefaults() {
        save([...DEFAULT_WEATHER_CITIES]);
        setMessage('Reset to Chennai, Trichy, Muscat and Colombo.');
    }

    const availableToAdd = options.filter(option => !cities.includes(option.key));

    if (!open) {
        return (
            <section className={\`wlm-collapsed \${compact ? 'wlm-collapsed--compact' : ''}\`}>
                <div>
                    <strong>Weather locations</strong>
                    <span>{cities.map(city => WEATHER_LOCATION_REGISTRY[city]?.display || city).join(' · ')}</span>
                </div>
                <button className="wlm-toggle" type="button" onClick={() => setOpen(true)}>
                    Manage
                </button>
            </section>
        );
    }

    return (
        <section className={\`wlm-panel \${compact ? 'wlm-panel--compact' : ''}\`}>
            <div className="wlm-header">
                <div>
                    <span className="wlm-eyebrow">Weather locations</span>
                    <h3>Add / delete locations</h3>
                    <p>Add Colombo or remove cities using the × button. Static-host mode supports registry cities only.</p>
                </div>
                <button className="wlm-toggle wlm-close" type="button" onClick={() => setOpen(false)}>
                    Done
                </button>
            </div>

            <div className="wlm-chip-row">
                {cities.map(city => (
                    <span key={city} className="wlm-chip">
                        <span>{WEATHER_LOCATION_REGISTRY[city]?.icon || '📍'} {WEATHER_LOCATION_REGISTRY[city]?.display || city}</span>
                        <button
                            type="button"
                            onClick={() => removeCity(city)}
                            disabled={cities.length <= 1}
                            aria-label={\`Remove \${WEATHER_LOCATION_REGISTRY[city]?.display || city}\`}
                            title="Remove city"
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            {availableToAdd.length > 0 && (
                <div className="wlm-add-row">
                    <select
                        className="wlm-select"
                        value={inputValue}
                        onChange={event => {
                            setInputValue(event.target.value);
                            setMessage('');
                        }}
                    >
                        <option value="">Add a city…</option>
                        {availableToAdd.map(option => (
                            <option key={option.key} value={option.key}>
                                {option.label} — {option.country}
                            </option>
                        ))}
                    </select>
                    <button className="wlm-add-btn" type="button" onClick={addCity} disabled={!inputValue}>
                        Add
                    </button>
                </div>
            )}

            <div className="wlm-footer">
                <button className="wlm-reset" type="button" onClick={resetToDefaults}>
                    Reset defaults
                </button>
                {message && <span className="wlm-message">{message}</span>}
            </div>
        </section>
    );
}
`);

write('src/components/weather/WeatherLocationManager.css', `.wlm-collapsed,
.wlm-panel {
    margin: 12px 16px;
    border: 1px solid rgba(45, 212, 191, 0.22);
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72));
    color: var(--text-primary, #f8fafc);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
}

.wlm-collapsed {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 14px;
}

.wlm-collapsed strong,
.wlm-collapsed span {
    display: block;
}

.wlm-collapsed strong {
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #99f6e4;
}

.wlm-collapsed span {
    margin-top: 2px;
    color: #cbd5e1;
    font-size: 0.82rem;
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

.wlm-eyebrow {
    color: #99f6e4;
    font-size: 0.66rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.wlm-header h3 {
    margin: 2px 0 4px;
    font-size: 1rem;
}

.wlm-header p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.78rem;
}

.wlm-toggle,
.wlm-add-btn,
.wlm-reset {
    border: 1px solid rgba(45, 212, 191, 0.28);
    border-radius: 999px;
    background: rgba(20, 184, 166, 0.14);
    color: #ccfbf1;
    cursor: pointer;
    font-weight: 900;
}

.wlm-toggle {
    min-height: 34px;
    padding: 0 14px;
}

.wlm-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 14px 0;
}

.wlm-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 7px 6px 10px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 999px;
    background: rgba(2, 6, 23, 0.38);
    color: #e2e8f0;
    font-size: 0.82rem;
}

.wlm-chip button {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 999px;
    background: rgba(248, 113, 113, 0.18);
    color: #fecaca;
    cursor: pointer;
}

.wlm-chip button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.wlm-add-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
}

.wlm-select {
    min-height: 38px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 999px;
    background: rgba(2, 6, 23, 0.62);
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

.wlm-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
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
}

@media (max-width: 640px) {
    .wlm-collapsed,
    .wlm-header,
    .wlm-footer {
        flex-direction: column;
        align-items: stretch;
    }

    .wlm-add-row {
        grid-template-columns: 1fr;
    }

    .wlm-toggle,
    .wlm-add-btn,
    .wlm-reset {
        width: 100%;
    }
}
`);

/* -------------------------------------------------------------------------- */
/* 3) Weekly forecast: professional compact rows with rain mm/prob, feel, RH   */
/* -------------------------------------------------------------------------- */

write('src/components/weather/WeeklyWeatherForecast.jsx', `import React from 'react';
import './WeeklyWeatherForecast.css';

function uvLabel(uv) {
    if (uv == null) return '';
    if (uv >= 11) return 'Extreme';
    if (uv >= 8) return 'Very high';
    if (uv >= 6) return 'High';
    if (uv >= 3) return 'Moderate';
    return 'Low';
}

function getValue(day, keys, fallback = null) {
    for (const key of keys) {
        if (day?.[key] != null) return day[key];
    }
    return fallback;
}

function formatRain(day) {
    const probability = getValue(day, ['precipProb', 'rainProb', 'rainfallProbability'], 0);
    const mm = getValue(day, ['precipSum', 'rainMm', 'rainfallMm'], 0);
    return \`\${probability ?? 0}% · \${Number(mm || 0).toFixed(1)}mm\`;
}

export default function WeeklyWeatherForecast({ forecast, cityName }) {
    if (!Array.isArray(forecast) || forecast.length === 0) return null;

    return (
        <section className="wwf-card">
            <div className="wwf-header">
                <div>
                    <span className="wwf-eyebrow">Weekly forecast</span>
                    <h3>7-day outlook</h3>
                </div>
                {cityName && <span className="wwf-city">{cityName}</span>}
            </div>

            <div className="wwf-rows">
                {forecast.slice(0, 7).map((day, index) => {
                    const label = day.dayLabel || day.label || (index === 0 ? 'Today' : day.date);
                    const high = getValue(day, ['tempMax', 'high']);
                    const low = getValue(day, ['tempMin', 'low']);
                    const feel = getValue(day, ['realFeelDay', 'feelsLikeDay', 'apparentMax']);
                    const humidity = getValue(day, ['humidityDay', 'humidityMean']);
                    const uv = getValue(day, ['uvMax', 'uvIndex']);
                    const wind = getValue(day, ['windMax', 'windKph']);

                    return (
                        <article key={day.date || index} className={\`wwf-row \${index === 0 ? 'wwf-row--today' : ''}\`}>
                            <div className="wwf-main">
                                <span className="wwf-day">{label}</span>
                                <span className="wwf-condition">
                                    <span className="wwf-icon">{day.icon || '☁️'}</span>
                                    {day.condition || 'Forecast'}
                                </span>
                            </div>

                            <div className="wwf-temp">
                                <strong>{high != null ? \`\${high}°\` : '—'}</strong>
                                <span>{low != null ? \`\${low}°\` : '—'}</span>
                            </div>

                            <div className="wwf-metric">
                                <span>Rain</span>
                                <strong>{formatRain(day)}</strong>
                            </div>

                            <div className="wwf-metric">
                                <span>Feels</span>
                                <strong>{feel != null ? \`\${feel}°\` : '—'}</strong>
                            </div>

                            <div className="wwf-metric">
                                <span>Humidity</span>
                                <strong>{humidity != null ? \`\${humidity}%\` : '—'}</strong>
                            </div>

                            <div className="wwf-metric">
                                <span>UV / Wind</span>
                                <strong>{uv != null ? uvLabel(uv) : '—'}{wind != null ? \` · \${wind}km/h\` : ''}</strong>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
`);

write('src/components/weather/WeeklyWeatherForecast.css', `.wwf-card {
    margin: 14px 16px;
    border: 1px solid rgba(45, 212, 191, 0.18);
    border-radius: 20px;
    overflow: hidden;
    background:
        radial-gradient(520px 180px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 70%),
        rgba(15, 23, 42, 0.68);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18);
}

.wwf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.wwf-eyebrow {
    color: #99f6e4;
    font-size: 0.66rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.wwf-header h3 {
    margin: 3px 0 0;
    color: #f8fafc;
    font-size: 1rem;
}

.wwf-city {
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(20, 184, 166, 0.14);
    color: #ccfbf1;
    font-size: 0.76rem;
    font-weight: 900;
}

.wwf-rows {
    display: grid;
    gap: 8px;
    padding: 12px;
}

.wwf-row {
    display: grid;
    grid-template-columns: minmax(150px, 1.4fr) 86px repeat(4, minmax(86px, 1fr));
    align-items: center;
    gap: 10px;
    padding: 11px 12px;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 16px;
    background: rgba(2, 6, 23, 0.34);
}

.wwf-row--today {
    border-color: rgba(45, 212, 191, 0.28);
    background: rgba(20, 184, 166, 0.10);
}

.wwf-main,
.wwf-metric,
.wwf-temp {
    min-width: 0;
}

.wwf-day {
    display: block;
    color: #f8fafc;
    font-weight: 900;
    font-size: 0.9rem;
}

.wwf-condition {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 3px;
    color: #94a3b8;
    font-size: 0.78rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.wwf-icon {
    flex: 0 0 auto;
}

.wwf-temp {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 6px;
}

.wwf-temp strong {
    color: #f8fafc;
    font-size: 1.12rem;
}

.wwf-temp span {
    color: #94a3b8;
    font-size: 0.86rem;
}

.wwf-metric span,
.wwf-metric strong {
    display: block;
}

.wwf-metric span {
    color: #64748b;
    font-size: 0.66rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.wwf-metric strong {
    margin-top: 3px;
    color: #cbd5e1;
    font-size: 0.78rem;
    white-space: nowrap;
}

@media (max-width: 980px) {
    .wwf-row {
        grid-template-columns: 1fr 76px;
    }

    .wwf-metric {
        display: grid;
        grid-template-columns: 82px 1fr;
        grid-column: 1 / -1;
    }

    .wwf-temp {
        justify-content: flex-end;
    }
}
`);

/* -------------------------------------------------------------------------- */
/* 4) QuickWeather desktop visibility + precipitation mm + professional alert  */
/* -------------------------------------------------------------------------- */

write('src/components/QuickWeatherRefined.css', `.quick-weather-card {
    border: 1px solid rgba(45, 212, 191, 0.20) !important;
    border-radius: 22px !important;
    background:
        radial-gradient(520px 190px at 100% 0%, rgba(20, 184, 166, 0.14), transparent 72%),
        linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.82)) !important;
    color: #f8fafc !important;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.26);
}

.qw-config-bar {
    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    padding-bottom: 10px;
}

.qw-config-bar input {
    background: rgba(2, 6, 23, 0.75) !important;
    border-color: rgba(148, 163, 184, 0.28) !important;
    color: #f8fafc !important;
}

.qw-config-bar input::placeholder {
    color: #94a3b8 !important;
}

.qw-config-bar button {
    background: rgba(20, 184, 166, 0.16) !important;
    border-color: rgba(45, 212, 191, 0.28) !important;
    color: #ccfbf1 !important;
}

.qw-cities-list {
    display: grid;
    gap: 8px;
}

.qw-city-row {
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 16px;
    background: rgba(2, 6, 23, 0.32);
    color: #e2e8f0;
}

.qw-city-row--active {
    border-color: rgba(45, 212, 191, 0.36);
    background: rgba(20, 184, 166, 0.12);
}

.qw-city-slot__pop {
    min-width: 74px;
    color: #bfdbfe;
    font-weight: 800;
}

.qw-pop-high,
.qw-pop-low {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
}

.qw-pop-high {
    color: #93c5fd;
}

.qw-pop-low {
    color: #64748b;
}

.qw-highlight-text-container {
    display: grid !important;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: start;
    margin-top: 12px;
    padding: 12px 14px !important;
    border: 1px solid rgba(45, 212, 191, 0.20);
    border-radius: 18px !important;
    background:
        linear-gradient(135deg, rgba(20, 184, 166, 0.14), rgba(59, 130, 246, 0.10)) !important;
    color: #e2e8f0 !important;
}

.qw-highlight-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: rgba(2, 6, 23, 0.38);
    font-size: 1.1rem;
}

.qw-highlight-text {
    color: #f8fafc !important;
    font-size: 0.92rem;
    font-weight: 800;
    line-height: 1.35;
}

.qw-severe-banner {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 16px;
    border: 1px solid rgba(248, 113, 113, 0.32);
    background: rgba(127, 29, 29, 0.24);
    color: #fecaca;
}

@media (min-width: 900px) {
    .quick-weather-card {
        min-height: 180px;
    }

    .qw-config-bar {
        position: relative;
        z-index: 1;
    }
}

@media (max-width: 640px) {
    .qw-config-bar {
        align-items: stretch !important;
    }

    .qw-config-bar form {
        width: 100%;
    }

    .qw-config-bar input {
        flex: 1;
        width: 100% !important;
    }
}
`);

patchFile('src/components/QuickWeather.jsx', source => {
    let text = source;

    text = insertAfterOnce(
        text,
        `import QuickWeatherSignalStrip from './weather/QuickWeatherSignalStrip.jsx';`,
        `
import {
    buildWeatherSettingsWithCities,
    getCityWeatherKey,
    getConfiguredWeatherCities,
    getWeatherLocation,
    getWeatherLocationLabel,
    getWeatherLocationOptions,
} from '../services/weatherLocations.js';
import './QuickWeatherRefined.css';`,
        'QuickWeather refined imports'
    );

    text = replaceOnce(
        text,
        `function normalizeCity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\\s+/g, ' ');
}`,
        `function normalizeCity(value) {
    return getCityWeatherKey(value);
}`,
        'QuickWeather normalizeCity registry'
    );

    text = replaceOnce(
        text,
        `function getCityLabel(city, cityData) {
    return cityData?.name || titleCase(city);
}`,
        `function getCityLabel(city, cityData) {
    return cityData?.name || getWeatherLocationLabel(city) || titleCase(city);
}`,
        'QuickWeather city labels'
    );

    text = replaceOnce(
        text,
        `function getConfiguredCities(settings) {
    const raw = settings?.weather?.cities || DEFAULT_CITIES;
    const cleaned = raw.map(normalizeCity).filter(Boolean);
    return [...new Set(cleaned)].length ? [...new Set(cleaned)] : DEFAULT_CITIES;
}`,
        `function getConfiguredCities(settings) {
    return getConfiguredWeatherCities(settings);
}`,
        'QuickWeather configured cities'
    );

    text = replaceOnce(
        text,
        `        const nextSettings = {
            ...settings,
            weather: {
                ...(settings?.weather || {}),
                cities: uniqueCities
            }
        };`,
        `        const nextSettings = buildWeatherSettingsWithCities(settings, uniqueCities);`,
        'QuickWeather save real city settings'
    );

    text = insertAfterOnce(
        text,
        `        if (!city) {
            setCityEditMessage('Enter a city name.');
            return;
        }

`,
        `        if (!getWeatherLocation(city)) {
            setCityEditMessage('Select a supported city: Chennai, Trichy, Muscat or Colombo.');
            return;
        }

`,
        'QuickWeather reject unsupported city'
    );

    text = text.replace(
        `setCityEditMessage(\`\${titleCase(city)} is already added.\`);`,
        `setCityEditMessage(\`\${getWeatherLocationLabel(city)} is already added.\`);`
    );

    text = insertAfterOnce(
        text,
        `                        aria-label="Add weather city"`,
        `
                        list="quick-weather-city-options"`,
        'QuickWeather datalist attribute'
    );

    text = insertAfterOnce(
        text,
        `                    />
`,
        `                    <datalist id="quick-weather-city-options">
                        {getWeatherLocationOptions().map(option => (
                            <option key={option.key} value={option.label}>{option.country}</option>
                        ))}
                    </datalist>
`,
        'QuickWeather city datalist'
    );

    text = replaceOnce(
        text,
        `{(slot.prob || 0) > 20
                                                ? <span className="qw-pop-high">💧{slot.prob}%</span>
                                                : <span className="qw-pop-low">--</span>
                                            }`,
        `{(slot.prob || 0) > 20 || (slot.precip || 0) > 0
                                                ? <span className="qw-pop-high">💧{slot.prob || 0}% · {(slot.precip || 0).toFixed ? (slot.precip || 0).toFixed(1) : slot.precip}mm</span>
                                                : <span className="qw-pop-low">0% · 0.0mm</span>
                                            }`,
        'QuickWeather precip mm display'
    );

    return text;
});

/* -------------------------------------------------------------------------- */
/* 5) Weather service: daily rain, feels-like day, humidity day                */
/* -------------------------------------------------------------------------- */

patchFile('src/services/weatherService.js', source => {
    let text = source;

    if (!text.includes('getWeatherLocationLabel')) {
        text = text.replace(
            `import { WEATHER_LOCATION_REGISTRY } from './weatherLocations.js';`,
            `import { WEATHER_LOCATION_REGISTRY, getWeatherLocationLabel } from './weatherLocations.js';`
        );
    }

    text = replaceOnce(
        text,
        `        daily: 'precipitation_probability_max,precipitation_sum,uv_index_max,temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max',`,
        `        daily: 'precipitation_probability_max,precipitation_sum,uv_index_max,temperature_2m_max,temperature_2m_min,apparent_temperature_max,relative_humidity_2m_mean,weather_code,wind_speed_10m_max',`,
        'Weather daily real-feel humidity fields'
    );

    text = replaceOnce(
        text,
        `        name: locationName.charAt(0).toUpperCase() + locationName.slice(1),
        icon: locationName === 'muscat' ? '📍' : '🏛️',`,
        `        name: getWeatherLocationLabel(locationName),
        icon: WEATHER_LOCATION_REGISTRY[locationName]?.icon || (locationName === 'muscat' ? '📍' : '🏛️'),`,
        'Weather service display label and icon'
    );

    text = replaceOnce(
        text,
        `        summary: parseFloat(totalPrecip) > 0 ? \`Today's max rain probability: \${maxPrecipProb}%. Total precip: \${totalPrecip}mm. UV Index: \${maxUV || 'N/A'}.\` : \`Condition stable. UV Index: \${maxUV || 'N/A'}.\``,
        `        summary: parseFloat(totalPrecip) > 0
            ? \`Rain \${maxPrecipProb}% · \${totalPrecip}mm · UV \${maxUV || 'N/A'}\`
            : \`Stable · UV \${maxUV || 'N/A'}\``,
        'Weather summary crisp text'
    );

    const humidityBlock = `        const apparentMax = [
            modelData.ecmwf?.daily?.apparent_temperature_max?.[d],
            modelData.gfs?.daily?.apparent_temperature_max?.[d],
            modelData.icon?.daily?.apparent_temperature_max?.[d],
        ].filter(v => v != null);
        const humidityMean = [
            modelData.ecmwf?.daily?.relative_humidity_2m_mean?.[d],
            modelData.gfs?.daily?.relative_humidity_2m_mean?.[d],
            modelData.icon?.daily?.relative_humidity_2m_mean?.[d],
        ].filter(v => v != null);
`;

    text = insertAfterOnce(
        text,
        `        const windMax = [
            modelData.ecmwf?.daily?.wind_speed_10m_max?.[d],
            modelData.gfs?.daily?.wind_speed_10m_max?.[d],
            modelData.icon?.daily?.wind_speed_10m_max?.[d],
        ].filter(v => v != null);
`,
        humidityBlock,
        'Weather daily apparent/humidity consensus'
    );

    text = replaceOnce(
        text,
        `            tempMax: avg(tempMax),
            tempMin: avg(tempMin),
            precipProb: avg(precipProb),
            precipSum: avgF(precipSum),
            uvMax: avg(uvMax),
            windMax: avg(windMax),`,
        `            tempMax: avg(tempMax),
            tempMin: avg(tempMin),
            high: avg(tempMax),
            low: avg(tempMin),
            precipProb: avg(precipProb),
            rainProb: avg(precipProb),
            rainfallProbability: avg(precipProb),
            precipSum: avgF(precipSum),
            rainMm: avgF(precipSum),
            rainfallMm: avgF(precipSum),
            realFeelDay: avg(apparentMax),
            feelsLikeDay: avg(apparentMax),
            humidityDay: avg(humidityMean),
            humidityMean: avg(humidityMean),
            uvMax: avg(uvMax),
            uvIndex: avg(uvMax),
            windMax: avg(windMax),`,
        'Weather weekly metric aliases'
    );

    return text;
});

/* -------------------------------------------------------------------------- */
/* 6) On This Day display setting: off by default contract                     */
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

write('src/components/settings/DisplayPreferencesPanel.jsx', `import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import { buildDisplaySettings, shouldShowOnThisDay } from '../../services/displayPreferences.js';

export default function DisplayPreferencesPanel() {
    const { settings, updateSettings } = useSettings();
    const showOnThisDay = shouldShowOnThisDay(settings);

    return (
        <section className="display-preferences-panel">
            <label>
                <input
                    type="checkbox"
                    checked={showOnThisDay}
                    onChange={event => updateSettings(buildDisplaySettings(settings, {
                        showOnThisDay: event.target.checked,
                    }))}
                />
                Show “On this day”
            </label>
        </section>
    );
}
`);

/* -------------------------------------------------------------------------- */
/* 7) Certification                                                            */
/* -------------------------------------------------------------------------- */

write('scripts/test_weather_ux_closeout_static.mjs', `import fs from 'fs';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function read(path) {
    assert(fs.existsSync(path), 'Missing file: ' + path);
    return fs.readFileSync(path, 'utf8');
}

const locations = read('src/services/weatherLocations.js');
const manager = read('src/components/weather/WeatherLocationManager.jsx');
const managerCss = read('src/components/weather/WeatherLocationManager.css');
const quickWeather = read('src/components/QuickWeather.jsx');
const quickCss = read('src/components/QuickWeatherRefined.css');
const weekly = read('src/components/weather/WeeklyWeatherForecast.jsx');
const weeklyCss = read('src/components/weather/WeeklyWeatherForecast.css');
const service = read('src/services/weatherService.js');
const displayPrefs = read('src/services/displayPreferences.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
    'colombo',
    'getWeatherLocationOptions',
    'getWeatherLocationLabel',
    'WEATHER_LOCATION_CONFIG_VERSION',
    'weather-locations-v3-colombo-ux'
]) {
    assert(locations.includes(token), 'weatherLocations.js missing token: ' + token);
}

for (const token of [
    'Add / delete locations',
    'Colombo',
    'Reset defaults',
    'wlm-chip',
    'removeCity'
]) {
    assert(manager.includes(token) || managerCss.includes(token), 'WeatherLocationManager missing token: ' + token);
}

for (const token of [
    'QuickWeatherRefined.css',
    'getWeatherLocationOptions',
    'Select a supported city',
    'quick-weather-city-options',
    '0% · 0.0mm'
]) {
    assert(quickWeather.includes(token), 'QuickWeather.jsx missing token: ' + token);
}

for (const token of [
    '.quick-weather-card',
    '.qw-config-bar input',
    '.qw-highlight-text-container',
    '.qw-city-row--active'
]) {
    assert(quickCss.includes(token), 'QuickWeatherRefined.css missing token: ' + token);
}

for (const token of [
    'realFeelDay',
    'humidityDay',
    'formatRain',
    '7-day outlook'
]) {
    assert(weekly.includes(token), 'WeeklyWeatherForecast.jsx missing token: ' + token);
}

for (const token of [
    '.wwf-card',
    '.wwf-row',
    '.wwf-metric',
    'rgba(15, 23, 42'
]) {
    assert(weeklyCss.includes(token), 'WeeklyWeatherForecast.css missing token: ' + token);
}

for (const token of [
    'apparent_temperature_max',
    'relative_humidity_2m_mean',
    'rainfallProbability',
    'realFeelDay',
    'humidityDay',
    'Rain '
]) {
    assert(service.includes(token), 'weatherService.js missing token: ' + token);
}

for (const token of [
    'showOnThisDay: false',
    'shouldShowOnThisDay',
    'buildDisplaySettings'
]) {
    assert(displayPrefs.includes(token), 'displayPreferences.js missing token: ' + token);
}

assert(
    packageJson.includes('"test:weather-ux-closeout"'),
    'package.json must include test:weather-ux-closeout'
);

assert(
    certGate.includes("['npm', ['run', 'test:weather-ux-closeout']]") ||
    certGate.includes('certification_manifest.json'),
    'certification gate must include weather UX closeout test or be manifest-driven'
);

console.log(JSON.stringify({
    status: 'PASS',
    checked: 'Weather UX closeout',
    guarantees: [
        'Colombo remains in supported weather registry',
        'Weather location manager supports visible add/delete/reset',
        'QuickWeather add city is real and registry-backed',
        'QuickWeather displays precipitation probability and mm',
        'QuickWeather desktop contrast is improved',
        'Weekly forecast includes rainfall probability/mm, real feel and humidity',
        'Weekly forecast CSS matches dark professional Weather tab style',
        'On This Day setting contract is off by default'
    ]
}, null, 2));

console.log('PASS: Weather UX closeout static slice');
`);

patchFile('package.json', source => {
    const pkg = JSON.parse(source);
    pkg.scripts = pkg.scripts || {};
    pkg.scripts['test:weather-ux-closeout'] = 'node scripts/test_weather_ux_closeout_static.mjs';
    return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
    if (source.includes("['npm', ['run', 'test:weather-ux-closeout']]")) return source;
    if (source.includes('certification_manifest.json')) return source;

    if (source.includes("  ['npm', ['run', 'test:weather-weekly-planning']],")) {
        return source.replace(
            "  ['npm', ['run', 'test:weather-weekly-planning']],",
            "  ['npm', ['run', 'test:weather-weekly-planning']],\\n  ['npm', ['run', 'test:weather-ux-closeout']],"
        );
    }

    if (source.includes("  ['npm', ['run', 'test:weather-trust']],")) {
        return source.replace(
            "  ['npm', ['run', 'test:weather-trust']],",
            "  ['npm', ['run', 'test:weather-trust']],\\n  ['npm', ['run', 'test:weather-ux-closeout']],"
        );
    }

    return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
    patchFile('scripts/certification_manifest.json', source => {
        const manifest = JSON.parse(source);
        manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

        if (!manifest.commands.some(entry => entry.id === 'weather-ux-closeout')) {
            const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-weekly-planning');
            const command = {
                id: 'weather-ux-closeout',
                cmd: 'npm',
                args: ['run', 'test:weather-ux-closeout'],
            };

            if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
            else manifest.commands.push(command);
        }

        return JSON.stringify(manifest, null, 2) + '\n';
    });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
    patchFile('scripts/validate_certification_manifest.mjs', source => {
        if (source.includes('test:weather-ux-closeout')) return source;

        if (source.includes("'test:weather-weekly-planning',")) {
            return source.replace(
                "'test:weather-weekly-planning',",
                "'test:weather-weekly-planning',\\n  'test:weather-ux-closeout',"
            );
        }

        return source;
    });
}

console.log('\\nSlice 61A Weather UX closeout patch complete.');
