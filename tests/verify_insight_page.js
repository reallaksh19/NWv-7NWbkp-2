import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.goto('http://localhost:4173/#/insight');

    // Wait for the main page to load content
    await page.waitForSelector('.insight-page', { state: 'attached', timeout: 5000 });
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: '/home/jules/verification/insight_page_test.png', fullPage: true });

    console.log("Insight page screenshot saved to /home/jules/verification/insight_page_test.png");

    await browser.close();
})();
