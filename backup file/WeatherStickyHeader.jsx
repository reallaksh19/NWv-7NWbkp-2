import React, { useMemo } from 'react';
import { DataStatePill } from './Header';

const WeatherStickyHeader = ({ weatherData, activeCity, onRefresh, loading, isDesktop }) => {

    // Normalize city name
    const city = activeCity || Object.keys(weatherData)[0] || 'chennai';
    const cityData = weatherData[city] || weatherData[city.toLowerCase()];

    // Generate Quick Forecast Summary (Next 8 hours)
    const quickForecast = useMemo(() => {
        if (!cityData) return "Loading weather data...";

        const current = cityData.current || {};
        const next8Hours = cityData.next8Hours || [];
        const hourly24 = cityData.hourly24 || [];

        // 1. Get High Temp
        let highTemp = current.high;

        if (highTemp == null || highTemp === undefined) {
            if (hourly24.length > 0) {
                const maxHourly = Math.max(...hourly24.map(h => h.temp || -999));
                if (maxHourly !== -999) highTemp = maxHourly;
            }
        }

        const highDisplay = (highTemp !== null && highTemp !== undefined) ? `${highTemp}°` : '--';

        // 2. Determine "Useful Info" / Alert (Priority: Rain > Wind > Heat > Humidity)
        let usefulInfo = "";

        // Check for immediate rain (next 4 hours)
        const rainSoon = next8Hours.slice(0, 4).find(h => (h.precip > 0.5 || h.prob >= 40));

        if (rainSoon) {
            usefulInfo = `Rain likely at ${rainSoon.label}`;
        }
        else if (current.windSpeed > 25) {
            usefulInfo = `Windy (${current.windSpeed} km/h)`;
        }
        else if ((current.temp > 38) || (highTemp > 38)) {
            usefulInfo = "Heatwave Alert";
        }
        else if (current.humidity > 85 && current.temp > 30) {
            usefulInfo = "High Humidity";
        }
        // If it's raining now
        else if (current.condition && current.condition.toLowerCase().includes('rain')) {
             usefulInfo = "Raining Now";
        }

        // Base string: Condition • High X
        let baseString = `${current.condition || 'Clear'} • High ${highDisplay}`;

        // Append useful info if available
        if (usefulInfo) {
            return `${baseString} • ${usefulInfo}`;
        }

        return baseString;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cityData?.current, cityData]);

    return (
        <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'linear-gradient(to bottom, var(--bg-card), var(--bg-primary))',
            borderBottom: '1px solid var(--border-default)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
        }}>
            {/* Left: City & Forecast */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{
                        fontSize: '1.4rem',
                        margin: 0,
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'capitalize',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1
                    }}>
                        {city}
                    </h2>

                    {cityData?.sourceMode === 'snapshot' && (
                        <DataStatePill mode="snapshot" label="Degraded (Snapshot)" />
                    )}
                    {cityData?.sourceMode === 'cache' && (
                        <DataStatePill mode="cache" label="Cached Data" />
                    )}
                    {cityData?.sourceMode === 'live' && (
                        <DataStatePill mode="live" label="Live" />
                    )}

                    {loading && <span className="pulse-dot" style={{
                        width:'8px',
                        height:'8px',
                        borderRadius:'50%',
                        background:'var(--accent-primary)',
                        display: 'inline-block',
                        boxShadow: '0 0 10px var(--accent-primary)'
                    }}></span>}
                </div>
                <div style={{
                    fontSize: '0.95rem',
                    color: 'var(--accent-info)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: isDesktop ? 'auto' : '280px',
                    opacity: 0.9
                }}>
                    {quickForecast}
                </div>
            </div>

            {/* Right: Refresh Action */}
            <button
                onClick={onRefresh}
                style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    opacity: loading ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
                title="Refresh Weather"
            >
                <span style={{
                    display: 'block',
                    transform: loading ? 'rotate(360deg)' : 'none',
                    transition: 'transform 1s linear infinite',
                    fontSize: '18px'
                }}>
                    {loading ? '⟳' : '↻'}
                </span>
            </button>
        </div>
    );
};

export default WeatherStickyHeader;
