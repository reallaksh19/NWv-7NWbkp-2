import React from 'react';
import {
  formatRainPair,
  getWeatherCityRows,
  normalizeForecastRows,
} from '../../services/weatherDataAdapters.js';
import './WeeklyWeatherForecast.css';

function uvLabel(uv) {
  if (uv == null) return '—';
  if (uv >= 11) return 'Extreme';
  if (uv >= 8) return 'Very high';
  if (uv >= 6) return 'High';
  if (uv >= 3) return 'Moderate';
  return 'Low';
}

function renderForecastRows(forecast) {
  return normalizeForecastRows(forecast).map((day, index) => (
    <article key={day.date || day.label || index} className={`wwf-row ${index === 0 ? 'wwf-row--today' : ''}`}>
      <div className="wwf-main">
        <span className="wwf-day">{day.dayLabel || day.label}</span>
        <span className="wwf-condition">
          <span className="wwf-icon">{day.icon || '☁️'}</span>
          {day.condition || 'Forecast'}
        </span>
      </div>

      <div className="wwf-temp">
        <strong>{day.high != null ? `${day.high}°` : '—'}</strong>
        <span>{day.low != null ? `${day.low}°` : '—'}</span>
      </div>

      <div className="wwf-metric">
        <span>Rain</span>
        <strong>{formatRainPair(day)}</strong>
      </div>

      <div className="wwf-metric">
        <span>Feels</span>
        <strong>{day.realFeelDay != null ? `${day.realFeelDay}°` : '—'}</strong>
      </div>

      <div className="wwf-metric">
        <span>Humidity</span>
        <strong>{day.humidityDay != null ? `${day.humidityDay}%` : '—'}</strong>
      </div>

      <div className="wwf-metric">
        <span>UV / Wind</span>
        <strong>{uvLabel(day.uvIndex)}{day.windKph != null ? ` · ${day.windKph}km/h` : ''}</strong>
      </div>
    </article>
  ));
}

function ForecastCard({ forecast, cityName, sourceMode }) {
  const rows = normalizeForecastRows(forecast);
  if (rows.length === 0) return null;

  return (
    <section className="wwf-card" data-weekly-weather-forecast="available">
      <div className="wwf-header">
        <div>
          <span className="wwf-eyebrow">Weekly forecast</span>
          <h3>7-day outlook</h3>
        </div>
        <div className="wwf-badges">
          {cityName && <span className="wwf-city">{cityName}</span>}
          {sourceMode && <span className="wwf-source">{sourceMode}</span>}
        </div>
      </div>

      <div className="wwf-rows">
        {renderForecastRows(rows)}
      </div>
    </section>
  );
}

/**
 * Supports both:
 * - <WeeklyWeatherForecast forecast={cityForecast} cityName="Colombo" />
 * - <WeeklyWeatherForecast weatherData={displayData} settings={settings} />
 */
export default function WeeklyWeatherForecast({
  forecast = null,
  cityName = '',
  sourceMode = '',
  weatherData = null,
  settings = null,
  cities = null,
}) {
  if (Array.isArray(forecast)) {
    return <ForecastCard forecast={forecast} cityName={cityName} sourceMode={sourceMode} />;
  }

  const cityRows = getWeatherCityRows({
    weatherData: weatherData || {},
    settings: settings || {},
    cities,
  }).filter(row => row.forecast.length > 0);

  if (cityRows.length === 0) {
    return (
      <section className="wwf-card wwf-card--empty" data-weekly-weather-forecast="empty">
        <div className="wwf-header">
          <div>
            <span className="wwf-eyebrow">Weekly forecast</span>
            <h3>7-day outlook</h3>
          </div>
        </div>
        <p className="wwf-empty">Weekly forecast is updating.</p>
      </section>
    );
  }

  return (
    <div className="wwf-stack" data-weekly-weather-forecast="stack">
      {cityRows.map(row => (
        <ForecastCard
          key={row.city}
          forecast={row.forecast}
          cityName={row.cityName}
          sourceMode={row.sourceMode}
        />
      ))}
    </div>
  );
}
