import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    // The main page is at root
    await page.goto('http://localhost:4173/#/');

    // Inject mock news data into local storage to ensure the page renders quickly
    await page.evaluate(() => {
        const mockNews = {
            headlines: [
                { id: '1', title: 'Global Tech Summit 2026 Announced', source: 'TechNews', pubDate: new Date().toISOString() },
                { id: '2', title: 'New Electric Vehicle Subsidy Rollout', source: 'AutoDaily', pubDate: new Date().toISOString() }
            ],
            topStories: [
                { id: '3', title: 'Market Hits Record Highs', source: 'FinanceToday', pubDate: new Date().toISOString() }
            ]
        };
        localStorage.setItem('nw_news_cache', JSON.stringify({
            data: mockNews,
            timestamp: Date.now()
        }));
    });

    // Reload the page to catch the mocked data
    await page.reload();

    // Wait for the main page to load content
    await page.waitForSelector('.news-sections', { state: 'attached', timeout: 5000 });
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: '/home/jules/verification/main_page_test.png', fullPage: true });

    console.log("Main page screenshot saved to /home/jules/verification/main_page_test.png");

    await browser.close();
})();
