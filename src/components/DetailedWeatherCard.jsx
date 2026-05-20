
import React, { useState } from 'react';
import './DetailedWeatherCard.css';
import WeatherIcon from './WeatherIcons';
import { UmbrellaIcon, CloudIcon, HumidityIcon, WindIcon } from './AppIcons';
import { useSettings } from '../context/SettingsContext';

export default function DetailedWeatherCard({ weatherData, activeCity, setActiveCity }) {
    const { settings } = useSettings();
    const cities = (settings.weather?.cities || ['chennai', 'trichy', 'muscat']).map(c => c.toLowerCase());

    const cityLabels = cities.reduce((acc, city) => {
        acc[city] = city
            .split(/\s+/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        return acc;
    }, {
        chennai: 'Chennai',
        trichy: 'Trichy',
        muscat: 'Muscat'
    });

    const cityIcons = cities.reduce((acc, city) => {
        acc[city] = acc[city] || '📍';
        return acc;
    }, {
        chennai: '🏛️',
        trichy: '🏯',
        muscat: '📍'
    });

    const [expandedCard, setExpandedCard] = useState(null);

    const handleTravelAwareCityChange = (city) => {
        setActiveCity(city);
        try {
            localStorage.setItem('weather_active_city', city);
        } catch {
            // Ignore storage write failures.
        }
    };

    if (!weatherData) return null;
    const cityData = weatherData[activeCity] || weatherData['chennai'];

    if (!cityData) return <div className="dw-container">Data unavailable</div>;

    const hour = new Date().getHours();
    let segments = [];

    const getSeg = (day, period, labelOverride = null) => {
        const data = day === 'today' ? cityData[period] : cityData.tomorrow?.[period];

        let label = labelOverride;
        if (!label) {
            if (period === 'morning') label = 'Morning';
            else if (period === 'noon') label = 'Afternoon';
            else label = 'Evening';

            if (day === 'tomorrow') label = 'Tomorrow ' + label;
        }

        return {
            id: `${day}-${period}`,
            label,
            data
        };
    };

    if (hour < 11) {
        segments = [getSeg('today', 'morning', 'This Morning'), getSeg('today', 'noon'), getSeg('today', 'evening')];
    } else if (hour < 17) {
        segments = [getSeg('today', 'noon', 'This Afternoon'), getSeg('today', 'evening'), getSeg('tomorrow', 'morning')];
    } else if (hour < 21) {
        segments = [getSeg('today', 'evening', 'Tonight'), getSeg('tomorrow', 'morning'), getSeg('tomorrow', 'noon')];
    } else {
        segments = [getSeg('tomorrow', 'morning', 'Tomorrow Morning'), getSeg('tomorrow', 'noon'), getSeg('tomorrow', 'evening')];
    }

    return (
        <div className="dw-container">
            <div className="dw-sidebar">
                {cities.map(city => (
                    <button
                        key={city}
                        className={`dw-city-tab ${city === activeCity ? 'active' : ''}`}
                        onClick={() => handleTravelAwareCityChange(city)}
                        aria-label={`Select ${cityLabels[city]}`}
                    >
                        <span className="dw-city-icon">{cityIcons[city] || '📍'}</span>
                        <span className="dw-city-name">{cityLabels[city] || city}</span>
                    </button>
                ))}
            </div>

            <div className="dw-content">
                <div className="dw-header">
                    <div className="dw-header-main">
                        <h2 className="dw-city-title">{cityData.name}</h2>
                        <span className="dw-current-temp">{cityData.current?.temp}°</span>
                    </div>
                    <div className="dw-header-sub">
                        {cityData.summary}
                    </div>
                </div>

                <div className="dw-cards-list">
                    {segments.map((seg, idx) => {
                        if (!seg.data) return null;
                        return (
                            <WeatherSegmentCard
                                key={seg.id}
                                segment={seg}
                                isExpanded={expandedCard === idx}
                                onToggle={() => setExpandedCard(expandedCard === idx ? null : idx)}
                            />
                        );
                    })}
                </div>

                <div className="dw-footer">
                    {cityData.models?.count
                        ? `Forecast based on ${cityData.models.count} model${cityData.models.count !== 1 ? 's' : ''}: ${cityData.models.names}`
                        : 'Forecast based on ECMWF · GFS · DWD-ICON'}
                </div>
            </div>
        </div>
    );
}

function WeatherSegmentCard({ segment, isExpanded, onToggle }) {
    const { label, data } = segment;
    const hourly = Array.isArray(data.hourly) ? data.hourly : [];
    const hasHourly = hourly.length > 0;

    const rainMmVal = parseFloat(data.rainMm === '-' ? 0 : data.rainMm);
    const rainProbVal = data.rainProb?.avg || 0;
    const hasSignificantRain = rainMmVal >= 1.0;
    const hasAnyRain = rainMmVal > 0 || rainProbVal > 0;

    let RainIcon = CloudIcon;
    let rainColor = 'var(--text-secondary)';
    let rainText = 'No significant rain';

    if (hasAnyRain) {
        if (hasSignificantRain) {
            RainIcon = UmbrellaIcon;
            rainColor = '#3b82f6';
        } else {
            RainIcon = CloudIcon;
            rainColor = '#94a3b8';
        }

        rainText = `${rainMmVal > 0 ? rainMmVal.toFixed(1) + 'mm' : 'Trace'} (${rainProbVal}%)`;
    }

    const description = getConditionText(data);

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
        }
    };

    return (
        <div
            className={`dw-card ${isExpanded ? 'expanded' : ''}`}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label={`${label}. ${hasHourly ? 'Toggle hourly forecast' : 'Hourly forecast unavailable'}`}
            onClick={onToggle}
            onKeyDown={handleKeyDown}
        >
            <div className="dw-card-header">
                <span className="dw-period-badge">{label}</span>
                <span className={`dw-expand-hint ${hasHourly ? '' : 'dw-expand-hint--disabled'}`}>
                    {isExpanded ? 'Collapse hourly' : hasHourly ? 'View hourly' : 'Hourly unavailable'}
                </span>
            </div>

            <div className="dw-card-main">
                <div className="dw-main-icon">
                    {data.iconId ? <WeatherIcon id={data.iconId} size={56} /> : <span style={{fontSize:'3rem'}}>{data.icon}</span>}
                </div>
                <div className="dw-main-temp">
                    <div className="dw-temp-val">{data.temp}°</div>
                    <div className="dw-temp-feels">Feels like {data.feelsLike}°</div>
                </div>
            </div>

            <div className="dw-details-grid">
                <div className="dw-detail-row">
                    <div className="dw-detail-icon">
                        <RainIcon size={20} color={rainColor} />
                    </div>
                    <div className="dw-detail-text">
                        {rainText}
                    </div>
                </div>

                <div className="dw-detail-row">
                    <div className="dw-detail-icon"><HumidityIcon size={20} /></div>
                    <div className="dw-detail-text">
                        {data.humidity}% <span className="dw-sep">|</span> <WindIcon size={16} /> {data.windSpeed} km/h
                    </div>
                </div>

                <div className="dw-detail-row">
                    <div className="dw-detail-icon">☀️</div>
                    <div className="dw-detail-text">
                        UV: {data.uvIndex || '-'} <span className="dw-sep">|</span> PM 2.5: -
                    </div>
                </div>

                <div className="dw-detail-row">
                    <div className="dw-detail-icon">ℹ️</div>
                    <div className="dw-detail-text dw-desc">
                        {description}
                    </div>
                </div>
            </div>

            {isExpanded && hasHourly && (
                <div className="dw-hourly-container hide-scrollbar" onClick={(e) => e.stopPropagation()}>
                    {hourly.map((h, i) => (
                        <div key={i} className="dw-hourly-slot">
                            <span className="dw-slot-time">{h.time || h.label}</span>
                            <div className="dw-slot-icon">
                                {h.iconId ? <WeatherIcon id={h.iconId} size={28} /> : h.icon}
                            </div>
                            <strong className="dw-slot-temp">{h.temp}°</strong>
                            {h.precip > 0 && (
                                <span className="dw-slot-precip">
                                    {h.precip >= 1 && <span style={{fontSize:'0.7rem'}}>☂️</span>}
                                    {h.precip}mm
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function getConditionText(data) {
    const parts = [];
    if (data.rainProb?.avg > 40) parts.push("Rain expected.");
    else if (data.cloudCover > 70) parts.push("Cloudy.");
    else if (data.cloudCover < 20) parts.push("Clear skies.");

    if (data.windSpeed > 20) parts.push("Breezy.");
    if (data.uvIndex > 8) parts.push("High UV.");

    if (parts.length === 0) return "Pleasant conditions.";
    return parts.join(" ");
}
