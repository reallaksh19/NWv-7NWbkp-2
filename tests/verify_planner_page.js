import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    // Go to the page first
    await page.goto('http://localhost:4173/#/my-planner');

    // Inject the mock data into local storage after navigating to the domain
    // From plannerStorage.js: PLANNER_KEY = 'upAhead_planner'
    await page.evaluate(() => {
        const data = {
            '2026-04-12': [
                {
                    id: 'abc12345',
                    title: 'Chennai Book Fair',
                    source: 'bookmyshow',
                    category: 'events',
                    eventDateKey: '2026-04-12',
                    locationCanonical: 'chennai',
                    state: 'saved',
                    link: 'http://example.com/1'
                },
                {
                    id: 'def67890',
                    title: 'IndiGo Fare Sale',
                    source: 'airlines',
                    category: 'travel',
                    eventDateKey: '2026-04-12',
                    locationCanonical: 'chennai',
                    state: 'saved',
                    link: 'http://example.com/2'
                }
            ],
            '2026-04-15': [
                {
                    id: 'xyz09876',
                    title: 'New Movie Release: The Great Indian Festival',
                    source: 'inoreader',
                    category: 'movies',
                    eventDateKey: '2026-04-15',
                    locationCanonical: 'india',
                    state: 'saved',
                    link: 'http://example.com/3'
                }
            ]
        };
        localStorage.setItem('upAhead_planner', JSON.stringify(data));
    });

    // Reload the page so the app reads from local storage
    await page.reload();

    // Wait for the planner page shell
    await page.waitForSelector('.ua-weekly-plan', { state: 'attached', timeout: 5000 });

    // Additional wait to let the components render
    await page.waitForTimeout(1000);

    // Take screenshot of the planner page
    await page.screenshot({ path: '/home/jules/verification/planner_phase3_test.png', fullPage: true });

    console.log("Planner page screenshot saved to /home/jules/verification/planner_phase3_test.png");

    await browser.close();
})();
