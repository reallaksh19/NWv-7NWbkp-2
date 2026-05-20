import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('Weather professional theme certification', () => {
  const css = fs.readFileSync('src/styles/weatherProfessionalTheme.css', 'utf8');

  it('defines shared weather visual variables', () => {
    expect(css).toContain('--weather-card-bg');
    expect(css).toContain('--weather-card-border');
    expect(css).toContain('--weather-accent-text');
  });

  it('protects QuickWeather desktop visibility', () => {
    expect(css).toContain('.quick-weather-card');
    expect(css).toContain('visibility: visible');
    expect(css).toContain('@media (min-width: 900px)');
  });

  it('styles the item below QuickWeather professionally', () => {
    expect(css).toContain('.qw-highlight-text-container');
    expect(css).toContain('grid-template-columns: auto minmax(0, 1fr)');
    expect(css).toContain('linear-gradient');
  });

  it('styles weekly forecast and weather manager consistently', () => {
    expect(css).toContain('.wwf-card');
    expect(css).toContain('.wlm-collapsed');
    expect(css).toContain('.weather-city-comparison');
    expect(css).toContain('.weather-planning-summary');
  });

  it('includes mobile compact guards', () => {
    expect(css).toContain('@media (max-width: 680px)');
    expect(css).toContain('grid-template-columns: 1fr 1fr');
  });
});
