import React from 'react';
import './WeatherTrustPanel.css';

function titleCase(value) {
    const text = String(value || '').trim();
    if (!text) return 'Unknown';

    return text
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function hasSegment(cityData, key) {
    return Boolean(cityData?.[key]);
}

function hasTomorrowSegment(cityData, key) {
    return Boolean(cityData?.tomorrow?.[key]);
}

function getCitySegmentCount(cityData) {
    if (!cityData) return 0;

    return [
        hasSegment(cityData, 'morning'),
        hasSegment(cityData, 'noon'),
        hasSegment(cityData, 'evening'),
        hasTomorrowSegment(cityData, 'morning'),
        hasTomorrowSegment(cityData, 'noon'),
        hasTomorrowSegment(cityData, 'evening')
    ].filter(Boolean).length;
}

function hasUsableCityWeather(cityData) {
    return Boolean(
        cityData?.current ||
        getCitySegmentCount(cityData) > 0 ||
        (Array.isArray(cityData?.hourly24) && cityData.hourly24.length > 0) ||
        (Array.isArray(cityData?.next8Hours) && cityData.next8Hours.length > 0)
    );
}

function getAgeLabel(weatherData) {
    const timestamps = Object.values(weatherData || {})
        .map(cityData => cityData?.fetchedAt || cityData?.updatedAt || cityData?.generatedAt || cityData?.current?.time)
        .filter(Boolean)
        .map(value => new Date(value).getTime())
        .filter(Number.isFinite);

    if (timestamps.length === 0) return 'age unknown';

    const latest = Math.max(...timestamps);
    const ageMs = Math.max(0, Date.now() - latest);
    const minutes = Math.round(ageMs / 60000);

    if (minutes < 60) return `${minutes}m old`;

    const hours = Math.round(ageMs / 36e5);
    if (hours < 48) return `${hours}h old`;

    return `${Math.round(hours / 24)}d old`;
}

function getSourceMode(weatherData) {
    const modes = Object.values(weatherData || {})
        .map(cityData => cityData?.sourceMode || cityData?.source)
        .filter(Boolean)
        .map(String);

    const unique = [...new Set(modes)];

    return unique.length ? unique.join(' / ') : 'forecast model';
}

function getCityCoverage(weatherData = {}, cities = []) {
    return cities.map(city => {
        const cityData = weatherData?.[city];
        const segmentCount = getCitySegmentCount(cityData);
        const hasCurrent = Boolean(cityData?.current);
        const hasHourly = Boolean(
            (Array.isArray(cityData?.hourly24) && cityData.hourly24.length > 0) ||
            (Array.isArray(cityData?.next8Hours) && cityData.next8Hours.length > 0)
        );

        return {
            city,
            label: cityData?.name || titleCase(city),
            ok: hasUsableCityWeather(cityData),
            hasCurrent,
            hasHourly,
            segmentCount,
            temp: cityData?.current?.temp ?? cityData?.morning?.temp ?? null,
            summary: cityData?.summary || cityData?.current?.condition || 'No forecast'
        };
    });
}

function getTrustGrade({ weatherData, cities, error }) {
    const coverage = getCityCoverage(weatherData, cities);
    const available = coverage.filter(item => item.ok).length;
    const currentCount = coverage.filter(item => item.hasCurrent).length;
    const hourlyCount = coverage.filter(item => item.hasHourly).length;
    const segmentTotal = coverage.reduce((sum, item) => sum + item.segmentCount, 0);
    const ageLabel = getAgeLabel(weatherData);
    const sourceMode = getSourceMode(weatherData);

    if (error && available === 0) {
        return {
            grade: 'F',
            tone: 'danger',
            title: 'Weather unavailable',
            message: 'Weather feed failed and no usable cached forecast is available.',
            coverage,
            available,
            currentCount,
            hourlyCount,
            segmentTotal,
            ageLabel,
            sourceMode
        };
    }

    if (available === cities.length && currentCount === cities.length && segmentTotal >= cities.length * 3) {
        return {
            grade: 'A',
            tone: 'good',
            title: 'Complete forecast coverage',
            message: `${available}/${cities.length} cities have current and forecast data.`,
            coverage,
            available,
            currentCount,
            hourlyCount,
            segmentTotal,
            ageLabel,
            sourceMode
        };
    }

    if (available >= Math.max(1, Math.ceil(cities.length * 0.67))) {
        return {
            grade: 'B',
            tone: 'info',
            title: 'Useful partial coverage',
            message: `${available}/${cities.length} cities have usable weather data.`,
            coverage,
            available,
            currentCount,
            hourlyCount,
            segmentTotal,
            ageLabel,
            sourceMode
        };
    }

    if (available > 0) {
        return {
            grade: 'C',
            tone: 'warn',
            title: 'Thin weather coverage',
            message: `${available}/${cities.length} cities have usable weather data.`,
            coverage,
            available,
            currentCount,
            hourlyCount,
            segmentTotal,
            ageLabel,
            sourceMode
        };
    }

    return {
        grade: 'F',
        tone: 'danger',
        title: 'No displayable weather',
        message: 'No configured city returned usable weather data.',
        coverage,
        available,
        currentCount,
        hourlyCount,
        segmentTotal,
        ageLabel,
        sourceMode
    };
}

export default function WeatherTrustPanel({
    weatherData,
    cities,
    activeCity,
    error,
    loading,
    onRefresh
}) {
    const safeCities = cities?.length ? cities : ['chennai', 'trichy', 'muscat'];
    const trust = getTrustGrade({
        weatherData: weatherData || {},
        cities: safeCities,
        error
    });

    return (
        <section className={`weather-trust-panel weather-trust-panel--${trust.tone}`} data-weather-trust-grade={trust.grade}>
            <div className="weather-trust-panel__summary">
                <div className="weather-trust-panel__grade">
                    <span>Grade</span>
                    <strong>{trust.grade}</strong>
                </div>

                <div className="weather-trust-panel__body">
                    <div className="weather-trust-panel__eyebrow">Forecast trust</div>
                    <h2>{trust.title}</h2>
                    <p>{trust.message}</p>

                    <div className="weather-trust-panel__meta">
                        <span>{trust.ageLabel}</span>
                        <span>{trust.sourceMode}</span>
                        <span>{trust.segmentTotal} forecast slots</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="weather-trust-panel__refresh"
                    onClick={() => onRefresh?.()}
                    disabled={loading}
                >
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            <div className="weather-trust-panel__cities" aria-label="Weather city coverage">
                {trust.coverage.map(item => (
                    <div
                        key={item.city}
                        className={`weather-trust-panel__city ${item.city === activeCity ? 'weather-trust-panel__city--active' : ''} ${item.ok ? 'weather-trust-panel__city--ok' : 'weather-trust-panel__city--missing'}`}
                    >
                        <div className="weather-trust-panel__city-name">{item.label}</div>
                        <div className="weather-trust-panel__city-temp">
                            {item.temp == null ? '—' : `${item.temp}°`}
                        </div>
                        <div className="weather-trust-panel__city-summary">{item.summary}</div>
                        <div className="weather-trust-panel__city-meta">
                            {item.ok ? `${item.segmentCount} segments` : 'No forecast'}
                        </div>
                    </div>
                ))}
            </div>

            {error && (
                <div className="weather-trust-panel__error">
                    {String(error)}
                </div>
            )}
        </section>
    );
}