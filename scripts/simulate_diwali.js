import { processUpAheadData } from '../src/services/upAheadService.js';
import diwali2025News from '../test_data/diwali_2025.js';
import plannerStorage from '../src/utils/plannerStorage.js';

// Mock localStorage
const store = {};
global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; }
};

// Mock Planner Storage to prevent actual writes
plannerStorage.merge = () => {};
plannerStorage.getUpcomingDays = () => [];
plannerStorage.getBlacklist = () => new Set();

const items = diwali2025News.map((n, i) => ({
    ...n,
    id: `news-${i}`,
    pubDate: new Date(n.pubDate),
    category: 'general' // Let detectCategory figure it out in real flow, but for now we might need to simulate detection if not integrated here.
    // Wait, processUpAheadData expects items ALREADY normalized/categorized by `normalizeUpAheadItem`?
    // Let's check `upAheadService.js`. Yes, `processUpAheadData` takes `rawItems` which already have `category` and `extractedDate`.
    // So I need to simulate `normalizeUpAheadItem` logic too?
}));

// We need to import `normalizeUpAheadItem` to make this realistic.
import { normalizeUpAheadItem } from '../src/services/upAheadService.js';

const settings = {
    upAhead: {
        keywords: {}, // Use defaults
        signals: []
    }
};

console.log("--- SIMULATING DIWALI 2025 (Oct 15, 2025) ---");

// normalize items first
const normalizedItems = items.map(item => normalizeUpAheadItem(item, { category: null, type: 'search' }));

// Set "Today" to Oct 15, 2025 for logic context?
// `processUpAheadData` uses `new Date()` internally for "today".
// I need to override Date constructor or modify `processUpAheadData` to accept a reference date.
// Since I can't easily change `processUpAheadData` without modifying source,
// I will temporarily Monkey Patch the Date object for this script execution.

const OriginalDate = Date;
class MockDate extends Date {
    constructor(...args) {
        if (args.length === 0) {
            super("2025-10-15T10:00:00Z"); // Mock Today
        } else {
            super(...args);
        }
    }
    static now() {
        return new MockDate().getTime();
    }
}
global.Date = MockDate;

const result = processUpAheadData(normalizedItems, settings);

console.log("\n--- 'Releasing Soon' (Movies Tab) ---");
(result.sections.movies || []).forEach(m => console.log(`[${m.releaseDate}] ${m.title}`));

console.log("\n--- 'Offers & Deals' (Shopping Tab) ---");
(result.sections.shopping || []).forEach(s => console.log(`[${s.releaseDate}] ${s.title}`));
(result.sections.airlines || []).forEach(s => console.log(`[${s.releaseDate}] ${s.title}`));

console.log("\n--- 'Plan My Week' (Timeline) ---");
(result.weekly_plan || []).forEach(day => {
    if (day.items.length > 0) {
        console.log(`\n${day.day} (${day.date}):`);
        day.items.forEach(i => console.log(`  - ${i.title} [${i.type}]`));
    }
});

// Restore Date
global.Date = OriginalDate;

// Verification Logic
const movies = (result.sections.movies || []).map(m => m.title);
const shopping = (result.sections.shopping || []).map(s => s.title);
const airlines = (result.sections.airlines || []).map(s => s.title);

const hasThalapathy = movies.some(t => t.includes("Thalapathy 69"));
const hasKaithi = movies.some(t => t.includes("Kaithi 2"));
const hasSuriya = movies.some(t => t.includes("Suriya 44"));

const hasAmazon = shopping.some(t => t.includes("Amazon"));
const hasIndigo = airlines.some(t => t.includes("Indigo")) || shopping.some(t => t.includes("Indigo")); // Might be in shopping if airlines tab not separate or merged

const hasArrest = result.timeline.some(d => d.items.some(i => i.title.includes("arrested")));
const hasGossip = movies.some(t => t.includes("Trisha opens up"));

console.log("\n--- VERIFICATION ---");
console.log(`Thalapathy 69 found? ${hasThalapathy}`);
console.log(`Kaithi 2 found? ${hasKaithi}`);
console.log(`Suriya 44 found? ${hasSuriya}`);
console.log(`Amazon Offer found? ${hasAmazon}`);
console.log(`Indigo Offer found? ${hasIndigo}`);
console.log(`Arrest news filtered out? ${!hasArrest}`);
console.log(`Gossip filtered out? ${!hasGossip}`);

if (hasThalapathy && hasKaithi && hasSuriya && hasAmazon && hasIndigo && !hasArrest && !hasGossip) {
    console.log("SUCCESS: Diwali Simulation Passed!");
} else {
    console.log("FAILURE: Check logic.");
}
