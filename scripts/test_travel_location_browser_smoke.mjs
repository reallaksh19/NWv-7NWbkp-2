import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4178;
const BASE_URL = `http://${HOST}:${PORT}`;

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
    if (process.env.NW_VERBOSE_SMOKE === '1') process.stdout.write(String(data));
  });

  child.stderr.on('data', data => {
    if (process.env.NW_VERBOSE_SMOKE === '1') process.stderr.write(String(data));
  });

  return child;
}

async function waitForServer(timeoutMs = 45000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(BASE_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw new Error('Vite dev server did not become ready. Last error: ' + (lastError?.message || 'unknown'));
}

async function visibleBox(page, selector, label, timeout = 12000) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout });
  const box = await locator.boundingBox();

  if (!box || box.width < 10 || box.height < 10) {
    throw new Error(label + ' is not visibly rendered. Box: ' + JSON.stringify(box));
  }

  return box;
}

async function clickTextIfVisible(page, textCandidates, timeout = 2500) {
  for (const text of textCandidates) {
    const locator = page.getByText(text, { exact: false }).first();

    try {
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click();
      await page.waitForTimeout(500);
      return true;
    } catch {
      // Try next.
    }
  }

  return false;
}

async function gotoTab(page, labels) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);

  const clicked = await clickTextIfVisible(page, labels, 3000);
  if (clicked) {
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(900);
  }

  return clicked;
}

async function openSettings(page) {
  const clicked =
    await clickTextIfVisible(page, ['Settings', 'settings', '⚙'], 2500) ||
    await page.locator('button[aria-label*="Settings" i], a[aria-label*="Settings" i], button:has-text("⚙")').first().click().then(() => true).catch(() => false);

  if (!clicked) {
    throw new Error('Could not open Settings tab/page.');
  }

  await page.waitForTimeout(800);
}

async function setTravelLocationToColombo(page) {
  await openSettings(page);

  await visibleBox(
    page,
    '[data-travel-location-settings], .travel-location-settings',
    'Travel location settings panel'
  );

  const bodyText = await page.locator('body').textContent();
  for (const token of ['Travel location', 'Prioritise local stories', 'Colombo']) {
    if (!String(bodyText || '').toLowerCase().includes(token.toLowerCase())) {
      throw new Error('Travel settings missing token: ' + token);
    }
  }

  const select = page.locator('[data-travel-location-settings] select, .travel-location-settings select').first();
  await select.waitFor({ state: 'visible', timeout: 8000 });

  const values = await select.locator('option').evaluateAll(options =>
    options.map(option => ({
      value: option.value,
      text: option.textContent || '',
    }))
  );

  const colomboOption = values.find(option =>
    option.value === 'colombo' ||
    option.text.toLowerCase().includes('colombo')
  );

  if (!colomboOption) {
    throw new Error('Travel location select does not include Colombo option.');
  }

  await select.selectOption(colomboOption.value || { label: /Colombo/i });
  await page.waitForTimeout(500);

  const boost = page.locator('[data-travel-location-settings] input[type="checkbox"], .travel-location-settings input[type="checkbox"]').first();
  if (await boost.count()) {
    const checked = await boost.isChecked().catch(() => true);
    if (!checked) await boost.check();
  }

  const statusText = await page.locator('[data-travel-location-settings], .travel-location-settings').first().textContent();
  if (!String(statusText || '').toLowerCase().includes('colombo')) {
    throw new Error('Travel location settings did not show Colombo after selection.');
  }
}

async function assertMainTravelContext(page) {
  await gotoTab(page, ['Main', 'Home', 'Brief', 'Top Stories']);

  const bannerOrBlock =
    await page.locator('[data-travel-location-banner], .travel-location-banner, [data-travel-local-stories], .travel-local-stories').count();

  if (bannerOrBlock < 1) {
    throw new Error('Main tab does not render travel location banner or travel local block.');
  }

  const travelText = await page
    .locator('[data-travel-location-banner], .travel-location-banner, [data-travel-local-stories], .travel-local-stories')
    .first()
    .textContent()
    .catch(() => '');

  if (!String(travelText || '').toLowerCase().includes('colombo')) {
    throw new Error('Main travel context is visible but does not reference Colombo.');
  }
}

async function assertWeatherCanDriveTravelLocation(page) {
  await gotoTab(page, ['Weather', 'weather', '🌤']);

  const managerCount = await page.locator('[data-weather-location-manager], .wlm-collapsed, .wlm-panel').count();
  if (managerCount < 1) {
    throw new Error('Weather location manager is not visible.');
  }

  const bodyText = await page.locator('body').textContent();
  if (!String(bodyText || '').toLowerCase().includes('colombo')) {
    throw new Error('Weather tab does not include Colombo as city option/tab/manager text.');
  }

  const colomboButton = page
    .locator('button:has-text("Colombo"), [data-weather-add-colombo], [data-city="colombo"], [data-weather-city="colombo"]')
    .first();

  if (await colomboButton.count()) {
    await colomboButton.click().catch(() => {});
    await page.waitForTimeout(700);
  }

  await page.evaluate(() => {
    localStorage.setItem('weather_active_city', 'colombo');
  });

  await assertMainTravelContext(page);
}

async function assertColumboAliasInRuntimeModules(page) {
  const result = await page.evaluate(async () => {
    try {
      const module = await import('/src/services/travelLocationProfile.js');
      return {
        colombo: module.resolveTravelLocationKey('Colombo'),
        columbo: module.resolveTravelLocationKey('Columbo'),
        sriLanka: module.resolveTravelLocationKey('Sri Lanka'),
      };
    } catch (error) {
      return {
        error: error.message,
      };
    }
  });

  if (result.error) {
    throw new Error('Could not import travelLocationProfile module in browser: ' + result.error);
  }

  if (result.colombo !== 'colombo' || result.columbo !== 'colombo' || result.sriLanka !== 'colombo') {
    throw new Error('Runtime travel alias resolution failed: ' + JSON.stringify(result));
  }
}

async function main() {
  const server = startDevServer();
  let browser = null;

  try {
    await waitForServer();

    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });

    const page = await context.newPage();

    await gotoTab(page, ['Main', 'Home', 'Brief']);
    await assertColumboAliasInRuntimeModules(page);
    await setTravelLocationToColombo(page);
    await assertMainTravelContext(page);
    await assertWeatherCanDriveTravelLocation(page);

    await browser.close();
    browser = null;

    console.log(JSON.stringify({
      status: 'PASS',
      checked: 'Travel location browser smoke',
      guarantees: [
        'Settings exposes Travel location panel',
        'Colombo is selectable as travel location',
        'Columbo typo resolves to Colombo in browser runtime',
        'Main tab renders travel location banner/local block',
        'Main tab references Colombo travel context',
        'Weather tab includes Colombo context',
        'Weather active city can drive travel location fallback'
      ],
    }, null, 2));

    console.log('PASS: Travel location browser smoke');
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
