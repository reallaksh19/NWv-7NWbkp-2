/* eslint-disable */
/**
 * Multi-Model Weather Service
 * Static-host safe: prefer fresh complete cache, then live Open-Meteo for built-in cities,
 * then snapshot/stale cache as fallback.
 */
import {
    calculateRainfallConsensus,
    averageTemperature,
    averageApparentTemperature,
    getMostCommonWeatherCode,
    averagePrecipitation,
    getSuccessfulModels,
    formatModelNames
} from '../utils/multiModelUtils.js';
import { getSettings } from '../utils/storage.js';
import logStore from '../utils/logStore.js';
import { getWeatherIconId } from '../utils/weatherUtils.js';
import { getRuntimeCapabilities } from "../runtime/runtimeCapabilities.js";

const MODELS = {
    ecmwf: 'https://api.open-meteo.com/v1/ecmwf',
    gfs: 'https://api.open-meteo.com/v1/gfs',
    icon: 'https://api.open-meteo.com/v1/dwd-icon'
};

import { WEATHER_LOCATION_REGISTRY, getWeatherLocationLabel } from './weatherLocations.js';

// Canonical built-in locations derived from the central registry
const LOCATIONS = Object.fromEntries(
    Object.entries(WEATHER_LOCATION_REGISTRY).map(([k, v]) => [k, { lat: v.lat, lon: v.lon }])
);

const WEATHER_CACHE_PREFIX = 'weather_cache_v2_';
const LEGACY_WEATHER_CACHE_PREFIX = 'weather_cache_';
const WEATHER_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

function isStaticHostRuntime() { return getRuntimeCapabilities().isStaticHost; }

function hasHourlyForecast(payload) {
    return Boolean(
        payload &&
        ((Array.isArray(payload.hourly24) && payload.hourly24.length > 0) ||
         (Array.isArray(payload.next8Hours) && payload.next8Hours.length > 0) ||
         (Array.isArray(payload.morning?.hourly) && payload.morning.hourly.length > 0) ||
         (Array.isArray(payload.noon?.hourly) && payload.noon.hourly.length > 0) ||
         (Array.isArray(payload.evening?.hourly) && payload.evening.hourly.length > 0))
    );
}

function publicDataUrl(path) {
    const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');
    return `${base}${String(path).replace(/^\//, '')}`;
}

async function fetchWeatherSnapshot(locationKey) {
  try {
    const resp = await fetch(publicDataUrl('data/weather_snapshot.json'), { cache: 'no-cache' });
    if (!resp.ok) return null;
    const snapshot = await resp.json();
    return snapshot?.[String(locationKey || '').toLowerCase()] || null;
  } catch {
    return null;
  }
}

