import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) return '';
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  if (!before) throw new Error(`Missing file: ${path}`);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

/* -------------------------------------------------------------------------- */
/* 1) Browser smoke script                                                     */
/* -------------------------------------------------------------------------- */

write('scripts/test_weather_browser_smoke.mjs', `import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4177;
const BASE_URL = \`http://\${HOST}:\${PORT}\`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startDevServer() {
  const child = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BROWSER: 'none',
      },
    }
  );

  child.stdout.on('data', data => {
    const text = String(data);
    if (process.env.NW_VERBOSE_SMOKE === '1') process.stdout.write(text);
  });

  child.stderr.on('data', data => {
    const text = String(data);
    if (process.env.NW_VERBOSE_SMOKE === '1') process.stderr.write(text);
  });

  return child;
}

async function waitForServer(timeoutMs = 45000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(BASE_URL, { cache: 'no-store' });
      if (response.ok) return true;
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw new Error('Vite dev server did not become ready. Last error: ' + (lastError?.message || 'unknown'));
}

async function visibleBox(page, selector, label) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 12000 });
  const box = await locator.boundingBox();

  if (!box || box.width < 20 || box.height < 20) {
    throw new Error(label + ' is not visibly rendered. Box: ' + JSON.stringify(box));
  }

  return box;
}

async function clickTextIfVisible(page, textCandidates) {
  for (const text of textCandidates) {
    const locator = page.getByText(text, { exact: false }).first();
    try {
      await locator.waitFor({ state: 'visible', timeout: 2500 });
      await locator.click();
      return true;
    } catch {
      // Try next.
    }
  }

  return false;
}

async function gotoWeatherTab(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  const clicked = await clickTextIfVisible(page, ['Weather', 'weather', '🌤']);
  if (clicked) {
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  return clicked;
}

async function assertNoVisibleOnThisDay(page) {
  const visibleOnThisDayCount = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('section, article, .card, .panel, .widget, h1, h2, h3, h4, header')];
    return candidates.filter(node => {
      const text = String(node.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      if (!text.includes('on this day')) return false;

      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || 1) !== 0 &&
        rect.width > 10 &&
        rect.height > 10;
    }).length;
  });

  if (visibleOnThisDayCount > 0) {
    throw new Error('On This Day is visible even though default setting should hide it.');
  }
}

async function assertWeatherLocationManager(page) {
  const managerSelector = '[data-weather-location-manager], .wlm-collapsed, .wlm-panel, .weather-location-manager';
  await visibleBox(page, managerSelector, 'Weather location manager');

  const manageButton = page.getByRole('button', { name: /manage/i }).first();
  if (await manageButton.isVisible().catch(() => false)) {
    await manageButton.click();
    await page.waitForTimeout(300);
  }

  await visibleBox(page, '[data-weather-location-manager="open"], .wlm-panel, .weather-location-manager', 'Open weather location manager');

  const helpText = await page.locator('body').textContent();
  for (const token of ['Add', 'delete', 'Colombo']) {
    if (!String(helpText || '').toLowerCase().includes(token.toLowerCase())) {
      throw new Error('Weather location manager is missing visible token: ' + token);
    }
  }

  const colomboButton = page.locator('[data-weather-add-colombo], button:has-text("Colombo")').first();
  const hasColomboPath = await colomboButton.count();
  if (hasColomboPath < 1) {
    const bodyText = await page.locator('body').textContent();
    if (!String(bodyText || '').includes('Colombo is already added')) {
      throw new Error('No Add Colombo path or already-added Colombo message found.');
    }
  }

  const deleteButtons = await page.locator('[data-weather-delete-city], .wlm-chip button').count();
  if (deleteButtons < 1) {
    throw new Error('No visible delete-city button found in Weather location manager.');
  }
}

async function assertQuickWeather(page) {
  const selector = '.quick-weather-card, [class*="quick-weather-card"], [data-quick-weather], .qw-card';
  const box = await visibleBox(page, selector, 'QuickWeather card');

  if (box.width < 220 && page.viewportSize()?.width >= 900) {
    throw new Error('QuickWeather desktop width is too small: ' + JSON.stringify(box));
  }

  const text = await page.locator(selector).first().textContent().catch(() => '');
  const hasRainMm =
    /\\d+%\\s*·\\s*\\d+(\\.\\d+)?mm/i.test(String(text)) ||
    /0%\\s*·\\s*0\\.0mm/i.test(String(text));

  if (!hasRainMm) {
    throw new Error('QuickWeather does not show precipitation as probability + mm.');
  }
}

async function assertWeeklyForecast(page) {
  const selector = '[data-weekly-weather-forecast], .wwf-card, .weekly-weather-forecast';
  await visibleBox(page, selector, 'Weekly forecast');

  const text = await page.locator(selector).first().textContent().catch(() => '');

  for (const token of ['Rain', 'Feels', 'Humidity']) {
    if (!String(text || '').toLowerCase().includes(token.toLowerCase())) {
      throw new Error('Weekly forecast is missing token: ' + token);
    }
  }
}

async function main() {
  const server = startDevServer();
  let browser = null;

  try {
    await waitForServer();

    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });

    const page = await context.newPage();

    await gotoWeatherTab(page);

    await assertNoVisibleOnThisDay(page);
    await assertWeatherLocationManager(page);
    await assertQuickWeather(page);
    await assertWeeklyForecast(page);

    await browser.close();
    browser = null;

    console.log(JSON.stringify({
      status: 'PASS',
      checked: 'Weather browser smoke',
      guarantees: [
        'Weather page can be opened in browser',
        'On This Day is hidden by default',
        'Weather location manager is visible',
        'Add/delete city path is visible',
        'Colombo add/already-added path exists',
        'QuickWeather is visible in desktop viewport',
        'QuickWeather shows rain probability and mm',
        'Weekly forecast shows rain, feels and humidity'
      ],
    }, null, 2));

    console.log('PASS: Weather browser smoke');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
    await sleep(500);
    if (!server.killed) server.kill('SIGKILL');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
`);

