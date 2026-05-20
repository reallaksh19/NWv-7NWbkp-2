/**
 * Planner Benchmark Runner — validates classification, date parsing, location mapping, eligibility
 * Usage: import and call runPlannerBenchmark() from browser console or test page
 */
import { ITEMS, EXPECTED_OUTCOMES, buildPlannerBenchmarkItems } from './plannerBenchmark.js';
import { buildCanonicalItems } from '../intelligence/canonicalItemBuilder.js';

export async function runPlannerBenchmark() {
  const rawItems = buildPlannerBenchmarkItems();
  console.log(`[PlannerBench] Starting with ${rawItems.length} items`);

  const results = { pass: 0, fail: 0, warnings: [], details: {} };

  // ── Step 1: Run canonical builder ─────────────────────────────────────
  const canonical = buildCanonicalItems(rawItems, {
    asOfDate: new Date(),
    plannerWindowDays: 14,
    selectedCities: ['Chennai', 'Muscat', 'Trichy'],
  });

  console.log(`[PlannerBench] Built ${canonical.length} canonical items`);

  // ── Step 2: Category classification accuracy ──────────────────────────
  const baseItems = ITEMS.filter(i => i.category && !i._isDuplicateOf);
  let correctCategory = 0;
  for (const expected of baseItems) {
    const match = canonical.find(c =>
      c.title === expected.title || c.rawSourceId === expected.id
    );
    if (!match) continue;
    if (match.category === expected.category) correctCategory++;
    else results.warnings.push(`Category mismatch: "${expected.title.slice(0,40)}..." got=${match.category} expected=${expected.category}`);
  }
  const catAcc = baseItems.length > 0 ? correctCategory / baseItems.length : 0;
  const catTarget = EXPECTED_OUTCOMES.accuracyTargets.categoryClassification;
  if (catAcc >= catTarget) {
    results.pass++;
    results.details.category = `PASS: ${(catAcc*100).toFixed(0)}% category accuracy (${correctCategory}/${baseItems.length})`;
  } else {
    results.fail++;
    results.details.category = `FAIL: ${(catAcc*100).toFixed(0)}% category accuracy (target ${catTarget*100}%)`;
  }

  // ── Step 3: Location mapping accuracy ─────────────────────────────────
  const locTests = EXPECTED_OUTCOMES.locationMappingTests;
  let correctLoc = 0;
  for (const test of locTests) {
    // Find any item mentioning the input location alias
    const match = canonical.find(c =>
      (c.title + ' ' + c.description).toLowerCase().includes(test.input.toLowerCase())
    );
    if (!match) { results.warnings.push(`Location test: no item contains "${test.input}"`); continue; }
    if (match.locationCanonical === test.expected) correctLoc++;
    else results.warnings.push(`Location: "${test.input}" → got=${match.locationCanonical}, expected=${test.expected}`);
  }
  const locAcc = locTests.length > 0 ? correctLoc / locTests.length : 0;
  if (locAcc >= EXPECTED_OUTCOMES.accuracyTargets.locationMapping) {
    results.pass++;
    results.details.location = `PASS: ${(locAcc*100).toFixed(0)}% location accuracy (${correctLoc}/${locTests.length})`;
  } else {
    results.fail++;
    results.details.location = `FAIL: ${(locAcc*100).toFixed(0)}% location accuracy`;
  }

  // ── Step 4: Date extraction accuracy ──────────────────────────────────
  const dateItems = ITEMS.filter(i => i.expectedDateConf && !i._isDuplicateOf && !i._noise);
  let correctDate = 0;
  for (const expected of dateItems) {
    const match = canonical.find(c => c.title === expected.title);
    if (!match) continue;
    // Check date confidence matches expected
    if (match.dateConfidence === expected.expectedDateConf) correctDate++;
    else if (expected.expectedDateConf === 'exact' && ['exact','explicit','inferred'].includes(match.dateConfidence)) correctDate++; // close enough
    else results.warnings.push(`Date: "${expected.title.slice(0,40)}..." conf=${match.dateConfidence} expected=${expected.expectedDateConf}`);
  }
  const dateAcc = dateItems.length > 0 ? correctDate / dateItems.length : 0;
  if (dateAcc >= EXPECTED_OUTCOMES.accuracyTargets.dateExtraction) {
    results.pass++;
    results.details.date = `PASS: ${(dateAcc*100).toFixed(0)}% date accuracy (${correctDate}/${dateItems.length})`;
  } else {
    results.fail++;
    results.details.date = `FAIL: ${(dateAcc*100).toFixed(0)}% date accuracy`;
  }

  // ── Step 5: Eligibility accuracy ──────────────────────────────────────
  const eligItems = ITEMS.filter(i => typeof i.expectedEligible === 'boolean' && !i._isDuplicateOf);
  let correctElig = 0;
  for (const expected of eligItems) {
    const match = canonical.find(c => c.title === expected.title);
    if (!match) continue;
    const actualElig = match.upAheadEligible || match.plannerEligible || false;
    if (actualElig === expected.expectedEligible) correctElig++;
    else results.warnings.push(`Eligibility: "${expected.title.slice(0,40)}..." got=${actualElig} expected=${expected.expectedEligible}`);
  }
  const eligAcc = eligItems.length > 0 ? correctElig / eligItems.length : 0;
  if (eligAcc >= EXPECTED_OUTCOMES.accuracyTargets.eligibilityAccuracy) {
    results.pass++;
    results.details.eligibility = `PASS: ${(eligAcc*100).toFixed(0)}% eligibility accuracy (${correctElig}/${eligItems.length})`;
  } else {
    results.fail++;
    results.details.eligibility = `FAIL: ${(eligAcc*100).toFixed(0)}% eligibility accuracy`;
  }

  // ── Step 6: Noise filtering ───────────────────────────────────────────
  const noiseItems = ITEMS.filter(i => i._noise);
  let noiseFiltered = 0;
  for (const noise of noiseItems) {
    const match = canonical.find(c => c.title === noise.title);
    if (!match || (!match.upAheadEligible && !match.plannerEligible)) noiseFiltered++;
  }
  const noiseRate = noiseItems.length > 0 ? noiseFiltered / noiseItems.length : 1;
  if (noiseRate >= EXPECTED_OUTCOMES.accuracyTargets.noiseFilterRate) {
    results.pass++;
    results.details.noise = `PASS: ${(noiseRate*100).toFixed(0)}% noise filtered`;
  } else {
    results.fail++;
    results.details.noise = `FAIL: ${(noiseRate*100).toFixed(0)}% noise filtered`;
  }

  // ── Step 7: Past event filter ─────────────────────────────────────────
  const pastEvents = EXPECTED_OUTCOMES.pastEventFilter;
  let pastFiltered = 0;
  for (const pastId of pastEvents) {
    const match = canonical.find(c => c.rawSourceId === pastId || c.title?.includes('last week'));
    if (!match || !match.upAheadEligible) pastFiltered++;
  }
  if (pastFiltered === pastEvents.length) {
    results.pass++;
    results.details.pastFilter = `PASS: All ${pastEvents.length} past events filtered`;
  } else {
    results.fail++;
    results.details.pastFilter = `FAIL: ${pastFiltered}/${pastEvents.length} past events filtered`;
  }

  // ── Summary ───────────────────────────────────────────────────────────
  results.summary = `${results.pass}/${results.pass + results.fail} checks passed`;
  console.log(`[PlannerBench] ${results.summary}`);
  console.table(results.details);
  if (results.warnings.length > 0) {
    console.groupCollapsed(`[PlannerBench] ${results.warnings.length} warnings`);
    results.warnings.forEach(w => console.warn(w));
    console.groupEnd();
  }
  return results;
}
