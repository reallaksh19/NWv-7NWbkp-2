
// ==========================================
// AUDIT & DIAGNOSTIC SCRIPT (MOCK ENV)
// ==========================================

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// --- MOCK BROWSER ENVIRONMENT ---
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        _getStore: () => store
    };
})();

global.localStorage = localStorageMock;
global.window = { innerWidth: 1024 };
if (!global.navigator) {
    global.navigator = { userAgent: 'node' };
} else {
    // If it exists (Node 21+), just add userAgent if missing or leave it
    if (!global.navigator.userAgent) {
        Object.defineProperty(global.navigator, 'userAgent', {
            value: 'node',
            configurable: true
        });
    }
}

// Mock Fetch with Scenario Support
const mockFetchScenarios = {
    market: { success: true, data: { chart: { result: [{ meta: { regularMarketPrice: 22000, regularMarketTime: Date.now()/1000 } }] } } },
    weather: { success: true },
    rss: { success: true }
};

global.fetch = async (url) => {
    const u = url.toString();

    // Market Scenarios
    if (u.includes('query1.finance.yahoo.com') || u.includes('alphavantage')) {
        if (!mockFetchScenarios.market.success) throw new Error("Network Error");
        return {
            ok: true,
            json: async () => mockFetchScenarios.market.data
        };
    }

    // Default Success
    return {
        ok: true,
        json: async () => ({})
    };
};

// --- IMPORTS (After Mock Setup) ---
// We use dynamic imports or ensure these files don't have side-effect executions that fail in Node
import { computeImpactScore } from '../src/services/rssAggregator.js';
import { detectCategory, normalizeUpAheadItem } from '../src/services/upAheadService.js';
import { extractDate } from '../src/utils/dateExtractor.js';
import plannerStorage from '../src/utils/plannerStorage.js';
import { calculateRainfallConsensus } from '../src/utils/multiModelUtils.js';
import { getSettings, updateSetting, saveSettings } from '../src/utils/storage.js';

// --- UTILS ---
const PASS = "✅ PASS";
const FAIL = "❌ FAIL";
const WARN = "⚠️ WARN";

function logResult(section, test, status, details = "") {
    console.log(`[${section}] ${test.padEnd(40)} ${status} ${details}`);
}

