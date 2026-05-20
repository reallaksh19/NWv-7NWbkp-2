/**
 * Static file-existence and key-export test for Slice 59A.
 */
import { existsSync } from 'fs';
import { readFileSync } from 'fs';

let pass = 0;
let fail = 0;

function check(label, cond) {
    if (cond) { console.log(`  ✓ ${label}`); pass++; }
    else       { console.error(`  ✗ ${label}`); fail++; }
}

function fileContains(path, str) {
    try { return readFileSync(path, 'utf8').includes(str); } catch { return false; }
}

console.log('Slice 59A – Weather Location Customization Static Checks');

// Files exist
check('weatherLocations.js exists', existsSync('src/services/weatherLocations.js'));
check('WeatherLocationManager.jsx exists', existsSync('src/components/weather/WeatherLocationManager.jsx'));
check('WeatherLocationManager.css exists', existsSync('src/components/weather/WeatherLocationManager.css'));

// weatherLocations.js exports
check('DEFAULT_WEATHER_CITIES exported', fileContains('src/services/weatherLocations.js', 'DEFAULT_WEATHER_CITIES'));
check('colombo in defaults', fileContains('src/services/weatherLocations.js', 'colombo'));
check('WEATHER_LOCATION_REGISTRY exported', fileContains('src/services/weatherLocations.js', 'WEATHER_LOCATION_REGISTRY'));
check('getConfiguredWeatherCities exported', fileContains('src/services/weatherLocations.js', 'getConfiguredWeatherCities'));
check('buildWeatherSettingsWithCities exported', fileContains('src/services/weatherLocations.js', 'buildWeatherSettingsWithCities'));
check('resolveRegistryKey exported', fileContains('src/services/weatherLocations.js', 'resolveRegistryKey'));

// weatherService.js imports registry
check('weatherService imports WEATHER_LOCATION_REGISTRY', fileContains('src/services/weatherService.js', 'WEATHER_LOCATION_REGISTRY'));

// WeatherContext uses getConfiguredWeatherCities
check('WeatherContext uses getConfiguredWeatherCities', fileContains('src/context/WeatherContext.jsx', 'getConfiguredWeatherCities'));

// WeatherPage uses getConfiguredWeatherCities and WeatherLocationManager
check('WeatherPage uses getConfiguredWeatherCities', fileContains('src/pages/WeatherPage.jsx', 'getConfiguredWeatherCities'));
check('WeatherPage imports WeatherLocationManager', fileContains('src/pages/WeatherPage.jsx', 'WeatherLocationManager'));
check('WeatherPage renders WeatherLocationManager', fileContains('src/pages/WeatherPage.jsx', '<WeatherLocationManager'));

// QuickWeather uses DEFAULT_WEATHER_CITIES
check('QuickWeather imports DEFAULT_WEATHER_CITIES', fileContains('src/components/QuickWeather.jsx', 'DEFAULT_WEATHER_CITIES'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
