import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  buildTravelLocationSettings,
  getTravelLocationOptions,
  getTravelLocationProfile,
} from '../../services/travelLocationProfile.js';
import './TravelLocationSettingsPanel.css';

export default function TravelLocationSettingsPanel() {
  const { settings, updateSettings } = useSettings();
  const profile = getTravelLocationProfile(settings);
  const options = getTravelLocationOptions();

  function updateTravelLocation(patch) {
    updateSettings(buildTravelLocationSettings(settings, patch));
  }

  return (
    <section className="travel-location-settings" data-travel-location-settings="true">
      <div className="travel-location-settings__copy">
        <span>Travel location</span>
        <h3>Prioritise local stories</h3>
        <p>
          Use this when travelling. Colombo accepts the common typo "Columbo" and uses Sri Lanka news edition.
        </p>
      </div>

      <div className="travel-location-settings__controls">
        <label>
          <span>Current travel city</span>
          <select
            value={profile.key}
            onChange={event => updateTravelLocation({
              city: event.target.value,
              enabled: true,
              prioritizeStories: true,
            })}
          >
            {options.map(option => (
              <option key={option.key} value={option.key}>
                {option.icon} {option.label} — {option.country}
              </option>
            ))}
          </select>
        </label>

        <label className="travel-location-settings__toggle">
          <input
            type="checkbox"
            checked={profile.prioritizeStories}
            onChange={event => updateTravelLocation({
              city: profile.key,
              enabled: true,
              prioritizeStories: event.target.checked,
            })}
          />
          <span>Boost local stories</span>
        </label>
      </div>

      <div className="travel-location-settings__status">
        <strong>{profile.icon} {profile.display}</strong>
        <span>{profile.countryLabel} · source: {profile.source}</span>
      </div>
    </section>
  );
}
