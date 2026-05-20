import React from 'react';
import { WEATHER_LOCATION_REGISTRY } from '../../services/weatherLocations.js';
import './WeatherCityComparison.css';

function displayName(city) {
    return WEATHER_LOCATION_REGISTRY[city]?.display || city.charAt(0).toUpperCase() + city.slice(1);
}

export default function WeatherCityComparison({ weatherData, cities }) {
    if (!weatherData || !cities || cities.length < 2) return null;
    const available = cities.filter(c => weatherData[c]?.current);
    if (available.length < 2) return null;

    return (
        <div className="wcc-card">
            <div className="wcc-header">Today's City Comparison</div>
            <div className="wcc-table-wrap">
                <table className="wcc-table">
                    <thead>
                        <tr>
                            <th>City</th>
                            <th>Now</th>
                            <th>High</th>
                            <th>Rain</th>
                            <th>UV</th>
                            <th>Wind</th>
                        </tr>
                    </thead>
                    <tbody>
                        {available.map(city => {
                            const cur = weatherData[city].current;
                            const today = weatherData[city].weeklyForecast?.[0];
                            return (
                                <tr key={city}>
                                    <td className="wcc-city">{displayName(city)}</td>
                                    <td>{cur.temp != null ? `${Math.round(cur.temp)}°` : '—'}</td>
                                    <td>{today?.tempMax != null ? `${today.tempMax}°` : '—'}</td>
                                    <td>{today?.precipProb != null ? `${today.precipProb}%` : '—'}</td>
                                    <td>{today?.uvMax ?? '—'}</td>
                                    <td>{today?.windMax != null ? `${today.windMax}` : '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