/* -------------------------------------------------------------------------- */
/* 2) Static guard for smoke script                                            */
/* -------------------------------------------------------------------------- */

write('scripts/test_weather_browser_smoke_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const smoke = read('scripts/test_weather_browser_smoke.mjs');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  "import { chromium } from 'playwright'",
  'assertNoVisibleOnThisDay',
  'assertWeatherLocationManager',
  'assertQuickWeather',
  'assertWeeklyForecast',
  'data-weather-add-colombo',
  'data-weather-delete-city',
  'QuickWeather does not show precipitation',
  'Weekly forecast is missing token',
]) {
  assert(smoke.includes(token), 'test_weather_browser_smoke.mjs missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-browser-smoke"'),
  'package.json must include test:weather-browser-smoke'
);

assert(
  packageJson.includes('"test:weather-browser-smoke:static"'),
  'package.json must include test:weather-browser-smoke:static'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-browser-smoke:static']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include static browser-smoke guard or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather browser smoke static guard',
  guarantees: [
    'Playwright smoke script exists',
    'On This Day hidden-by-default browser check exists',
    'Weather location manager browser check exists',
    'QuickWeather desktop visibility browser check exists',
    'QuickWeather precipitation mm browser check exists',
    'Weekly forecast browser check exists'
  ],
}, null, 2));

console.log('PASS: Weather browser smoke static guard');
`);

/* -------------------------------------------------------------------------- */
/* 3) package.json + certification                                             */
/* -------------------------------------------------------------------------- */

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};

  pkg.scripts['test:weather-browser-smoke:static'] =
    'node scripts/test_weather_browser_smoke_static.mjs';

  pkg.scripts['test:weather-browser-smoke'] =
    'node scripts/test_weather_browser_smoke.mjs';

  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:weather-browser-smoke:static']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:weather-professional-theme']],",
    "  ['npm', ['run', 'test:weather-manager-clarity']],",
    "  ['npm', ['run', 'test:weather-final-closure']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\\n  ['npm', ['run', 'test:weather-browser-smoke:static']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'weather-browser-smoke-static')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-professional-theme');
      const command = {
        id: 'weather-browser-smoke-static',
        cmd: 'npm',
        args: ['run', 'test:weather-browser-smoke:static'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:weather-browser-smoke:static')) return source;

    if (source.includes("'test:weather-professional-theme',")) {
      return source.replace(
        "'test:weather-professional-theme',",
        "'test:weather-professional-theme',\\n  'test:weather-browser-smoke:static',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 61H Weather browser smoke patch complete.');
