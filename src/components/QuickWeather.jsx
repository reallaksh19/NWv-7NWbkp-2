import React, { useState, useEffect, useMemo } from 'react';
import { useWeather } from '../context/WeatherContext';
import { useSettings } from '../context/SettingsContext';
import WeatherIcon from './WeatherIcons';
import QuickWeatherSignalStrip from './weather/QuickWeatherSignalStrip.jsx';
import { buildNextRiskSummary, buildTomorrowChip } from '../services/weatherInsights.js';
import {
    buildWeatherSettingsWithCities,
    getCityWeatherKey,
    getConfiguredWeatherCities,
    getWeatherLocation,
    getWeatherLocationLabel,
    getWeatherLocationOptions,
    DEFAULT_WEATHER_CITIES
} from '../services/weatherLocations.js';
import './QuickWeatherRefined.css';

const DEFAULT_CITIES = DEFAULT_WEATHER_CITIES;

function normalizeCity(value) {
    return getCityWeatherKey(value);
}

function titleCase(value) {
    const text = String(value || '').trim();
    if (!text) return 'Unknown';
    return text
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function segmentToSlot(segment, label) {
    if (!segment) return null;

    const temp = asNumber(segment.temp ?? segment.temperature ?? segment.currentTemp);
    const condition = segment.condition || segment.summary || segment.weather || '';
    const icon = segment.icon || '☁️';
    const iconId = segment.iconId;
    const prob = Number(segment.rainProb?.avg ?? segment.prob ?? segment.pop ?? 0) || 0;
    const rawPrecip = segment.precip ?? segment.rainMm ?? segment.rain ?? 0;
    const precip = Number.parseFloat(rawPrecip === '-' ? 0 : rawPrecip) || 0;

    if (temp == null && !condition && !iconId && !icon) return null;

    return {
        label: segment.label || segment.time || label,
        temp,
        iconId,
        icon,
        prob,
        precip,
        condition
    };
}

function currentToSlot(current) {
    if (!current) return null;
    return segmentToSlot(current, 'Current');
}

function getCitySlots(cityData) {
    if (!cityData) return [];

    const h24 = Array.isArray(cityData.hourly24) ? cityData.hourly24 : [];
    const next8 = Array.isArray(cityData.next8Hours) ? cityData.next8Hours : [];
    const source = h24.length ? h24 : next8;

    const hourlySlots = [source[0], source[2], source[6]]
        .filter(Boolean)
        .map((slot, index) => segmentToSlot(
            slot,
            slot.label || slot.time || ['Now', '+2h', '+6h'][index]
        ))
        .filter(Boolean);

    if (hourlySlots.length > 0) return hourlySlots;

    const todaySlots = [
        segmentToSlot(cityData.morning, 'Morning'),
        segmentToSlot(cityData.noon, 'Afternoon'),
        segmentToSlot(cityData.evening, 'Evening')
    ].filter(Boolean);

    if (todaySlots.length > 0) return todaySlots;

    const tomorrowSlots = [
        segmentToSlot(cityData.tomorrow?.morning, 'Tomorrow AM'),
        segmentToSlot(cityData.tomorrow?.noon, 'Tomorrow noon'),
        segmentToSlot(cityData.tomorrow?.evening, 'Tomorrow PM')
    ].filter(Boolean);

    if (tomorrowSlots.length > 0) return tomorrowSlots;

    const currentSlot = currentToSlot(cityData.current);
    return currentSlot ? [currentSlot] : [];
}

function hasUsableCityWeather(cityData) {
    return Boolean(cityData && (cityData.current || getCitySlots(cityData).length > 0));
}

function getCityLabel(city, cityData) {
    return cityData?.name || getWeatherLocationLabel(city) || titleCase(city);
}

function getNaturalTextForecast(cityData, cityName) {
    if (!hasUsableCityWeather(cityData)) {
        return `Forecast for ${cityName} is not available yet.`;
    }

    const hourly = cityData?.hourly24?.length ? cityData.hourly24 : cityData?.next8Hours || [];

    if (!hourly || hourly.length === 0) {
        const slots = getCitySlots(cityData);
        const firstSlot = slots[0];
        const condition = cityData?.current?.condition || firstSlot?.condition;
        const temp = cityData?.current?.temp ?? firstSlot?.temp;

        if (condition && temp != null) {
            return `${cityName}: ${condition}, ${temp}°C currently.`;
        }

        return `Current weather for ${cityName} is available; forecast is updating.`;
    }

    const slots = hourly.slice(0, 8);
    const rainSlots = slots.filter(s => (s.precip || 0) > 0.5 || (s.prob || 0) > 40);
    const temps = slots.map(s => asNumber(s.temp)).filter(t => t != null);
    const maxTemp = temps.length ? Math.max(...temps) : null;
    const minTemp = temps.length ? Math.min(...temps) : null;
    const current = cityData.current;

    if (rainSlots.length >= 3) return 'Expect rainy spells throughout the next 8 hours.';
    if (rainSlots.length > 0) return `Expecting showers around ${rainSlots[0].label || rainSlots[0].time}.`;

    const cloudySlots = slots.filter(s => s.condition && s.condition.toLowerCase().includes('cloud'));
    if (cloudySlots.length >= 6) return 'Mostly cloudy skies for the next 8 hours.';

    if (current && maxTemp != null && maxTemp > current.temp + 3) {
        return `Clear skies, warming up to ${maxTemp}° later.`;
    }

    if (current && minTemp != null && minTemp < current.temp - 3) {
        return `Clear skies, cooling down to ${minTemp}° by evening.`;
    }

    if (current?.condition) return `${current.condition} currently. Expect stable conditions.`;

    return 'Weather is available. Forecast is updating.';
}

function getSevereWarning(cityData) {
    const slots = cityData?.hourly24?.length ? cityData.hourly24 : cityData?.next8Hours;
    if (!slots || slots.length === 0) return null;

    const heavyRainSlots = slots.filter(s => (s.precip || 0) >= 10);
    const stormSlots = slots.filter(s => (s.prob || 0) >= 80);
    const temps = slots.map(s => asNumber(s.temp)).filter(t => t != null);
    const maxTemp = temps.length > 0 ? Math.max(...temps) : null;

    if (heavyRainSlots.length > 0) return 'Heavy rain warning in effect.';
    if (stormSlots.length >= 2) return 'Thunderstorms likely.';
    if (maxTemp != null && maxTemp >= 42) return `Heat warning: temperatures reaching ${maxTemp}°C.`;

    return null;
}

function getBackgroundClass() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) return 'qw-bg-morning';
    if (hour >= 11 && hour < 17) return 'qw-bg-day';
    if (hour >= 17 && hour < 20) return 'qw-bg-evening';
    return 'qw-bg-night';
}

