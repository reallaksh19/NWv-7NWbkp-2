import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4177;
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
      shell: process.platform === 'win32',
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
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
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
    /\d+%\s*·\s*\d+(\.\d+)?mm/i.test(String(text)) ||
    /0%\s*·\s*0\.0mm/i.test(String(text));

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
    page.on('console', msg => {
      if (process.env.NW_VERBOSE_SMOKE === '1') console.log('BROWSER CONSOLE:', msg.text());
    });
    page.on('pageerror', error => {
      if (process.env.NW_VERBOSE_SMOKE === '1') console.log('BROWSER ERROR:', error.message);
    });

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
