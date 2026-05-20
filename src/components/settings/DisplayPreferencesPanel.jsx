import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  buildDisplaySettings,
  shouldShowOnThisDay,
} from '../../services/displayPreferences.js';
import './DisplayPreferencesPanel.css';

export default function DisplayPreferencesPanel() {
  const { settings, updateSettings } = useSettings();
  const showOnThisDay = shouldShowOnThisDay(settings);

  return (
    <section className="display-preferences-panel" data-display-preferences-panel="true">
      <div className="display-preferences-panel__copy">
        <span className="display-preferences-panel__eyebrow">Home display</span>
        <h3>Optional widgets</h3>
        <p>
          “On This Day” is hidden by default on mobile and desktop. Turn it on only when you want it in the feed.
        </p>
      </div>

      <label className="display-preferences-panel__toggle">
        <input
          type="checkbox"
          checked={showOnThisDay}
          onChange={event => updateSettings(buildDisplaySettings(settings, {
            showOnThisDay: event.target.checked,
          }))}
        />
        <span>
          <strong>Show “On This Day”</strong>
          <em>{showOnThisDay ? 'Enabled' : 'Off by default'}</em>
        </span>
      </label>
    </section>
  );
}
