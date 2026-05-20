import React from 'react';
import {
  buildNextRiskSummary,
  buildTomorrowChip,
  formatRainSignal,
} from '../../services/weatherInsights.js';
import './QuickWeatherSignalStrip.css';

function riskClass(level) {
  if (level === 'high') return 'qwss-chip--high';
  if (level === 'medium') return 'qwss-chip--medium';
  return 'qwss-chip--low';
}

function rainRiskLevel(probability, precipMm) {
  if (probability >= 70 || precipMm >= 10) return 'high';
  if (probability >= 35 || precipMm >= 1.5) return 'medium';
  return 'low';
}

function heatRiskLevel(temp) {
  if (temp >= 38) return 'high';
  if (temp >= 33) return 'medium';
  return 'low';
}

function uvRiskLevel(uv) {
  if (uv >= 10) return 'high';
  if (uv >= 7) return 'medium';
  return 'low';
}

function windRiskLevel(wind) {
  if (wind >= 40) return 'high';
  if (wind >= 25) return 'medium';
  return 'low';
}

export default function QuickWeatherSignalStrip({
  cityData,
  riskSummary,
  tomorrowChip,
}) {
  const resolvedRisk = riskSummary || buildNextRiskSummary(cityData);
  const resolvedTomorrow = tomorrowChip || buildTomorrowChip(cityData);

  if (!resolvedRisk && !resolvedTomorrow) return null;

  const signals = [];

  if (resolvedRisk) {
    const rain = Number(resolvedRisk.rain ?? 0);
    const precipMm = Number(resolvedRisk.precipMm ?? resolvedRisk.rainMm ?? 0);

    signals.push({
      key: 'rain',
      icon: '🌧',
      label: formatRainSignal(rain, precipMm),
      title: 'Rain probability · expected precipitation',
      level: rainRiskLevel(rain, precipMm),
    });

    if (resolvedRisk.heat != null) {
      signals.push({
        key: 'heat',
        icon: '🌡',
        label: `${Math.round(resolvedRisk.heat)}°`,
        title: 'Max temperature',
        level: heatRiskLevel(resolvedRisk.heat),
      });
    }

    if (resolvedRisk.uv != null) {
      signals.push({
        key: 'uv',
        icon: '☀',
        label: `UV ${Math.round(resolvedRisk.uv)}`,
        title: 'UV index',
        level: uvRiskLevel(resolvedRisk.uv),
      });
    }

    if (resolvedRisk.wind != null) {
      signals.push({
        key: 'wind',
        icon: '💨',
        label: `${Math.round(resolvedRisk.wind)}km/h`,
        title: 'Max wind',
        level: windRiskLevel(resolvedRisk.wind),
      });
    }

    if (resolvedRisk.humidity != null) {
      signals.push({
        key: 'humidity',
        icon: '💦',
        label: `${Math.round(resolvedRisk.humidity)}%`,
        title: 'Humidity',
        level: resolvedRisk.humidity >= 85 ? 'medium' : 'low',
      });
    }

    if (resolvedRisk.stable) {
      signals.push({
        key: 'stable',
        icon: '✅',
        label: 'Stable',
        title: 'No significant rain expected',
        level: 'low',
      });
    }
  }

  if (resolvedTomorrow) {
    const tempPart = resolvedTomorrow.tempMax != null
      ? `${Math.round(resolvedTomorrow.tempMax)}°`
      : resolvedTomorrow.temp != null
        ? `${Math.round(resolvedTomorrow.temp)}°`
        : resolvedTomorrow.condition;

    const rainPart = resolvedTomorrow.rainText ||
      formatRainSignal(resolvedTomorrow.rain ?? 0, resolvedTomorrow.precipMm ?? 0);

    signals.push({
      key: 'tomorrow',
      icon: '📅',
      label: `Tmr ${tempPart} · ${rainPart}`,
      title: `Tomorrow: ${resolvedTomorrow.condition || 'Forecast'}`,
      level: resolvedTomorrow.risk || 'low',
    });
  }

  if (signals.length === 0) return null;

  return (
    <div className="qwss-strip" data-quick-weather-signal-strip="professional">
      {signals.map(signal => (
        <span key={signal.key} className={`qwss-chip ${riskClass(signal.level)}`} title={signal.title}>
          <span className="qwss-chip__icon">{signal.icon}</span>
          <span className="qwss-chip__label">{signal.label}</span>
        </span>
      ))}
    </div>
  );
}
