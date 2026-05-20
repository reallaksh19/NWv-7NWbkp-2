import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPLAY_PREFERENCES,
  buildDisplaySettings,
  getDisplayPreferences,
  shouldShowOnThisDay,
} from './displayPreferences';

describe('Display preferences certification', () => {
  it('keeps On This Day off by default', () => {
    expect(DEFAULT_DISPLAY_PREFERENCES.showOnThisDay).toBe(false);
    expect(shouldShowOnThisDay({})).toBe(false);
  });

  it('allows On This Day to be explicitly enabled', () => {
    expect(shouldShowOnThisDay({ display: { showOnThisDay: true } })).toBe(true);
  });

  it('builds display settings without dropping existing settings', () => {
    const next = buildDisplaySettings(
      { theme: 'dark', display: { other: true } },
      { showOnThisDay: true }
    );

    expect(next.theme).toBe('dark');
    expect(next.display.other).toBe(true);
    expect(next.display.showOnThisDay).toBe(true);
  });

  it('fills missing defaults', () => {
    expect(getDisplayPreferences({}).showOnThisDay).toBe(false);
  });
});