function readCachedWeather(locationKey, allowStale = true) {
    try {
        const read = (prefix) => {
            const raw = localStorage.getItem(`${prefix}${locationKey}`);
            return raw ? JSON.parse(raw) : null;
        };
        const parsed = read(WEATHER_CACHE_PREFIX) || read(LEGACY_WEATHER_CACHE_PREFIX);
        if (!parsed) return null;
        const age = Date.now() - (parsed?.fetchedAt || 0);
        if (!allowStale && age > WEATHER_CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCachedWeather(locationKey, payload) {
    try {
        localStorage.setItem(`${WEATHER_CACHE_PREFIX}${locationKey}`, JSON.stringify(payload));
    } catch {
        // ignore
    }
}

async function resolveLocation(cityName) {
    const key = String(cityName || '').toLowerCase();
    if (LOCATIONS[key]) return LOCATIONS[key];
    try {
        const cache = JSON.parse(localStorage.getItem('weather_geo_cache') || '{}');
        if (cache[key]) return cache[key];
    } catch {
        // ignore
    }

    if (isStaticHostRuntime()) {
        throw new Error(`Location not found in static-host mode: ${cityName}`);
    }

    const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
    const data = await resp.json();
    if (data.results && data.results.length > 0) {
        const loc = { lat: data.results[0].latitude, lon: data.results[0].longitude };
        try {
            const cache = JSON.parse(localStorage.getItem('weather_geo_cache') || '{}');
            cache[key] = loc;
            localStorage.setItem('weather_geo_cache', JSON.stringify(cache));
        } catch {
            // ignore
        }
        return loc;
    }
    throw new Error(`Location not found: ${cityName}`);
}

async function fetchSingleModel(modelName, lat, lon) {
    const baseUrl = MODELS[modelName];
    if (!baseUrl) throw new Error(`Unknown model: ${modelName}`);
    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m',
        hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover,visibility,dew_point_2m',
        daily: 'precipitation_probability_max,precipitation_sum,uv_index_max,temperature_2m_max,temperature_2m_min,apparent_temperature_max,relative_humidity_2m_mean,weather_code,wind_speed_10m_max',
        forecast_days: '7',
        timezone: 'auto'
    });
    const response = await fetch(`${baseUrl}?${params}`);
    if (!response.ok) throw new Error(`${modelName.toUpperCase()} API request failed: ${response.status}`);
    return response.json();
}

export async function fetchWeather(locationKey) {
    const _t0 = Date.now();
    const key = String(locationKey || '').toLowerCase();
    const cacheFresh = readCachedWeather(key, false);

    // Fresh, complete cache is OK. Fresh legacy/static cache without hourly data should not
    // block a live refresh for built-in cities, because it causes home QuickWeather to show
    // "No forecast" permanently.
    if (cacheFresh && hasHourlyForecast(cacheFresh)) return { ...cacheFresh, sourceMode: 'cache' };
    if (cacheFresh && !LOCATIONS[key]) return { ...cacheFresh, sourceMode: 'cache' };

    if (isStaticHostRuntime() && !LOCATIONS[key]) {
        const cached = readCachedWeather(key, true);
        if (cached) return { ...cached, sourceMode: 'cache' };

        const snapshot = await fetchWeatherSnapshot(key);
        if (snapshot) return { ...snapshot, sourceMode: 'snapshot' };

        return null;
    }

    let lat, lon;
    try {
        const coords = await resolveLocation(key);
        lat = coords.lat;
        lon = coords.lon;
    } catch (e) {
        const cached = readCachedWeather(key, true);
        if (cached) return cached;
        throw new Error(`Unknown location: ${locationKey}`);
    }

    const settings = getSettings();
    const modelSettings = settings.weather?.models || { ecmwf: true, gfs: true, icon: true };
    const enabledModelNames = Object.keys(MODELS).filter(m => modelSettings[m] !== false);
    if (enabledModelNames.length === 0) enabledModelNames.push('ecmwf', 'gfs', 'icon');

    try {
        const results = await Promise.allSettled(enabledModelNames.map(model => fetchSingleModel(model, lat, lon)));
        const modelData = {};
        enabledModelNames.forEach((modelName, index) => {
            modelData[modelName] = results[index].status === 'fulfilled' ? results[index].value : null;
        });

        const successfulModels = getSuccessfulModels(modelData);
        if (successfulModels.length === 0) throw new Error('All weather models failed to fetch data');

        const processed = processMultiModelData(modelData, key);
        writeCachedWeather(key, processed);
        logStore.success('weather', `${key}: ${successfulModels.length}/${enabledModelNames.length} models OK`, { durationMs: Date.now() - _t0 });
        return processed;
    } catch (error) {
        const cached = readCachedWeather(key, true);
        if (cached && hasHourlyForecast(cached)) {
            return { ...cached, isStale: true };
        }

        const snapshot = await fetchWeatherSnapshot(key);
        if (snapshot) {
            return { ...snapshot, sourceMode: 'snapshot', isStale: true };
        }

        if (cached) {
            return { ...cached, isStale: true };
        }
        logStore.error('weather', `${key}: ${error.message}`, { durationMs: Date.now() - _t0 });
        throw error;
    }
}

function processMultiModelData(modelData, locationName) {
    const currentData = [modelData.ecmwf?.current, modelData.gfs?.current, modelData.icon?.current].filter(Boolean);
    const getIconForHour = (code, hour) => getWeatherIconId(code, hour ?? new Date().getHours());
    const getIcon = (code) => { if (code <= 1) return '☀️'; if (code <= 3) return '⛅'; if (code <= 67) return '🌧️'; if (code <= 99) return '⛈️'; return '❓'; };
    const conditionMap = { 0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light Drizzle', 61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 80: 'Rain Showers', 95: 'Thunderstorm' };
    const getCondition = (code) => conditionMap[code] || 'Unknown';

    const allModelHourlyData = [];
    if (modelData.ecmwf?.hourly) allModelHourlyData.push(modelData.ecmwf.hourly);
    if (modelData.gfs?.hourly) allModelHourlyData.push(modelData.gfs.hourly);
    if (modelData.icon?.hourly) allModelHourlyData.push(modelData.icon.hourly);

    const getHourConsensus = (hourIdx) => {
        const pts = allModelHourlyData.map(h => ({
            temperature_2m: h.temperature_2m?.[hourIdx],
            apparent_temperature: h.apparent_temperature?.[hourIdx],
            precipitation: h.precipitation?.[hourIdx],
            precipitation_probability: h.precipitation_probability?.[hourIdx],
            weather_code: h.weather_code?.[hourIdx],
            relative_humidity_2m: h.relative_humidity_2m?.[hourIdx],
            wind_speed_10m: h.wind_speed_10m?.[hourIdx],
            uv_index: h.uv_index?.[hourIdx],
            cloud_cover: h.cloud_cover?.[hourIdx]
        })).filter(d => d.temperature_2m != null);
        if (pts.length === 0) return null;
        return pts;
    };

    const formatHourLabel = (h) => {
        const hour = h % 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12} ${ampm}`;
    };

    const getSegmentMetrics = (startHour, endHour) => {
        const indices = [];
        for (let i = startHour; i <= endHour; i++) indices.push(i);

        const segmentTemps = []; const segmentApparent = []; const segmentPrecip = []; const segmentPrecipProb = []; const segmentWeatherCodes = []; const segmentHumidity = []; const segmentWindSpeed = []; const segmentUV = []; const segmentCloud = [];
        const hourlySlots = [];

        indices.forEach(hourIdx => {
            const hourData = getHourConsensus(hourIdx);
            if (!hourData) return;
            const avgTemp = averageTemperature(hourData);
            const avgApparent = averageApparentTemperature(hourData);
            const avgPrecip = averagePrecipitation(hourData);
            const weatherCode = getMostCommonWeatherCode(hourData);
            if (avgTemp !== null) segmentTemps.push(avgTemp);
            if (avgApparent !== null) segmentApparent.push(avgApparent);
            if (avgPrecip !== null) segmentPrecip.push(avgPrecip);
            if (weatherCode !== null) segmentWeatherCodes.push(weatherCode);
            hourData.forEach(d => {
                if (d.precipitation_probability != null) segmentPrecipProb.push({ precipitation_probability: d.precipitation_probability });
                if (d.relative_humidity_2m != null) segmentHumidity.push(d.relative_humidity_2m);
                if (d.wind_speed_10m != null) segmentWindSpeed.push(d.wind_speed_10m);
                if (d.uv_index != null) segmentUV.push(d.uv_index);
                if (d.cloud_cover != null) segmentCloud.push(d.cloud_cover);
            });
            if (avgTemp !== null) {
                const avgPrecipMm = parseFloat((hourData.reduce((s, d) => s + (d.precipitation || 0), 0) / hourData.length).toFixed(1));
                const avgProb = Math.round(hourData.reduce((s, d) => s + (d.precipitation_probability || 0), 0) / hourData.length);
                hourlySlots.push({
                    time: formatHourLabel(hourIdx),
                    label: formatHourLabel(hourIdx),
                    temp: avgTemp,
                    iconId: getIconForHour(weatherCode, hourIdx % 24),
                    icon: getIcon(weatherCode),
                    precip: avgPrecipMm,
                    prob: avgProb,
                    condition: getCondition(weatherCode)
                });
            }
        });

        const avgTemp = segmentTemps.length ? Math.round(segmentTemps.reduce((a, b) => a + b, 0) / segmentTemps.length) : null;
        const feelsLike = segmentApparent.length ? Math.round(segmentApparent.reduce((a, b) => a + b, 0) / segmentApparent.length) : avgTemp;
        const totalRainVal = segmentPrecip.reduce((a, b) => a + b, 0);
        const rainfallConsensus = calculateRainfallConsensus(segmentPrecipProb);
        const midCode = segmentWeatherCodes.length ? segmentWeatherCodes[Math.floor(segmentWeatherCodes.length / 2)] : 0;
        const midHour = Math.floor((startHour + endHour) / 2) % 24;

        return {
            temp: avgTemp,
            feelsLike,
            icon: getIcon(midCode),
            iconId: getIconForHour(midCode, midHour),
            rainMm: totalRainVal < 1.0 ? '-' : `${totalRainVal.toFixed(1)}mm`,
            rainProb: rainfallConsensus || { avg: 0, min: 0, max: 0, displayString: '~0%', isWideRange: false },
            humidity: segmentHumidity.length ? Math.round(segmentHumidity.reduce((a, b) => a + b, 0) / segmentHumidity.length) : null,
            windSpeed: segmentWindSpeed.length ? Math.round(segmentWindSpeed.reduce((a, b) => a + b, 0) / segmentWindSpeed.length) : null,
            uvIndex: segmentUV.length ? Math.max(...segmentUV) : null,
            cloudCover: segmentCloud.length ? Math.round(segmentCloud.reduce((a, b) => a + b, 0) / segmentCloud.length) : null,
            hourly: hourlySlots
        };
    };

    const getDaySegments = (dayOffset) => {
        const offset = dayOffset * 24;
        return { morning: getSegmentMetrics(6 + offset, 11 + offset), noon: getSegmentMetrics(12 + offset, 16 + offset), evening: getSegmentMetrics(17 + offset, 22 + offset) };
    };

    const today = getDaySegments(0);
    const tomorrow = getDaySegments(1);
    const currentTemp = averageTemperature(currentData);
    const currentFeelsLike = averageApparentTemperature(currentData);
    const currentWeatherCode = getMostCommonWeatherCode(currentData);
    const currentHumidity = currentData.length && currentData[0].relative_humidity_2m != null ? Math.round(currentData.reduce((sum, d) => sum + (d.relative_humidity_2m || 0), 0) / currentData.length) : null;
    const currentWindSpeed = currentData.length && currentData[0].wind_speed_10m != null ? Math.round(currentData.reduce((sum, d) => sum + (d.wind_speed_10m || 0), 0) / currentData.length) : null;
    const currentWindDirection = currentData.length && currentData[0].wind_direction_10m != null ? Math.round(currentData.reduce((sum, d) => sum + (d.wind_direction_10m || 0), 0) / currentData.length) : null;
    const dailyMaxPrecipProb = [modelData.ecmwf?.daily?.precipitation_probability_max?.[0], modelData.gfs?.daily?.precipitation_probability_max?.[0], modelData.icon?.daily?.precipitation_probability_max?.[0]].filter(v => v != null);
    const maxPrecipProb = dailyMaxPrecipProb.length ? Math.round(dailyMaxPrecipProb.reduce((a, b) => a + b, 0) / dailyMaxPrecipProb.length) : 0;
    const dailyPrecipSum = [modelData.ecmwf?.daily?.precipitation_sum?.[0], modelData.gfs?.daily?.precipitation_sum?.[0], modelData.icon?.daily?.precipitation_sum?.[0]].filter(v => v != null);
    const totalPrecip = dailyPrecipSum.length ? (dailyPrecipSum.reduce((a, b) => a + b, 0) / dailyPrecipSum.length).toFixed(1) : '0.0';
    const dailyUVMax = [modelData.ecmwf?.daily?.uv_index_max?.[0], modelData.gfs?.daily?.uv_index_max?.[0], modelData.icon?.daily?.uv_index_max?.[0]].filter(v => v != null);
    const maxUV = dailyUVMax.length ? Math.round(dailyUVMax.reduce((a, b) => a + b, 0) / dailyUVMax.length) : null;
    const successfulModels = getSuccessfulModels(modelData);

    const currentHourOfDay = new Date().getHours();
    const hourly24 = [];
    const next8Hours = [];
    for (let i = 0; i < 24; i++) {
        const hourIdx = currentHourOfDay + i;
        const hourData = getHourConsensus(hourIdx);
        if (!hourData) continue;
        const avgTemp = averageTemperature(hourData);
        if (avgTemp === null) continue;
        const weatherCode = getMostCommonWeatherCode(hourData);
        const avgPrecip = parseFloat((hourData.reduce((s, d) => s + (d.precipitation || 0), 0) / hourData.length).toFixed(1));
        const avgProb = Math.round(hourData.reduce((s, d) => s + (d.precipitation_probability || 0), 0) / hourData.length);
        const labelHour = hourIdx % 24;
        const slot = {
            label: i === 0 ? 'Now' : formatHourLabel(labelHour),
            time: i === 0 ? 'Now' : formatHourLabel(labelHour),
            temp: avgTemp,
            iconId: getIconForHour(weatherCode, labelHour),
            icon: getIcon(weatherCode),
            prob: avgProb,
            precip: avgPrecip,
            condition: getCondition(weatherCode)
        };
        hourly24.push(slot);
        if (i < 8) next8Hours.push(slot);
    }

    // Build 7-day weekly forecast consensus
    const weeklyForecast = buildDailyConsensus(modelData, getIcon, getCondition);

    const timezone = modelData.ecmwf?.timezone || modelData.gfs?.timezone || modelData.icon?.timezone || 'auto';

    return {
        name: getWeatherLocationLabel(locationName),
        icon: WEATHER_LOCATION_REGISTRY[locationName]?.icon || (locationName === 'muscat' ? '📍' : '🏛️'),
        fetchedAt: Date.now(),
        timezone,
        models: { successful: successfulModels, count: successfulModels.length, names: formatModelNames(successfulModels) },
        current: {
            temp: currentTemp,
            feelsLike: currentFeelsLike,
            high: null,
            low: null,
            condition: getCondition(currentWeatherCode),
            icon: getIcon(currentWeatherCode),
            iconId: getIconForHour(currentWeatherCode, new Date().getHours()),
            humidity: currentHumidity,
            windSpeed: currentWindSpeed,
            windDirection: currentWindDirection
        },
        morning: today.morning,
        noon: today.noon,
        evening: today.evening,
        tomorrow,
        hourly24,
        next8Hours,
        weeklyForecast,
        summary: parseFloat(totalPrecip) > 0
            ? `Rain ${maxPrecipProb}% · ${totalPrecip}mm · UV ${maxUV || 'N/A'}`
            : `Stable · UV ${maxUV || 'N/A'}`
    };
}

function buildDailyConsensus(modelData, getIcon, getCondition) {
    const days = [];
    for (let d = 0; d < 7; d++) {
        const tempMax = [
            modelData.ecmwf?.daily?.temperature_2m_max?.[d],
            modelData.gfs?.daily?.temperature_2m_max?.[d],
            modelData.icon?.daily?.temperature_2m_max?.[d],
        ].filter(v => v != null);
        const tempMin = [
            modelData.ecmwf?.daily?.temperature_2m_min?.[d],
            modelData.gfs?.daily?.temperature_2m_min?.[d],
            modelData.icon?.daily?.temperature_2m_min?.[d],
        ].filter(v => v != null);
        const precipProb = [
            modelData.ecmwf?.daily?.precipitation_probability_max?.[d],
            modelData.gfs?.daily?.precipitation_probability_max?.[d],
            modelData.icon?.daily?.precipitation_probability_max?.[d],
        ].filter(v => v != null);
        const precipSum = [
            modelData.ecmwf?.daily?.precipitation_sum?.[d],
            modelData.gfs?.daily?.precipitation_sum?.[d],
            modelData.icon?.daily?.precipitation_sum?.[d],
        ].filter(v => v != null);
        const uvMax = [
            modelData.ecmwf?.daily?.uv_index_max?.[d],
            modelData.gfs?.daily?.uv_index_max?.[d],
            modelData.icon?.daily?.uv_index_max?.[d],
        ].filter(v => v != null);
        const windMax = [
            modelData.ecmwf?.daily?.wind_speed_10m_max?.[d],
            modelData.gfs?.daily?.wind_speed_10m_max?.[d],
            modelData.icon?.daily?.wind_speed_10m_max?.[d],
        ].filter(v => v != null);
        const apparentMax = [
            modelData.ecmwf?.daily?.apparent_temperature_max?.[d],
            modelData.gfs?.daily?.apparent_temperature_max?.[d],
            modelData.icon?.daily?.apparent_temperature_max?.[d],
        ].filter(v => v != null);
        const humidityMean = [
            modelData.ecmwf?.daily?.relative_humidity_2m_mean?.[d],
            modelData.gfs?.daily?.relative_humidity_2m_mean?.[d],
            modelData.icon?.daily?.relative_humidity_2m_mean?.[d],
        ].filter(v => v != null);
        const weatherCodes = [
            modelData.ecmwf?.daily?.weather_code?.[d],
            modelData.gfs?.daily?.weather_code?.[d],
            modelData.icon?.daily?.weather_code?.[d],
        ].filter(v => v != null);

        const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
        const avgF = arr => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
        const code = weatherCodes.length ? weatherCodes[Math.floor(weatherCodes.length / 2)] : 0;

        // Determine day label
        const date = new Date();
        date.setDate(date.getDate() + d);
        const dayLabel = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toISOString().slice(0, 10);

        days.push({
            dayLabel,
            date: dateStr,
            tempMax: avg(tempMax),
            tempMin: avg(tempMin),
            high: avg(tempMax),
            low: avg(tempMin),
            precipProb: avg(precipProb),
            rainProb: avg(precipProb),
            rainfallProbability: avg(precipProb),
            precipSum: avgF(precipSum),
            rainMm: avgF(precipSum),
            rainfallMm: avgF(precipSum),
            realFeelDay: avg(apparentMax),
            feelsLikeDay: avg(apparentMax),
            humidityDay: avg(humidityMean),
            humidityMean: avg(humidityMean),
            uvMax: avg(uvMax),
            uvIndex: avg(uvMax),
            windMax: avg(windMax),
            weatherCode: code,
            icon: getIcon(code),
            condition: getCondition(code),
        });
    }
    return days;
}
