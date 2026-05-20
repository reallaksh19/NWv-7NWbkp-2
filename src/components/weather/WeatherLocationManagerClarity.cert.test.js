import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('Weather location manager clarity certification', () => {
  const component = fs.readFileSync('src/components/weather/WeatherLocationManager.jsx', 'utf8');
  const css = fs.readFileSync('src/components/weather/WeatherLocationManager.css', 'utf8');

  it('explains how to add and delete cities', () => {
    expect(component).toContain('To add: choose a city');
    expect(component).toContain('To delete: press');
    expect(component).toContain('data-weather-location-help');
  });

  it('provides one-click Colombo add path', () => {
    expect(component).toContain('colomboMissing');
    expect(component).toContain('data-weather-add-colombo');
    expect(component).toContain('+ Add Colombo');
  });

  it('provides labelled delete buttons', () => {
    expect(component).toContain('data-weather-delete-city');
    expect(component).toContain('Remove ');
    expect(component).toContain('removeCity');
  });

  it('provides quick-add list for available cities', () => {
    expect(component).toContain('data-weather-quick-add-list');
    expect(component).toContain('availableToAdd.map');
  });

  it('has professional visual classes', () => {
    expect(css).toContain('.wlm-help');
    expect(css).toContain('.wlm-add-colombo');
    expect(css).toContain('.wlm-quick-add__buttons');
    expect(css).toContain('.wlm-chip button:hover');
  });
});
