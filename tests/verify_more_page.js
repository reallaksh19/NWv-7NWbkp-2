import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.goto('http://localhost:4173/#/more');

    // Wait for the more page shell
    await page.waitForSelector('.dashboard-grid', { state: 'attached', timeout: 5000 });

    // Additional wait to let the grid render
    await page.waitForTimeout(1000);

    // Take screenshot of the more page
    await page.screenshot({ path: '/home/jules/verification/more_phase4_test.png', fullPage: true });

    console.log("More page screenshot saved to /home/jules/verification/more_phase4_test.png");

    await browser.close();
})();
