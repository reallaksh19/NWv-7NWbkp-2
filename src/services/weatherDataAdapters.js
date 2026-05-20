import {
  getConfiguredWeatherCities,
  getWeatherLocationLabel,
} from './weatherLocations.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstDefined(source, keys, fallback = null) {
  for (const key of keys) {
    if (source?.[key] != null) return source[key];
  }
  return fallback;
}

export function normalizeForecastDay(day = {}, index = 0) {
  const rainProb = asNumber(firstDefined(day, [
    'precipProb',
    'rainProb',
    'rainfallProbability',
    'pop',
    'prob',
  ], 0), 0);

  const rainMm = asNumber(firstDefined(day, [
    'precipSum',
    'rainMm',
    'rainfallMm',
    'precip',
    'precipitationMm',
  ], 0), 0);

  const high = asNumber(firstDefined(day, [
    'tempMax',
    'high',
    'maxTemp',
  ], null), null);

  const low = asNumber(firstDefined(day, [
    'tempMin',
    'low',
    'minTemp',
  ], null), null);

  const realFeelDay = asNumber(firstDefined(day, [
    'realFeelDay',
    'feelsLikeDay',
    'apparentMax',
    'apparent_temperature_max',
  ], null), null);

  const humidityDay = asNumber(firstDefined(day, [
    'humidityDay',
    'humidityMean',
    'relativeHumidity',
    'relative_humidity_2m_mean',
  ], null), null);

  const uvIndex = asNumber(firstDefined(day, [
    'uvMax',
    'uvIndex',
    'uv',
  ], null), null);

  const windKph = asNumber(firstDefined(day, [
    'windMax',
    'windKph',
    'windSpeed',
  ], null), null);

  return {
    ...day,
    date: day.date || '',
    label: day.dayLabel || day.label || (index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.date || 'Day ' + (index + 1)),
    dayLabel: day.dayLabel || day.label || (index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.date || 'Day ' + (index + 1)),
    condition: day.condition || 'Forecast',
    icon: day.icon || '☁️',
    iconId: day.iconId,
    high,
    low,
    tempMax: high,
    tempMin: low,
    rainProb,
    precipProb: rainProb,
    rainfallProbability: rainProb,
    rainMm,
    precipSum: rainMm,
    rainfallMm: rainMm,
    realFeelDay,
    feelsLikeDay: realFeelDay,
    humidityDay,
    humidityMean: humidityDay,
    uvIndex,
    uvMax: uvIndex,
    windKph,
    windMax: windKph,
  };
}

export function normalizeForecastRows(forecast) {
  return asArray(forecast)
    .slice(0, 7)
    .map((day, index) => normalizeForecastDay(day, index));
}

export function getCityForecast(cityData) {
  return normalizeForecastRows(
    cityData?.weeklyForecast ||
    cityData?.forecast ||
    cityData?.daily ||
    []
  );
}

export function getWeatherCityRows({ weatherData = {}, settings = {}, cities = null } = {}) {
  const configuredCities = Array.isArray(cities) && cities.length
    ? cities
    : getConfiguredWeatherCities(settings);

  return configuredCities.map(city => {
    const cityData = weatherData?.[city] || {};

    return {
      city,
      cityName: cityData.name || getWeatherLocationLabel(city),
      cityData,
      forecast: getCityForecast(cityData),
      sourceMode: cityData.sourceMode || 'unknown',
    };
  });
}

export function formatRainPair(day) {
  const normalized = normalizeForecastDay(day);
  return `${normalized.rainProb || 0}% · ${Number(normalized.rainMm || 0).toFixed(1)}mm`;
}
