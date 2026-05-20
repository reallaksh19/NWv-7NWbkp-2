/**
 * Static file-existence and key-export test for Slice 59B.
 */
import { existsSync, readFileSync } from 'fs';

let pass = 0;
let fail = 0;

function check(label, cond) {
    if (cond) { console.log(`  ✓ ${label}`); pass++; }
    else       { console.error(`  ✗ ${label}`); fail++; }
}

function fc(path, str) {
    try { return readFileSync(path, 'utf8').includes(str); } catch { return false; }
}

console.log('Slice 59B – Weekly Forecast + Planning Cockpit Static Checks');

check('weatherInsights.js exists', existsSync('src/services/weatherInsights.js'));
check('QuickWeatherSignalStrip.jsx exists', existsSync('src/components/weather/QuickWeatherSignalStrip.jsx'));
check('QuickWeatherSignalStrip.css exists', existsSync('src/components/weather/QuickWeatherSignalStrip.css'));
check('WeeklyWeatherForecast.jsx exists', existsSync('src/components/weather/WeeklyWeatherForecast.jsx'));
check('WeeklyWeatherForecast.css exists', existsSync('src/components/weather/WeeklyWeatherForecast.css'));
check('WeatherCityComparison.jsx exists', existsSync('src/components/weather/WeatherCityComparison.jsx'));
check('WeatherCityComparison.css exists', existsSync('src/components/weather/WeatherCityComparison.css'));
check('WeatherPlanningSummary.jsx exists', existsSync('src/components/weather/WeatherPlanningSummary.jsx'));
check('WeatherPlanningSummary.css exists', existsSync('src/components/weather/WeatherPlanningSummary.css'));

// weatherInsights exports
check('buildNextRiskSummary exported', fc('src/services/weatherInsights.js', 'buildNextRiskSummary'));
check('buildTomorrowChip exported', fc('src/services/weatherInsights.js', 'buildTomorrowChip'));
check('buildOutdoorScore exported', fc('src/services/weatherInsights.js', 'buildOutdoorScore'));
check('summarizeCityWeekly exported', fc('src/services/weatherInsights.js', 'summarizeCityWeekly'));

// weatherService has weekly fields
check('weatherService requests weather_code daily', fc('src/services/weatherService.js', 'weather_code'));
check('weatherService requests wind_speed_10m_max', fc('src/services/weatherService.js', 'wind_speed_10m_max'));
check('weatherService returns weeklyForecast', fc('src/services/weatherService.js', 'weeklyForecast'));
check('weatherService returns timezone', fc('src/services/weatherService.js', 'timezone'));
check('weatherService has buildDailyConsensus', fc('src/services/weatherService.js', 'buildDailyConsensus'));

// QuickWeather uses signal strip
check('QuickWeather imports QuickWeatherSignalStrip', fc('src/components/QuickWeather.jsx', 'QuickWeatherSignalStrip'));
check('QuickWeather renders QuickWeatherSignalStrip', fc('src/components/QuickWeather.jsx', '<QuickWeatherSignalStrip'));

// WeatherPage uses all new components
check('WeatherPage imports WeeklyWeatherForecast', fc('src/pages/WeatherPage.jsx', 'WeeklyWeatherForecast'));
check('WeatherPage imports WeatherCityComparison', fc('src/pages/WeatherPage.jsx', 'WeatherCityComparison'));
check('WeatherPage imports WeatherPlanningSummary', fc('src/pages/WeatherPage.jsx', 'WeatherPlanningSummary'));
check('WeatherPage renders WeeklyWeatherForecast', fc('src/pages/WeatherPage.jsx', '<WeeklyWeatherForecast'));
check('WeatherPage renders WeatherCityComparison', fc('src/pages/WeatherPage.jsx', '<WeatherCityComparison'));
check('WeatherPage renders WeatherPlanningSummary', fc('src/pages/WeatherPage.jsx', '<WeatherPlanningSummary'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
