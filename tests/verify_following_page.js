import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.goto('http://localhost:4173/#/following');

    // Type in the search bar and press enter to add a topic
    await page.fill('input[type="text"]', 'Playwright Test');
    await page.click('button:has-text("Search")');

    // Wait for the follow button to appear and click it
    await page.waitForSelector('button:has-text("Follow")', { state: 'attached', timeout: 5000 });
    await page.click('button:has-text("Follow")');

    // Wait for the topics section to attach
    await page.waitForSelector('.following-page__topics', { state: 'attached', timeout: 5000 });
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: '/home/jules/verification/following_page_test.png', fullPage: true });

    console.log("Following page screenshot saved to /home/jules/verification/following_page_test.png");

    await browser.close();
})();
