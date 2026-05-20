import React, { useState, useEffect, useCallback } from 'react';
import WeatherStickyHeader from '../components/WeatherStickyHeader';
import DetailedWeatherCard from '../components/DetailedWeatherCard';
import { useWeather } from '../context/WeatherContext';
import { useSettings } from '../context/SettingsContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getConfiguredWeatherCities } from '../services/weatherLocations.js';
import WeatherLocationManager from '../components/weather/WeatherLocationManager.jsx';
import WeeklyWeatherForecast from '../components/weather/WeeklyWeatherForecast.jsx';
import WeatherCityComparison from '../components/weather/WeatherCityComparison.jsx';
import WeatherPlanningSummary from '../components/weather/WeatherPlanningSummary.jsx';
import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditWeatherTabQuality } from '../services/pageAuditGrading.js';

/**
 * Weather Page
 * Dedicated page for detailed weather forecast with sticky header
 */
function WeatherPage() {
    const { weatherData, loading, error, refreshWeather, ensureBoot } = useWeather();
    const { settings } = useSettings();
    const { isDesktop } = useMediaQuery();

    useEffect(() => {
        ensureBoot();
    }, [ensureBoot]);

    // Phase 6: Log offline/snapshot fallback metrics
    useEffect(() => {
        if (!loading && weatherData && Object.keys(weatherData).length > 0) {
            const firstCityData = Object.values(weatherData)[0];
            if (import.meta.env.DEV) {
                console.log('[Phase 6 Diagnostics]', {
                    page: 'weather',
                    sourceMode: firstCityData?.sourceMode || 'none'
                });
            }
        }
    }, [loading, weatherData]);

    // Use real data, if loading show spinner or skeletal
    const displayData = weatherData;
    const cities = getConfiguredWeatherCities(settings);
    // Lift active city state up
    const [activeCity, setActiveCity] = useState(() => {
        // Migrate legacy key on first read so existing user selection is preserved
        const legacy = localStorage.getItem('dw_active_city');
        if (legacy && !localStorage.getItem('weather_active_city')) {
            localStorage.setItem('weather_active_city', legacy);
        }
        return localStorage.getItem('weather_active_city') || 'chennai';
    });

    useEffect(() => {
        localStorage.setItem('weather_active_city', activeCity);
    }, [activeCity]);

    useEffect(() => {
        if (cities.length > 0 && !cities.includes(activeCity)) {
            setTimeout(() => {
                setActiveCity(cities[0]);
            }, 0);
        }
    }, [activeCity, cities]);

    const weatherTabAudit = React.useMemo(() => auditWeatherTabQuality({
        weatherData: displayData || {},
        cities,
        activeCity,
        error,
        loading,
    }), [displayData, cities, activeCity, error, loading]);

    const handleRefresh = useCallback(async () => {
        return refreshWeather(true);
    }, [refreshWeather]);
    const { pullDistance } = usePullToRefresh(handleRefresh);

    // Loading State
    if (loading && !weatherData) {
        return (
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="loading">
                    <div className="loading__spinner"></div>
                    <span>Loading Forecast...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container" style={{ padding: 0 }}>
            <GradeBadge
                audit={weatherTabAudit}
                label="Weather tab quality grade"
                position="below-header"
                topOffset="74px"
                compact={true}
            />

            <div style={{
                height: `${pullDistance}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'var(--bg-secondary)',
                color: 'var(--accent-primary)',
                fontSize: '0.8rem',
                transition: pullDistance === 0 ? 'height 0.3s ease' : 'none'
            }}>
                {pullDistance > 40 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
            {/* Sticky Header replaces standard Header */}
            {displayData && (
                <WeatherStickyHeader
                    weatherData={displayData}
                    activeCity={activeCity} // Pass active city
                    cities={cities}
                    onRefresh={handleRefresh}
                    loading={loading}
                    isDesktop={isDesktop}
                />
            )}

            <main className="main-content" style={{ padding: 0, marginTop: 0 }}>
                {error && (
                    <div className="topline" style={{ borderLeftColor: 'var(--accent-danger)', margin: '16px' }}>
                        <div className="topline__label" style={{ color: 'var(--accent-danger)' }}>Error</div>
                        <div className="topline__text">Failed to update weather. Showing cached data.</div>
                    </div>
                )}

                <WeatherLocationManager />

                {/* Only render WeatherCard if data is available */}
                {displayData ? (
                    <>
                        <DetailedWeatherCard
                            weatherData={displayData}
                            activeCity={activeCity}
                            setActiveCity={setActiveCity}
                        />
                        <WeatherCityComparison weatherData={displayData} cities={cities} />
                        <WeatherPlanningSummary
                            cityData={displayData[activeCity]}
                            cityName={activeCity}
                        />
                        <WeeklyWeatherForecast
                            forecast={displayData[activeCity]?.weeklyForecast}
                            cityName={activeCity}
                        />
                    </>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state__icon">☁️</div>
                        <p>Weather data unavailable.</p>
                        <button onClick={handleRefresh} className="btn btn--secondary mt-md">Retry</button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default WeatherPage;