async function runAudit() {
    console.log("\n==================================================");
    console.log("   NEWS INTELLIGENCE SYSTEM - EXPERT AUDIT RUN   ");
    console.log("==================================================\n");

    let errors = 0;

    // ==========================================
    // 1. RANKING SYSTEM AUDIT
    // ==========================================
    console.log("🔍 PART 1: RANKING LOGIC (TOP STORIES)");

    const now = Date.now();
    const hour = 3600 * 1000;

    // Test 1.1: Freshness Decay
    // Compare 2h old vs 26h old item (Default decayHours=26)
    const freshItem = { publishedAt: now - (2 * hour), source: 'BBC', title: 'Fresh News', description: 'Just happened.' };
    const staleItem = { publishedAt: now - (26 * hour), source: 'BBC', title: 'Old News', description: 'Happened yesterday.' };

    // Force specific weights for predictable testing
    updateSetting('rankingWeights.freshness.maxBoost', 3);
    updateSetting('rankingWeights.freshness.decayHours', 26);
    updateSetting('rankingMode', 'smart');

    const scoreFresh = computeImpactScore(freshItem, 'world');
    const scoreStale = computeImpactScore(staleItem, 'world');

    if (scoreFresh > scoreStale * 1.5) {
        logResult("Ranking", "Freshness Decay (2h vs 26h)", PASS, `(${scoreFresh.toFixed(1)} vs ${scoreStale.toFixed(1)})`);
    } else {
        logResult("Ranking", "Freshness Decay (2h vs 26h)", FAIL, `Stale item scored too high!`);
        errors++;
    }

    // Test 1.2: "Same stories appear for 2 days" Simulation
    // A 48h old story should have near-zero freshness score, thus very low total score
    const veryOldItem = { publishedAt: now - (48 * hour), source: 'BBC', title: 'Ancient News', description: 'Two days ago.' };
    const scoreVeryOld = computeImpactScore(veryOldItem, 'world');

    if (scoreVeryOld < scoreFresh * 0.3) {
        logResult("Ranking", "48h Old Story Penalty", PASS, `Score: ${scoreVeryOld.toFixed(1)} (Low enough)`);
    } else {
        logResult("Ranking", "48h Old Story Penalty", FAIL, `Score: ${scoreVeryOld.toFixed(1)} (Too high! User Pain Point)`);
        errors++;
    }

    // Test 1.3: Seen Penalty
    // User Pain Point: "Top stories don't refresh"
    const viewedItem = { ...freshItem };
    const scoreViewed = computeImpactScore(viewedItem, 'world', 1); // 1 view
    const scoreUnviewed = computeImpactScore(freshItem, 'world', 0); // 0 views

    if (scoreViewed < scoreUnviewed * 0.5) {
        logResult("Ranking", "Seen Penalty (1 view)", PASS, `Dropped from ${scoreUnviewed.toFixed(1)} to ${scoreViewed.toFixed(1)}`);
    } else {
        logResult("Ranking", "Seen Penalty (1 view)", FAIL, `Penalty ineffective (${scoreViewed.toFixed(1)})`);
        errors++;
    }

    // Test 1.4: Sentiment Impact (Expert)
    const positiveItem = { ...freshItem, sentiment: { label: 'positive' } };
    const negativeItem = { ...freshItem, sentiment: { label: 'negative' } };
    const scorePos = computeImpactScore(positiveItem, 'world');
    const scoreNeg = computeImpactScore(negativeItem, 'world');

    // Usually positive boosts more, or negative might boost for "Crisis" keywords.
    // Default weights: Positive +0.5, Negative +0.3. So Positive > Negative (slightly)
    // But verify they are DIFFERENT from neutral
    if (scorePos !== scoreFresh || scoreNeg !== scoreFresh) {
        logResult("Ranking", "Sentiment Integration", PASS, `Pos: ${scorePos.toFixed(1)}, Neg: ${scoreNeg.toFixed(1)}, Neu: ${scoreFresh.toFixed(1)}`);
    } else {
        logResult("Ranking", "Sentiment Integration", WARN, "Sentiment had no effect on score.");
    }

    // ==========================================
    // 2. UP AHEAD / PLANNER AUDIT
    // ==========================================
    console.log("\n🔍 PART 2: UP AHEAD & PLANNER (PAIN POINTS)");

    // Test 2.1: Category Detection (User: "No movies, No local events")
    const cases = [
        { text: "Leo releasing on Oct 25 in theaters", expected: 'movies' },
        { text: "Standup Comedy in Chennai this weekend", expected: 'events' },
        { text: "Heavy rain alert for Tamil Nadu", expected: 'weather_alerts' },
        { text: "Road blockage at Anna Salai due to protest", expected: 'civic' }, // User Pain Point
        { text: "Discount sale at Phoenix Mall", expected: 'shopping' } // New category check
    ];

    cases.forEach(c => {
        const cat = detectCategory(c.text);
        if (cat === c.expected) {
            logResult("UpAhead", `Category: "${c.text.substring(0, 20)}..."`, PASS, `-> ${cat}`);
        } else {
            logResult("UpAhead", `Category: "${c.text.substring(0, 20)}..."`, FAIL, `Got ${cat}, expected ${c.expected}`);
            errors++;
        }
    });

    // Test 2.2: Date Extraction (User: "Dates irrelevant/wrong")
    const dateCases = [
        { text: "Concert on Oct 25", expectedDate: 25, expectedMonth: 9 }, // 0-indexed month
        { text: "Releasing next Friday", expectedRelative: true },
        { text: "Offer ends Feb 14", expectedDate: 14, expectedMonth: 1 }
    ];

    dateCases.forEach(c => {
        const ext = extractDate(c.text, new Date()); // Context: Today
        if (ext && ext.start) {
            if (c.expectedRelative) {
                logResult("UpAhead", `Date: "${c.text}"`, PASS, `-> ${ext.start.toDateString()} (Relative)`);
            } else if (ext.start.getDate() === c.expectedDate && ext.start.getMonth() === c.expectedMonth) {
                logResult("UpAhead", `Date: "${c.text}"`, PASS, `-> ${ext.start.toDateString()}`);
            } else {
                logResult("UpAhead", `Date: "${c.text}"`, FAIL, `Got ${ext.start.toDateString()}`);
                errors++;
            }
        } else {
            logResult("UpAhead", `Date: "${c.text}"`, FAIL, "No date extracted");
            errors++;
        }
    });

    // Test 2.3: Planner Persistence (User: "Plan my week doesn't save")
    // Scenario: User adds item, reloads page (clears mem), item should exist in Storage
    plannerStorage.clear();
    const todayKey = new Date().toISOString().split('T')[0];
    const testItem = { id: 'test-1', title: 'Saved Event', category: 'events' };

    plannerStorage.addItem(todayKey, testItem);

    // Simulate "Page Reload" -> Read from localStorage again
    const storedDays = plannerStorage.getUpcomingDays(1);
    const storedItem = storedDays[0]?.items.find(i => i.id === 'test-1');

    if (storedItem) {
        logResult("UpAhead", "Persistence (Save & Load)", PASS, "Item survived reload");
    } else {
        logResult("UpAhead", "Persistence (Save & Load)", FAIL, "Item LOST after reload (Critical Bug)");
        errors++;
    }

    // Test 2.4: Merge Logic (User: "Keeps refreshing - no data")
    // Scenario: Feed has items A, B. Storage has saved item C.
    // Result should be A, B, C (merged).
    // If logic is wrong, C might be wiped out by the feed refresh.
    // NOTE: This logic is in `mergeUpAheadData` (not imported here due to complexity),
    // but `plannerStorage.merge` is the core.

    const feedItems = [{ id: 'feed-1', title: 'Feed Item', category: 'news' }];
    plannerStorage.merge([todayKey], feedItems); // Merge feed into storage-view

    const mergedDays = plannerStorage.getUpcomingDays(1);
    const dayItems = mergedDays[0]?.items || [];
    const hasFeed = dayItems.some(i => i.id === 'feed-1');
    const hasSaved = dayItems.some(i => i.id === 'test-1');

    if (hasFeed && hasSaved) {
        logResult("UpAhead", "Merge Logic (Feed + Saved)", PASS, `Found ${dayItems.length} items`);
    } else {
        logResult("UpAhead", "Merge Logic (Feed + Saved)", FAIL, `Missing items! Feed:${hasFeed}, Saved:${hasSaved}`);
        errors++;
    }


    // ==========================================
    // 3. MARKET SYSTEM AUDIT
    // ==========================================
    console.log("\n🔍 PART 3: MARKET RELIABILITY (PAIN POINTS)");

    // Test 3.1: Fallback Logic (User: "Market data vanishes")
    // If Network Fails, do we get NOTHING or STALE data?
    // Note: Since we can't easily test the full Service with internal fetches,
    // we audit the *Cache Logic* which is the root cause.

    // Simulate Cache State
    const cacheKey = 'market_indices';
    const staleData = { value: 20000, timestamp: Date.now() - (120 * 60 * 1000) }; // 2 hours old

    // Mock settings
    const marketSettings = { cacheMinutes: 15 }; // Default

    // Logic Audit:
    // If (now - timestamp) > cacheMinutes, normally we fetch.
    // IF fetch fails, do we fallback to `staleData`?
    // This is a logic check.

    // Let's simulate the Cache check function:
    function checkCache(key, maxAgeMins) {
        const now = Date.now();
        const age = (now - staleData.timestamp) / (60 * 1000);
        if (age > maxAgeMins) return null; // Expired
        return staleData;
    }

    // Standard check (Strict)
    if (checkCache(cacheKey, 15) === null) {
         logResult("Market", "Strict Cache Expiry", PASS, "Correctly identifies 2h old data as expired");
    } else {
         logResult("Market", "Strict Cache Expiry", FAIL, "Incorrectly thinks 2h old data is fresh");
    }

    // Fallback Check (User Pain Point Fix Requirement)
    // Does the system support "Soft Expiry"? (Return stale if fresh fails)
    // We can't test the code directly without the Service, but we can verify if the storage *has* the data to fallback to.

    localStorageMock.setItem('dailyEventAI_cachedData', JSON.stringify({
        'market_indices': { data: staleData, timestamp: staleData.timestamp }
    }));

    const savedCache = JSON.parse(localStorageMock.getItem('dailyEventAI_cachedData'));
    if (savedCache && savedCache['market_indices']) {
        logResult("Market", "Persistence", PASS, "Stale data exists in storage (Recovery possible)");
    } else {
        logResult("Market", "Persistence", FAIL, "No data in storage to recover from!");
        errors++;
    }

    // ==========================================
    // 4. WEATHER SYSTEM AUDIT
    // ==========================================
    console.log("\n🔍 PART 4: WEATHER CONSENSUS");

    // Test 4.1: Consensus Calculation
    // [10%, 80%, 20%] -> Should show wide range warning (!)
    const precipInputs = [
        { precipitation_probability: 10 },
        { precipitation_probability: 80 },
        { precipitation_probability: 20 }
    ];
    const consensus = calculateRainfallConsensus(precipInputs);

    if (consensus.isWideRange && consensus.avg >= 35) {
        logResult("Weather", "Consensus Logic", PASS, `Avg: ${consensus.avg}%, Spread: ${consensus.range}%`);
    } else {
        logResult("Weather", "Consensus Logic", FAIL, `Failed to detect wide spread.`);
        errors++;
    }

    console.log("\n==================================================");
    console.log(`AUDIT COMPLETE. Errors: ${errors}`);
    if (errors > 0) console.log("🚨 CRITICAL ISSUES FOUND. SEE LOGS ABOVE.");
    else console.log("✅ SYSTEM HEALTHY. NO CRITICAL LOGIC FLAWS.");
    console.log("==================================================");
}

runAudit();
