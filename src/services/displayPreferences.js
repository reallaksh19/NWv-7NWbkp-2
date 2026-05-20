export const DEFAULT_DISPLAY_PREFERENCES = {
  showOnThisDay: false,
};

export function getDisplayPreferences(settings = {}) {
  return {
    ...DEFAULT_DISPLAY_PREFERENCES,
    ...(settings.display || {}),
  };
}

export function shouldShowOnThisDay(settings = {}) {
  return getDisplayPreferences(settings).showOnThisDay === true;
}

export function buildDisplaySettings(baseSettings = {}, patch = {}) {
  return {
    ...baseSettings,
    display: {
      ...DEFAULT_DISPLAY_PREFERENCES,
      ...(baseSettings.display || {}),
      ...patch,
    },
  };
}
