import fs from 'fs';
import path from 'path';
import { processUpAheadData } from '../src/services/upAheadService.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock Settings
const MOCK_SETTINGS = {
    upAhead: {
        keywords: {
            negative: ['review', 'gossip'],
            movies: ['release', 'theaters'],
            events: ['concert', 'show'],
            shopping: ['sale', 'offer']
        },
        signals: ['tomorrow', 'next week', 'upcoming'],
        ranking: {
            movies: { filterThreshold: 0 }
        }
    },
    hideOlderThanHours: 336 // 14 days
};

// Simulation Configuration
const SIMULATED_TODAY = new Date('2026-01-01T00:00:00Z');

// Override Date constructor to freeze time
const RealDate = Date;
class MockDate extends RealDate {
    constructor(...args) {
        if (args.length) {
            return new RealDate(...args);
        }
        return new RealDate(SIMULATED_TODAY);
    }
    static now() {
        return SIMULATED_TODAY.getTime();
    }
}
global.Date = MockDate;

async function runBenchmark() {
    console.log(`\n--- Running Benchmark (Simulated Date: 2026-01-01) ---`);

    // Load Test Data
    const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, '../test_data/benchmark_articles.json'), 'utf8'));

    // Normalize Data (Simulate what normalizeUpAheadItem does)
    const normalizedItems = rawData.map((item, index) => ({
        id: `mock-${index}`,
        title: item.title,
        description: item.description,
        link: 'http://mock.link',
        pubDate: new Date(item.pubDate),
        category: item.category,
        extractedDate: null // processUpAheadData usually calculates this, we might need to inject the extractor or rely on it running internally if imported
    }));

    // We need to inject the extractDate logic because processUpAheadData expects items to have extractedDate IF normalize ran.
    // However, processUpAheadData calls normalize internally? No, fetchUpAheadData does.
    // Let's import the extractor logic to pre-process.

    // Wait, we need to run the actual extraction logic to test if it catches the dates.
    // We will dynamically import the service functions.
    const { extractFutureDate } = await import('../src/services/upAheadService.js');
    const { extractDate } = await import('../src/utils/dateExtractor.js');

    // Pre-process items
    normalizedItems.forEach(item => {
        const fullText = `${item.title} ${item.description}`;
        // Try new extractor first
        const dateResult = extractDate(fullText, item.pubDate);
        if (dateResult?.start) {
            item.extractedDate = dateResult.start;
        } else {
            // Fallback
            item.extractedDate = extractFutureDate(fullText, item.pubDate);
        }
    });

    console.log(`Loaded ${normalizedItems.length} items.`);

    // Run Processing
    const result = processUpAheadData(normalizedItems, MOCK_SETTINGS);

    // Analyze Results
    console.log(`\n--- Results ---`);
    console.log(`Timeline Items: ${result.timeline.reduce((acc, d) => acc + d.items.length, 0)}`);
    console.log(`Releasing Soon (Movies): ${result.sections.movies.length}`);
    console.log(`Plan My Week (Days): ${result.weekly_plan.filter(d => d.items.length > 0).length}`);

    console.log(`\n--- Detailed Breakdown ---`);

    result.timeline.forEach(day => {
        console.log(`\n[${day.date}] (${day.dayLabel})`);
        day.items.forEach(i => console.log(`  - ${i.title} [${i.type}]`));
    });

    console.log(`\n--- Releasing Soon ---`);
    result.sections.movies.forEach(m => console.log(`  - ${m.title} (${m.releaseDate})`));

    // Verify Expectations
    const expectedIds = [
        "Leo 2", "Jan 3rd",
        "Jan 14", // Pongal
        "Jan 5", // Concert
        "Jan 2", // Rain
        "Jan 7", // Cricket
        "Jan 4", // Mall
        "Jan 6", // Power
        "Jan 2", // Sale
        "Jan 3"  // Book Fair
    ];

    let missing = 0;
    expectedIds.forEach(exp => {
        const found = result.timeline.some(d => d.items.some(i => i.title.includes(exp) || i.description.includes(exp)));
        if (!found) {
            console.error(`❌ MISSING: Item matching '${exp}' not found in timeline.`);
            missing++;
        }
    });

    if (missing === 0) {
        console.log(`\n✅ ALL CRITICAL ITEMS FOUND.`);
    } else {
        console.log(`\n⚠️ ${missing} CRITICAL ITEMS MISSING.`);
    }
}

runBenchmark();
