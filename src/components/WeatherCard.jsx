/* eslint-disable */
import React, { useState } from 'react';
import { getWeatherTimeBlocks } from '../utils/timeSegment';
import { getRainStatus, getRainStyle } from '../utils/weatherUtils';
import WeatherIcon from './WeatherIcons';
import RainModal from './RainModal';
import { RainIntensityIcon, HumidityIcon } from './AppIcons';

/**
 * Weather Card Component
 * Revamped for responsive design: Matrix on Desktop, List on Mobile
 */
function WeatherCard({ weatherData, isDesktop }) {
    const [modalData, setModalData] = useState(null); // { city, period, hourlyData }
    const timeBlocks = getWeatherTimeBlocks();
    const cities = ['chennai', 'trichy', 'muscat'];

    // Get UV index color class
    const getUVClass = (uvIndex) => {
        if (uvIndex == null) return '';
        if (uvIndex <= 2) return 'uv-low';
        if (uvIndex <= 5) return 'uv-moderate';
        if (uvIndex <= 7) return 'uv-high';
        if (uvIndex <= 10) return 'uv-very-high';
        return 'uv-extreme';
    };

    const handleRainClick = (city, period, hourly) => {
        if (hourly && hourly.length > 0) {
            setModalData({ city, period, hourlyData: hourly });
        }
    };

    // --- RENDERERS ---

    const renderDesktopGrid = () => (
        <div className="card" style={{ padding: 0, overflow: 'visible', background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <div className="weather-grid" style={{ borderRadius: 0, background: 'transparent', gap: '1px' }}>
                {/* Time Block Rows */}
                {timeBlocks.map((block, idx) => (
                    <React.Fragment key={idx}>
                        <div className="weather-grid__time" style={{
                            background: 'var(--bg-secondary)',
                            borderRight: '1px solid var(--border-default)',
                            borderBottom: '1px solid var(--border-default)'
                        }}>
                            <span>{block.label}</span>
                            <span className="weather-grid__time-label">{block.sublabel}</span>
                        </div>

                        {cities.map(city => {
                            const isTomorrow = block.sublabel === 'Tmrw' || block.sublabel === 'Tomorrow';
                            const cityData = weatherData[city];
                            const data = isTomorrow
                                ? cityData?.tomorrow?.[block.period]
                                : cityData?.[block.period];

                            if (!data) return <div key={city} className="weather-grid__cell" style={{ background: 'var(--bg-card)' }}><span style={{ color: 'var(--text-muted)' }}>N/A</span></div>;

                            return renderWeatherCell(city, block, data);
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );

    const renderWeatherCell = (city, block, data) => {
        const rainMm = parseFloat(data.rainMm || 0);
        const rainProbAvg = data.rainProb?.avg || 0;
        const rainProbRange = (data.rainProb?.min !== undefined && data.rainProb?.max !== undefined && (data.rainProb.max - data.rainProb.min > 10))
            ? `${data.rainProb.min}-${data.rainProb.max}%`
            : `${rainProbAvg}%`;

        const showRainButton = rainMm >= 5;

        return (
            <div key={city} className="weather-grid__cell" style={{
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-default)',
                position: 'relative',
                padding: '12px 8px'
            }}>
                {/* Icon & Temp Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div className="weather-icon" style={{ fontSize: '1.8rem', margin: 0 }}>
                        {data.iconId ? <WeatherIcon id={data.iconId} size={32} /> : data.icon}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div className="weather-temp" style={{ fontSize: '1.4rem' }}>{data.temp}°</div>
                        <div className="weather-feels">Feels {data.feelsLike}°</div>
                    </div>
                </div>

                {/* Rain Button or Text */}
                <div style={{ minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', width: '100%' }}>
                    {showRainButton ? (
                        <button
                            onClick={() => handleRainClick(city, block.label, data.hourly)}
                            className="rain-btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'var(--bg-secondary)', border: '1px solid var(--weather-rain)',
                                borderRadius: '16px', padding: '4px 12px', color: 'var(--weather-rain)',
                                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            <RainIntensityIcon intensity="moderate" size={16} />
                            {rainMm.toFixed(1)}mm
                        </button>
                    ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {rainProbAvg > 20 ? (
                                <>
                                    <span style={{ color: 'var(--weather-rain)', fontWeight: 500 }}>
                                        {rainMm > 0 ? `${rainMm.toFixed(1)}mm` : 'Chance'}
                                    </span>
                                    <span style={{ fontSize: '0.7rem' }}>{rainProbRange}</span>
                                </>
                            ) : (
                                <span style={{ opacity: 0.5 }}>-</span>
                            )}
                        </div>
                    )}
                </div>
                 {/* Variation Warning */}
                {data.probSpread > 20 && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--accent-warning)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⚠️ High Variation
                    </div>
                )}
                {/* Metrics Grid */}
                <div className="weather-extra-metrics weather-metrics-grid" style={{ width: '100%', opacity: 0.8 }}>
                    <div className="weather-metric"><HumidityIcon size={16} /> {data.humidity ?? '-'}%</div>
                    <div className="weather-metric">🌬️ {data.windSpeed ?? '-'}</div>
                    <div className={`weather-metric ${getUVClass(data.uvIndex)}`}>☀️ UV {data.uvIndex ?? '-'}</div>
                    <div className="weather-metric">☁️ {data.cloudCover ?? '-'}%</div>
                </div>
            </div>
        );
    };

    const renderMobileList = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            {cities.map(city => {
                const current = weatherData[city]?.current || {};

                return (
                    <div key={city} style={{
                        background: 'var(--bg-card)',
                        borderRadius: '16px',
                        padding: '16px',
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid var(--border-default)'
                    }}>
                        {/* Header: City & Current */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0, textTransform: 'capitalize', fontSize: '1.2rem' }}>{city}</h3>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Feels like {current.feelsLike}°
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '2.5rem' }}>{weatherData[city]?.icon || current.icon}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{current.temp}°</div>
                            </div>
                        </div>

                        {/* Timeline Scroll */}
                        <div className="hide-scrollbar" style={{
                            display: 'flex',
                            gap: '12px',
                            overflowX: 'auto',
                            paddingBottom: '8px',
                            margin: '0 -8px',
                            padding: '0 8px'
                        }}>
                            {timeBlocks.map((block, idx) => {
                                const isTomorrow = block.sublabel === 'Tmrw' || block.sublabel === 'Tomorrow';
                                const cityData = weatherData[city];
                                const data = isTomorrow
                                    ? cityData?.tomorrow?.[block.period]
                                    : cityData?.[block.period];

                                if (!data) return null;

                                const rainMm = parseFloat(data.rainMm || 0);
                                const showRain = rainMm > 0 || (data.rainProb?.avg || 0) > 20;

                                return (
                                    <div key={idx} style={{
                                        flex: '0 0 auto',
                                        width: '80px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '12px',
                                        padding: '12px 8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            {block.label.split(' ')[0]} {/* Morn/Aft */}
                                        </div>

                                        <div style={{ margin: '4px 0' }}>
                                             {data.iconId ? <WeatherIcon id={data.iconId} size={36} /> : <span style={{fontSize: '1.8rem'}}>{data.icon}</span>}
                                        </div>

                                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                                            {data.temp}°
                                        </div>

                                        {showRain && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--weather-rain)', marginTop: '4px', fontWeight: 500 }}>
                                                {rainMm > 0 ? `${rainMm}mm` : `${data.rainProb?.avg}%`}
                                            </div>
                                        )}
                                        {!showRain && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                --
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <section className="weather-section" style={{ marginTop: 0 }}>
            {modalData && (
                <RainModal
                    city={modalData.city}
                    period={modalData.period}
                    hourlyData={modalData.hourlyData}
                    onClose={() => setModalData(null)}
                />
            )}

            {isDesktop ? renderDesktopGrid() : renderMobileList()}
        </section>
    );
}

export default WeatherCard;
