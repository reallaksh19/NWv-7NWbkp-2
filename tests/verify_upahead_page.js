import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.goto('http://localhost:4173/#/up-ahead');

    // Switch to upahead tab using a more robust selector if it requires interaction.
    // Wait for the empty state to show up at least
    await page.waitForTimeout(4000);

    // Take screenshot
    await page.screenshot({ path: '/home/jules/verification/upahead_page_test.png', fullPage: true });

    console.log("Up Ahead page screenshot saved to /home/jules/verification/upahead_page_test.png");

    await browser.close();
})();
