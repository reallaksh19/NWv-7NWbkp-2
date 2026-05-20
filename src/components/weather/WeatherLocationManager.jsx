import React, { useMemo, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  DEFAULT_WEATHER_CITIES,
  WEATHER_LOCATION_REGISTRY,
  buildWeatherSettingsWithCities,
  getConfiguredWeatherCities,
  getWeatherLocationOptions,
  resolveRegistryKey,
} from '../../services/weatherLocations.js';
import './WeatherLocationManager.css';

function cityDisplay(city) {
  return WEATHER_LOCATION_REGISTRY[city]?.display || city;
}

function cityIcon(city) {
  return WEATHER_LOCATION_REGISTRY[city]?.icon || '📍';
}

export default function WeatherLocationManager({ compact = false }) {
  const { settings, updateSettings } = useSettings();
  const cities = getConfiguredWeatherCities(settings);
  const options = useMemo(() => getWeatherLocationOptions(), []);
  const [inputValue, setInputValue] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const availableToAdd = options.filter(option => !cities.includes(option.key));
  const colomboMissing = !cities.includes('colombo');

  function save(nextCities) {
    updateSettings(buildWeatherSettingsWithCities(settings, nextCities));
  }

  function addCity(cityValue = inputValue) {
    const canonical = resolveRegistryKey(cityValue);

    if (!canonical) {
      setMessage('Select a supported city from the list, then press Add.');
      return;
    }

    if (cities.includes(canonical)) {
      setMessage(cityDisplay(canonical) + ' is already in your weather list.');
      return;
    }

    save([...cities, canonical]);
    setInputValue('');
    setMessage(cityDisplay(canonical) + ' added.');
  }

  function removeCity(city) {
    if (cities.length <= 1) {
      setMessage('At least one weather city must remain.');
      return;
    }

    save(cities.filter(item => item !== city));
    setMessage(cityDisplay(city) + ' removed.');
  }

  function resetToDefaults() {
    save([...DEFAULT_WEATHER_CITIES]);
    setMessage('Reset to Chennai, Trichy, Muscat and Colombo.');
  }

  if (!open) {
    return (
      <section className={`wlm-collapsed ${compact ? 'wlm-collapsed--compact' : ''}`} data-weather-location-manager="collapsed">
        <div className="wlm-collapsed__copy">
          <strong>Weather locations</strong>
          <span>{cities.length} selected · {cities.map(cityDisplay).join(' · ')}</span>
        </div>

        <div className="wlm-collapsed__actions">
          {colomboMissing && (
            <button
              className="wlm-add-colombo"
              type="button"
              onClick={() => {
                addCity('colombo');
                setOpen(true);
              }}
              data-weather-add-colombo="true"
            >
              + Colombo
            </button>
          )}

          <button className="wlm-toggle" type="button" onClick={() => setOpen(true)}>
            Manage
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`wlm-panel ${compact ? 'wlm-panel--compact' : ''}`} data-weather-location-manager="open">
      <div className="wlm-header">
        <div>
          <span className="wlm-eyebrow">Weather locations</span>
          <h3>Add / delete locations</h3>
          <p>
            To add: choose a city and press <strong>Add</strong>. To delete: press the <strong>×</strong> beside that city.
          </p>
        </div>

        <button className="wlm-toggle wlm-close" type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>

      <div className="wlm-help" data-weather-location-help="true">
        <span>Supported now: Chennai, Trichy, Muscat, Colombo.</span>
        {colomboMissing ? (
          <button type="button" onClick={() => addCity('colombo')} data-weather-add-colombo="true">
            + Add Colombo
          </button>
        ) : (
          <strong>Colombo is already added.</strong>
        )}
      </div>

      <div className="wlm-current">
        <span className="wlm-section-label">Selected cities</span>
        <div className="wlm-chip-row">
          {cities.map(city => (
            <span key={city} className="wlm-chip">
              <span>{cityIcon(city)} {cityDisplay(city)}</span>
              <button
                type="button"
                onClick={() => removeCity(city)}
                disabled={cities.length <= 1}
                aria-label={'Remove ' + cityDisplay(city)}
                title={'Remove ' + cityDisplay(city)}
                data-weather-delete-city={city}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="wlm-add-row">
        <select
          className="wlm-select"
          value={inputValue}
          onChange={event => {
            setInputValue(event.target.value);
            setMessage('');
          }}
          aria-label="Select weather city to add"
        >
          <option value="">Select city to add…</option>
          {availableToAdd.map(option => (
            <option key={option.key} value={option.key}>
              {option.label} — {option.country}
            </option>
          ))}
        </select>

        <button className="wlm-add-btn" type="button" onClick={() => addCity()} disabled={!inputValue}>
          Add
        </button>
      </div>

      {availableToAdd.length > 0 && (
        <div className="wlm-quick-add" data-weather-quick-add-list="true">
          <span className="wlm-section-label">Quick add</span>
          <div className="wlm-quick-add__buttons">
            {availableToAdd.map(option => (
              <button key={option.key} type="button" onClick={() => addCity(option.key)}>
                + {option.icon} {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wlm-footer">
        <button className="wlm-reset" type="button" onClick={resetToDefaults}>
          Reset defaults
        </button>
        {message && <span className="wlm-message" role="status">{message}</span>}
      </div>
    </section>
  );
}