function getConfiguredCities(settings) {
    // Uses settings?.weather?.cities to retrieve user-configured city list
    return getConfiguredWeatherCities(settings);
}

const QuickWeather = () => {
    const { weatherData, loading, error, ensureBoot, booted, refreshWeather } = useWeather();
    const { settings, updateSettings } = useSettings();

    const cities = useMemo(() => getConfiguredCities(settings), [settings]);

    const [activeCity, setActiveCity] = useState(() => {
        try {
            return normalizeCity(localStorage.getItem('weather_active_city')) || 'chennai';
        } catch {
            return 'chennai';
        }
    });

    const [newCity, setNewCity] = useState('');
    const [cityEditMessage, setCityEditMessage] = useState('');

    const cityRows = useMemo(() => {
        return cities.map(city => {
            const cityData = weatherData?.[city] || null;
            const slots = getCitySlots(cityData);
            const currentSlot = currentToSlot(cityData?.current);
            const firstSlot = slots[0] || currentSlot;

            return {
                city,
                cityData,
                slots,
                currentSlot,
                firstSlot,
                usable: hasUsableCityWeather(cityData),
                label: getCityLabel(city, cityData)
            };
        });
    }, [cities, weatherData]);

    useEffect(() => {
        ensureBoot?.();
    }, [ensureBoot]);

    useEffect(() => {
        if (cities.length > 0 && !cities.includes(activeCity)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveCity(cities[0]);
        }
    }, [activeCity, cities]);

    useEffect(() => {
        try {
            localStorage.setItem('weather_active_city', activeCity);
        } catch {
            // Ignore storage errors.
        }
    }, [activeCity]);

    function saveCities(nextCities, nextActiveCity = activeCity) {
        const uniqueCities = [...new Set(nextCities.map(normalizeCity).filter(Boolean))];

        if (uniqueCities.length === 0) {
            setCityEditMessage('At least one city must remain.');
            return;
        }

        // Builds settings with: weather: { cities: uniqueCities }
        const nextSettings = buildWeatherSettingsWithCities(settings, uniqueCities);

        updateSettings(nextSettings);
        setActiveCity(nextActiveCity);
        setCityEditMessage('');
        refreshWeather?.(true);
    }

    function handleAddCity(event) {
        event.preventDefault();

        const city = normalizeCity(newCity);

        if (!city) {
            setCityEditMessage('Enter a city name.');
            return;
        }

        if (!getWeatherLocation(city)) {
            setCityEditMessage('Select a supported city: Chennai, Trichy, Muscat or Colombo.');
            return;
        }

        if (cities.includes(city)) {
            setCityEditMessage(`${getWeatherLocationLabel(city)} is already added.`);
            return;
        }

        const nextCities = [...cities, city];
        setNewCity('');
        saveCities(nextCities, city);
    }

    function handleRemoveCity(cityToRemove) {
        const nextCities = cities.filter(city => city !== cityToRemove);

        if (nextCities.length === 0) {
            setCityEditMessage('At least one city must remain.');
            return;
        }

        const nextActive = activeCity === cityToRemove ? nextCities[0] : activeCity;
        saveCities(nextCities, nextActive);
    }

    if (!booted || loading) {
        return (
            <div className="quick-weather-card qw-bg-day">
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    Loading weather...
                </div>
            </div>
        );
    }

    const usableRows = cityRows.filter(row => row.usable);

    const bgClass = getBackgroundClass();
    const activeRow = cityRows.find(row => row.city === activeCity && row.usable) ||
        usableRows[0] ||
        cityRows.find(row => row.city === activeCity) ||
        cityRows[0];

    const activeCityData = activeRow?.cityData;
    const severeWarning = getSevereWarning(activeCityData);
    const textForecast = activeRow
        ? getNaturalTextForecast(activeCityData, activeRow.label)
        : 'Weather forecast is not available yet.';

    return (
        <section className={`quick-weather-card ${bgClass}`}>
            <div
                className="qw-config-bar"
                style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    flexWrap: 'wrap'
                }}
            >
                <strong style={{ fontSize: '0.9rem' }}>Quick Weather</strong>

                <form
                    onSubmit={handleAddCity}
                    style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
                >
                    <input
                        value={newCity}
                        onChange={(event) => setNewCity(event.target.value)}
                        placeholder="Add city"
                        aria-label="Add weather city"
                        list="quick-weather-city-options"
                        style={{
                            width: '110px',
                            minHeight: '30px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.28)',
                            background: 'rgba(0,0,0,0.16)',
                            color: 'inherit',
                            padding: '0 10px'
                        }}
                    />
                    <datalist id="quick-weather-city-options">
                        {getWeatherLocationOptions().map(option => (
                            <option key={option.key} value={option.label}>{option.country}</option>
                        ))}
                    </datalist>
                    <button
                        type="submit"
                        aria-label="Add city to quick weather"
                        style={{
                            minHeight: '30px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.28)',
                            background: 'rgba(255,255,255,0.14)',
                            color: 'inherit',
                            padding: '0 10px',
                            cursor: 'pointer',
                            fontWeight: 800
                        }}
                    >
                        Add
                    </button>
                </form>
            </div>

            {cityEditMessage && (
                <div
                    style={{
                        marginBottom: '10px',
                        padding: '8px 10px',
                        borderRadius: '12px',
                        background: 'rgba(0,0,0,0.18)',
                        fontSize: '0.78rem'
                    }}
                >
                    {cityEditMessage}
                </div>
            )}

            <div className="qw-cities-list">
                {cityRows.map(row => {
                    const c = row.currentSlot || row.firstSlot;
                    const isActive = row.city === activeRow?.city;

                    return (
                        <div
                            key={row.city}
                            className={`qw-city-row ${isActive ? 'qw-city-row--active' : ''} ${!row.usable ? 'qw-city-row--missing' : ''}`}
                            onClick={() => setActiveCity(row.city)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') setActiveCity(row.city);
                            }}
                        >
                            <div className="qw-city-row__left">
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span className="qw-city-row__name">{row.label}</span>
                                    <button
                                        type="button"
                                        aria-label={`Remove ${row.label} from quick weather`}
                                        title={`Remove ${row.label}`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleRemoveCity(row.city);
                                        }}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '999px',
                                            border: '1px solid rgba(255,255,255,0.25)',
                                            background: 'rgba(0,0,0,0.20)',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                            lineHeight: 1
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="qw-city-row__current">
                                    {c?.iconId
                                        ? <WeatherIcon id={c.iconId} size={28} />
                                        : <span style={{ fontSize: '1.4rem' }}>{c?.icon || '☁️'}</span>
                                    }

                                    <span className="qw-city-row__temp">
                                        {c?.temp ?? '--'}{c?.temp != null ? '°' : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="qw-city-row__slots">
                                {row.slots.length > 0 ? row.slots.slice(0, 3).map((slot, i) => (
                                    <div key={`${row.city}-${slot.label || slot.time || i}`} className="qw-city-slot">
                                        <span className="qw-city-slot__label">
                                            {slot.label || slot.time || `+${i}h`}
                                        </span>

                                        <div className="qw-city-slot__icon">
                                            {slot.iconId
                                                ? <WeatherIcon id={slot.iconId} size={22} />
                                                : slot.icon
                                            }
                                        </div>

                                        <span className="qw-city-slot__temp">
                                            {slot.temp ?? '-'}{slot.temp != null ? '°' : ''}
                                        </span>

                                        <span className="qw-city-slot__pop">
                                            {(slot.prob || 0) > 20 || (slot.precip || 0) > 0
                                                ? <span className="qw-pop-high">💧{slot.prob || 0}% · {(slot.precip || 0).toFixed ? (slot.precip || 0).toFixed(1) : slot.precip}mm</span>
                                                : <span className="qw-pop-low">0% · 0.0mm</span>
                                            }
                                        </span>
                                    </div>
                                )) : (
                                    <div className="qw-city-slot qw-city-slot--current-only">
                                        <span className="qw-city-slot__label">
                                            {row.usable ? 'Current' : 'No forecast'}
                                        </span>

                                        <div className="qw-city-slot__icon">
                                            {c?.iconId
                                                ? <WeatherIcon id={c.iconId} size={22} />
                                                : (c?.icon || '--')
                                            }
                                        </div>

                                        <span className="qw-city-slot__temp">
                                            {c?.temp ?? '-'}{c?.temp != null ? '°' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="qw-highlight-text-container">
                <span className="qw-highlight-icon">🤖</span>
                <span className="qw-highlight-text">
                    {error && usableRows.length === 0
                        ? 'Weather feed failed. Try refresh from Weather tab.'
                        : textForecast}
                </span>
            </div>

            {severeWarning && (
                <div className="qw-severe-banner">
                    <span className="qw-severe-icon">⚠️</span>
                    <span className="qw-severe-text">{severeWarning}</span>
                </div>
            )}

            <QuickWeatherSignalStrip
                riskSummary={buildNextRiskSummary(activeCityData)}
                tomorrowChip={buildTomorrowChip(activeCityData)}
            />
        </section>
    );
};

export default QuickWeather;