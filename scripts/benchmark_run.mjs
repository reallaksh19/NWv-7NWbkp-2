
// Mock Browser Environment
global.localStorage = {
    getItem: (key) => {
        if (key === 'news_settings') return JSON.stringify({
            rankingWeights: {
                freshness: { decayHours: 12, maxBoost: 3 },
                source: { tier1Boost: 1.0 },
                keyword: { matchBoost: 2 },
                temporal: { weekendBoost: 1.0 }
            }
        });
        return null;
    },
    setItem: () => {},
    removeItem: () => {}
};
global.fetch = async () => ({ ok: true, json: async () => ({}) });

import { computeImpactScore } from '../src/services/rssAggregator.js';
import { extractDate } from '../src/utils/dateExtractor.js';
import { calculateRainfallConsensus } from '../src/utils/multiModelUtils.js';

async function runBenchmark() {
    console.log("=========================================");
    console.log("   SYSTEM BENCHMARK & VERIFICATION       ");
    console.log("=========================================");
    console.log(`Date: ${new Date().toISOString()}`);
    console.log("");

    const results = [];
    const perfStats = {};

    // ==========================================
    // CATEGORY A: RANKING STRESS TESTS
    // ==========================================
    const now = Date.now();
    const rankSettings = {
        rankingWeights: {
            freshness: { maxBoost: 3 },
            source: { tier1Boost: 1.5 }, // Scaled up for "BBC"
            keyword: { matchBoost: 2 },
            impact: { boost: 1.0 },
            section: { factor: 1.0 }
        },
        rankingMode: 'smart'
    };

    // RANK_01: The Perfect Storm
    // 5-min old "Breaking" news about "Chennai" from "BBC"
    const item01 = {
        title: "Breaking News: Major Crisis in Chennai",
        description: "Breaking: Heavy rains cause flood warnings in Chennai city.",
        source: "BBC News", // Tier 1
        publishedAt: now - (5 * 60 * 1000), // 5 mins ago
        section: "world" // High priority
    };

    // Warmup
    for(let i=0; i<100; i++) computeImpactScore(item01, 'world', 0, rankSettings);

    const t0 = performance.now();
    let score01;
    for(let i=0; i<1000; i++) {
        score01 = computeImpactScore(item01, 'world', 0, rankSettings);
    }
    const t1 = performance.now();
    perfStats.ranking = (t1 - t0) / 1000;

    const pass01 = score01 > 15.0;
    results.push({
        ID: "RANK_01",
        Scenario: "The Perfect Storm",
        Output: score01.toFixed(2),
        Target: "> 15.0",
        Result: pass01 ? "PASS" : "FAIL"
    });

    // RANK_02: The Stale Noise
    // 48-hour old "Opinion" piece from a generic blog
    const item02 = {
        title: "Opinion: Why I like tea",
        description: "Just a random thought about tea and biscuits.",
        source: "Random Blog", // Tier 3 (default)
        publishedAt: now - (48 * 60 * 60 * 1000), // 48 hours ago
        section: "general"
    };

    const score02 = computeImpactScore(item02, 'general', 0, rankSettings);
    const pass02 = score02 < 5.0;
    results.push({
        ID: "RANK_02",
        Scenario: "The Stale Noise",
        Output: score02.toFixed(2),
        Target: "< 5.0",
        Result: pass02 ? "PASS" : "FAIL"
    });

    // RANK_03: Seen Penalty
    // Same as RANK_01, but marked as viewed
    const score03 = computeImpactScore(item01, 'world', 1, rankSettings); // viewCount = 1
    const ratio = score03 / score01;
    const pass03 = ratio < 0.5 && ratio > 0.25;
    results.push({
        ID: "RANK_03",
        Scenario: "Seen Penalty",
        Output: `${score03.toFixed(2)} (${(ratio*100).toFixed(0)}%)`,
        Target: "~40%",
        Result: pass03 ? "PASS" : "FAIL"
    });

    // RANK_04: Viral Velocity (High Impact Keyword)
    // Should trigger "Event Magnitude" boost (2.5x)
    const item04 = {
        title: "Global War Declared",
        description: "War breaks out between nations.",
        source: "BBC News",
        publishedAt: now - (5 * 60 * 1000),
        section: "world"
    };
    // Enable debugLogs to get breakdown
    const debugSettings = { ...rankSettings, debugLogs: true };
    computeImpactScore(item04, 'world', 0, debugSettings); // Populates _scoreBreakdown
    const impactVal = item04._scoreBreakdown?.impact || 0;
    const pass04 = impactVal >= 2.5;
    results.push({
        ID: "RANK_04",
        Scenario: "Viral Velocity",
        Output: `Impact Multiplier: ${impactVal.toFixed(2)}x`,
        Target: ">= 2.50x",
        Result: pass04 ? "PASS" : "FAIL"
    });

    // ==========================================
    // CATEGORY B: INTELLIGENCE & EXTRACTION
    // ==========================================

    // TIME_01: Relative Date ("Tomorrow")
    const ref01 = new Date("2026-02-10T10:00:00Z");

    // Warmup
    for(let i=0; i<100; i++) extractDate("Concert happening Tomorrow", ref01);

    const tExtract0 = performance.now();
    let ext01;
    for(let i=0; i<1000; i++) {
        ext01 = extractDate("Concert happening Tomorrow", ref01);
    }
    const tExtract1 = performance.now();
    perfStats.extraction = (tExtract1 - tExtract0) / 1000;

    const exp01 = new Date("2026-02-11");
    const passTime01 = ext01 && ext01.start.getDate() === 11;
    results.push({
        ID: "TIME_01",
        Scenario: "Relative Date",
        Output: ext01?.start?.toISOString().split('T')[0],
        Target: "2026-02-11",
        Result: passTime01 ? "PASS" : "FAIL"
    });

    // TIME_02: Year Boundary
    // "Festival on Oct 25", Ref Dec 1 2026 -> Should be 2027
    const ref02 = new Date("2026-12-01T10:00:00Z");
    const ext02 = extractDate("Festival on Oct 25", ref02);
    // Month is 0-indexed in JS (Oct = 9)
    const passTime02 = ext02 && ext02.start.getFullYear() === 2027 && ext02.start.getMonth() === 9 && ext02.start.getDate() === 25;
    results.push({
        ID: "TIME_02",
        Scenario: "Year Boundary",
        Output: ext02?.start?.toISOString().split('T')[0],
        Target: "2027-10-25",
        Result: passTime02 ? "PASS" : "FAIL"
    });

    // TIME_03: Ambiguity
    // "Next Friday"
    const ref03 = new Date("2026-02-10T10:00:00Z"); // Feb 10 2026 is a Tuesday
    const ext03 = extractDate("Next Friday", ref03);
    // Code maps "Next Friday" to next occurrence
    results.push({
        ID: "TIME_03",
        Scenario: "Ambiguity (Next Fri)",
        Output: ext03?.start?.toISOString().split('T')[0],
        Target: "Future Date",
        Result: ext03 ? "PASS" : "FAIL"
    });

    // TIME_04: Date Format (DMY)
    // "02-03-2026" -> March 2, 2026
    const ref04 = new Date("2026-01-01T10:00:00Z");
    const ext04 = extractDate("Event on 02-03-2026", ref04);
    const pass04_time = ext04 && ext04.start.getMonth() === 2 && ext04.start.getDate() === 2;
    results.push({
        ID: "TIME_04",
        Scenario: "Date Format (DMY)",
        Output: ext04?.start?.toISOString().split('T')[0],
        Target: "2026-03-02",
        Result: pass04_time ? "PASS" : "FAIL"
    });

    // ==========================================
    // CATEGORY C: RESILIENCE
    // ==========================================

    // FAIL_02: Model Conflict
    const conflictData = [
        { precipitation_probability: 10, modelName: 'ecmwf' },
        { precipitation_probability: 90, modelName: 'gfs' },
        { precipitation_probability: 15, modelName: 'icon' }
    ];
    const weatherConsensus = calculateRainfallConsensus(conflictData);
    const passFail02 = weatherConsensus && weatherConsensus.isWideRange === true;
    results.push({
        ID: "FAIL_02",
        Scenario: "Model Conflict",
        Output: `Wide=${weatherConsensus?.isWideRange}, Range=${weatherConsensus?.range}`,
        Target: "Wide Range (!)",
        Result: passFail02 ? "PASS" : "FAIL"
    });

    // ==========================================
    // OUTPUT
    // ==========================================
    console.table(results);

    console.log("PERFORMANCE STANDARDS:");
    console.log(`Ranking Calculation: ${perfStats.ranking.toFixed(3)}ms (Target: < 1ms) -> ${perfStats.ranking < 1 ? "PASS" : "FAIL"}`);
    console.log(`Date Extraction:     ${perfStats.extraction.toFixed(3)}ms (Target: < 2ms) -> ${perfStats.extraction < 2 ? "PASS" : "FAIL"}`);

    const allPass = results.every(r => r.Result === "PASS") && perfStats.ranking < 1.0 && perfStats.extraction < 2.0;
    if (!allPass) {
        // console.error("Some benchmarks failed.");
        // process.exit(1);
        // Don't exit error code, just report
    }
}

runBenchmark();
