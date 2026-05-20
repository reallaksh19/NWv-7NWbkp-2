// Mock localStorage before import
const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};
global.localStorage = mockLocalStorage;

import { extractFutureDate, processUpAheadData } from './upAheadService.js';

function runTests() {
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    }

    console.log('--- Starting Tests: UpAheadService ---');

    // MOCK DATE: Today is Feb 5, 2026
    const originalDate = Date;
    const MOCK_TODAY = new Date('2026-02-05T12:00:00Z');

    // Override global Date for predictable testing
    global.Date = class extends Date {
        constructor(...args) {
            if (args.length === 0) return new originalDate(MOCK_TODAY.getTime());
            return new originalDate(...args);
        }
        static now() {
            return MOCK_TODAY.getTime();
        }
    };

    // TEST 1: Old Story Freshness Check (Strict for Alerts)
    const oldAlert = {
        id: 'old-alert-1',
        title: 'School Holiday Oct 22',
        pubDate: new Date('2025-10-22T08:00:00Z'),
        category: 'alerts',
        extractedDate: new Date('2026-10-22T00:00:00Z')
    };

    const settings = { hideOlderThanHours: 60 };
    const processedStrict = processUpAheadData([oldAlert], settings);

    assert(processedStrict.timeline.length === 0, 'Old ALERT (Oct 2025) should be filtered out by 60h rule');


    // TEST 2: Old Story Freshness Check (Relaxed for Events)
    // Story published 10 days ago (Feb 5 - 10 days = Jan 26). > 60 hours.
    // Event is in March.
    const oldEvent = {
        id: 'old-event-1',
        title: 'Concert on March 15',
        pubDate: new Date('2026-01-26T08:00:00Z'), // 10 days ago
        category: 'events',
        extractedDate: new Date('2026-03-15T00:00:00Z') // Future
    };

    const processedRelaxed = processUpAheadData([oldEvent], settings);

    assert(processedRelaxed.timeline.length === 1, 'Old EVENT with Future Date should be KEPT despite 60h rule');
    if (processedRelaxed.timeline.length > 0) {
        assert(processedRelaxed.timeline[0].items[0].title === 'Concert on March 15', 'Correct event title extracted');
    }


    // TEST 3: Extract Future Date with Context
    const text = "School Holiday: Schools closed on Oct 22 due to rain";
    const pubDateOld = new Date('2025-10-20T08:00:00Z');
    const extracted = extractFutureDate(text, pubDateOld);

    if (extracted) {
        assert(extracted.getFullYear() === 2025, `Extracted Year should be 2025 (Context: PubDate 2025), Got ${extracted.getFullYear()}`);
    } else {
        console.log('Extracted Date:', extracted);
        assert(false, 'Should have extracted a date (Oct 22, 2025)');
    }


    // TEST 4: Future Event in Future Article
    const textFuture = "Big Concert happening on March 15";
    const pubDateFuture = new Date('2026-02-10T08:00:00Z');
    const extractedFuture = extractFutureDate(textFuture, pubDateFuture);
    assert(extractedFuture.getFullYear() === 2026, `Future Year should be 2026, Got ${extractedFuture.getFullYear()}`);
    assert(extractedFuture.getMonth() === 2, `Month should be March (2), Got ${extractedFuture.getMonth()}`);
    assert(extractedFuture.getDate() === 15, `Day should be 15, Got ${extractedFuture.getDate()}`);


    // TEST 5: Next Year Event
    const textNextYear = "Festival on Jan 5";
    const pubDateDec = new Date('2025-12-25T00:00:00Z');
    const extractedNext = extractFutureDate(textNextYear, pubDateDec);
    assert(extractedNext.getFullYear() === 2026, `New Year logic: Expected 2026, Got ${extractedNext.getFullYear()}`);


    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);

    // Restore Date
    global.Date = originalDate;

    if (failed > 0) process.exit(1);
}

runTests();
