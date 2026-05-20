import React from 'react';
import { summarizeCityWeekly } from '../../services/weatherInsights.js';
import './WeatherPlanningSummary.css';

export default function WeatherPlanningSummary({ cityData, cityName }) {
    const summary = summarizeCityWeekly(cityData);
    if (!summary) return null;
    const { bestDay, rainiestDay, hottestDay, highestUvDay } = summary;
    return (
        <div className="wps-card">
            <div className="wps-header">
                <span className="wps-title">Week at a Glance</span>
                {cityName && <span className="wps-city">{cityName}</span>}
            </div>
            <div className="wps-grid">
                <div className="wps-item">
                    <span className="wps-badge wps-badge--best">Best</span>
                    <span className="wps-day">{bestDay.dayLabel}</span>
                    <span className="wps-detail">{bestDay.condition}</span>
                </div>
                <div className="wps-item">
                    <span className="wps-badge wps-badge--rain">Rainiest</span>
                    <span className="wps-day">{rainiestDay.dayLabel}</span>
                    <span className="wps-detail">{rainiestDay.precipProb}%</span>
                </div>
                <div className="wps-item">
                    <span className="wps-badge wps-badge--heat">Hottest</span>
                    <span className="wps-day">{hottestDay.dayLabel}</span>
                    <span className="wps-detail">{hottestDay.tempMax != null ? `${hottestDay.tempMax}°C` : '—'}</span>
                </div>
                <div className="wps-item">
                    <span className="wps-badge wps-badge--uv">High UV</span>
                    <span className="wps-day">{highestUvDay.dayLabel}</span>
                    <span className="wps-detail">UV {highestUvDay.uvMax ?? '—'}</span>
                </div>
            </div>
        </div>
    );
}
