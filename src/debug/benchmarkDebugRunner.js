import { buildCanonicalItems, summarizeCanonicalItems } from '../intelligence/canonicalItemBuilder.js';
import { deduplicateCanonicalItems } from '../intelligence/deDuplication.js';
import { rankEligibleItems } from '../intelligence/eligibilityWindowing.js';
import { summarizeDecisionRecords, buildDropReport } from '../intelligence/explainabilityAudit.js';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemIdentity(item) {
  if (!item) return '';
  return String(
    normalizeText(item.title || item.canonical_title || '') ||
    item.canonicalId ||
    item.hiddenKey ||
    item.id
  ).trim();
}

function identitiesFromExpected(expectedItems = []) {
  return new Set((expectedItems || []).map(item => {
    if (typeof item === 'string') return normalizeText(item);
    return itemIdentity(item);
  }).filter(Boolean));
}

function compareSetMetrics(actualItems = [], expectedItems = []) {
  const actualIds = new Set((actualItems || []).map(itemIdentity).filter(Boolean));
  const expectedIds = identitiesFromExpected(expectedItems);

  let truePositive = 0;
  for (const id of actualIds) {
    if (expectedIds.has(id)) truePositive += 1;
  }

  const precision = actualIds.size ? truePositive / actualIds.size : 0;
  const recall = expectedIds.size ? truePositive / expectedIds.size : 0;
  const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;

  const missing = [...expectedIds].filter(id => !actualIds.has(id));
  const unexpected = [...actualIds].filter(id => !expectedIds.has(id));

  // Advanced Debugging Phase 2: Dump unexpected items for classification debugging
  for (const item of actualItems || []) {
      const id = itemIdentity(item);
      if (unexpected.includes(id)) {
          // Find expected category if possible
          let expectedCategory = 'unknown';
          const matchedExpected = (expectedItems || []).find(e => 
              (typeof e === 'string' ? normalizeText(e) : itemIdentity(e)) === id
          );
          if (matchedExpected && matchedExpected.category) {
              expectedCategory = matchedExpected.category;
          }

          console.log('\n[DEBUG: Unexpected Classification / Inclusion]');
          console.log({
              title: item.title,
              chosen: item.category,
              expected: expectedCategory,
              breakdown: item.classificationBreakdown,
              sourceType: item.sourceType,
              sourceTrust: item.sourceTrust,
              decisionTrace: item.decisionTrace
          });
      }
  }

  return {
    actualCount: actualIds.size,
    expectedCount: expectedIds.size,
    truePositive,
    precision,
    recall,
    f1,
    missing,
    unexpected
  };
}

function bucketByCategory(items = []) {
  const out = {};
  for (const item of items || []) {
    const key = String(item?.category || 'unknown');
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}

function buildTimelineView(items = []) {
  const grouped = new Map();
  for (const item of items || []) {
    const dateKey = item?.eventDateKey || null;
    if (!dateKey) continue;
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey).push(item);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dayItems]) => ({
      date,
      itemIds: dayItems.map(itemIdentity),
      items: dayItems
    }));
}

export function runUpAheadBenchmark(rawItems = [], expected = {}, options = {}) {
  const canonicalItems = buildCanonicalItems(rawItems, options);
  const canonicalSummary = summarizeCanonicalItems(canonicalItems);

  // Advanced Debugging Phase 4: Location Diagnostic Logging
  for (const item of canonicalItems || []) {
      if (item.dropReason === 'location_mismatch' || item.locationDecisionTrace?.some(t => t.includes('online_location_bypass'))) {
          // console.log('\n[DEBUG: Location Routing Decision]');
          // console.log({
          //     title: item.title,
          //     category: item.category,
          //     mode: options.mode,
          //     selectedCities: options.selectedCities,
          //     locationCanonical: item.locationCanonical,
          //     locationConfidence: item.locationConfidence,
          //     decisionTrace: item.locationDecisionTrace,
          //     dropReason: item.dropReason
          // });
      }
  }

  // Advanced Debugging Phase 3: Dump date evidence for planner eligible
  /*
  for (const item of canonicalItems || []) {
      if (item.plannerEligible || item.routeTarget === 'planner') {
          console.log('\n[DEBUG: Planner Candidate Date Evidence]');
          console.log({
            title: item.title,
            parser: item.parsedDateEvidence?.parser,
            matchedText: item.parsedDateEvidence?.matchedText,
            dateConfidence: item.dateConfidence,
            routeTarget: item.routeTarget,
            eventDateKey: item.eventDateKey,
            publishDate: item.publishDate,
            dropReason: item.dropReason
          });
      }
  }
  */
  const dedupedItems = deduplicateCanonicalItems(canonicalItems, options.dedupeOptions || {});
  
  // Advanced Debugging Phase 5: Deduplication Logging
  /*
  for (const item of dedupedItems || []) {
      if (item.dedupeDecision === 'merged_duplicate_pair') {
          console.log('\n[DEBUG: Deduplication Merge]');
          console.log({
              title: item.title,
              mergedWith: item.mergedWith,
              sources: item.sources
          });
      }
  }
  */

  const surfacedItems = rankEligibleItems(dedupedItems.filter(item => item.upAheadEligible || item.plannerEligible));
  const plannerItems = surfacedItems.filter(item => item.plannerEligible);
  const upAheadItems = surfacedItems.filter(item => item.upAheadEligible);

  const byCategory = bucketByCategory(upAheadItems);
  const expectedPlanner = expected?.planner || expected?.weekly_plan || [];
  const expectedUpAhead = expected?.upAhead || expected?.events || expected?.surfaced || [];

  const metrics = {
    planner: compareSetMetrics(plannerItems, expectedPlanner),
    upAhead: compareSetMetrics(upAheadItems, expectedUpAhead),
    byCategory: {}
  };

  const expectedByCategory = expected?.byCategory || {};
  for (const [category, items] of Object.entries(byCategory)) {
    metrics.byCategory[category] = compareSetMetrics(items, expectedByCategory[category] || []);
  }

  const auditSummary = summarizeDecisionRecords(dedupedItems);
  const dropReport = buildDropReport(dedupedItems);
  const timeline = buildTimelineView(upAheadItems);

  return {
    meta: {
      asOfDate: options.asOfDate || new Date().toISOString(),
      plannerWindowDays: Number.isFinite(options.plannerWindowDays) ? options.plannerWindowDays : 7,
      mode: options.mode || 'offline'
    },
    counts: {
      raw: rawItems.length,
      canonical: canonicalItems.length,
      deduped: dedupedItems.length,
      surfaced: surfacedItems.length,
      planner: plannerItems.length,
      upAhead: upAheadItems.length
    },
    canonicalSummary,
    metrics,
    auditSummary,
    dropReport,
    timeline,
    surfacedItems,
    plannerItems,
    upAheadItems,
    categoryBuckets: Object.fromEntries(
      Object.entries(byCategory).map(([category, items]) => [category, items.map(itemIdentity)])
    )
  };
}

export async function loadJsonFixture(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load fixture: ${url}`);
  }
  return response.json();
}

export async function runUpAheadBenchmarkFromUrls({ inputUrl, expectedUrl, ...options }) {
  const [rawItems, expected] = await Promise.all([
    loadJsonFixture(inputUrl),
    expectedUrl ? loadJsonFixture(expectedUrl) : Promise.resolve({})
  ]);

  const normalizedInput = Array.isArray(rawItems) ? rawItems : (rawItems?.items || rawItems?.rawItems || []);
  return runUpAheadBenchmark(normalizedInput, expected, options);
}
