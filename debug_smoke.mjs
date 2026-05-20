import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  await page.goto('http://127.0.0.1:4178', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await browser.close();
})();
