import { proxyManager } from './proxyManager.js';
import { buildFeedFetchPlan } from '../intelligence/feedSourceRegistry.js';
import { recordFeedResult } from '../intelligence/feedHealthMonitor.js';
import { filterUnseenFeedItems, markSeenFeedItems, pruneIngestionLedger } from '../intelligence/ingestionCheckpointLedger.js';
import { buildCanonicalItems } from '../intelligence/canonicalItemBuilder.js';
import { deduplicateCanonicalItems } from '../intelligence/deDuplication.js';
import { rankEligibleItems } from '../intelligence/eligibilityWindowing.js';
import { summarizeDecisionRecords, buildDropReport } from '../intelligence/explainabilityAudit.js';
import { getRuntimeCapabilities } from "../runtime/runtimeCapabilities.js";

function isStaticHostRuntime() { return getRuntimeCapabilities().isStaticHost; }

function normalizeRawFeedItem(item, sourceMeta = {}) {
  return {
    guid: item?.guid || item?.id || null,
    id: item?.id || item?.guid || item?.link || null,
    title: item?.title || '',
    description: item?.description || item?.summary || item?.contentSnippet || '',
    summary: item?.summary || item?.description || '',
    contentSnippet: item?.contentSnippet || '',
    link: item?.link || item?.url || '',
    pubDate: item?.pubDate || item?.publishDate || item?.isoDate || null,
    source: sourceMeta.url,
    sourcePack: `${sourceMeta.category || 'unknown'}:${sourceMeta.location || 'unknown'}`,
    feedPack: `${sourceMeta.category || 'unknown'}:${sourceMeta.location || 'unknown'}`,
    category: sourceMeta.category || null,
    location: sourceMeta.location || null,
    rawSource: sourceMeta.url,
    sourceTypeHint: sourceMeta.sourceType || null,
    sourceTrustHint: sourceMeta.trust || null
  };
}

export async function fetchIntelligentUpAheadData(options = {}) {
  const categories = options.categories || ['movies', 'events', 'festivals', 'alerts', 'weather_alerts', 'shopping', 'airlines'];
  const locations = options.locations || ['Chennai', 'Muscat', 'Trichy'];
  const plannerWindowDays = Number.isFinite(options.plannerWindowDays) ? options.plannerWindowDays : 7;
  const asOfDate = options.asOfDate || new Date();

  pruneIngestionLedger(options.ledgerMaxAgeDays || 30);
  let fetchPlan = buildFeedFetchPlan({ categories, locations, registry: options.registry, isStaticHost: isStaticHostRuntime() });

  const rawCollected = [];
  for (const planEntry of fetchPlan) {
    for (const source of planEntry.sources || []) {
      try {
        const response = await proxyManager.fetchViaProxy(source.url);
        const unseen = filterUnseenFeedItems(source.url, response?.items || []);
        recordFeedResult(source.url, unseen.length > 0);
        if (unseen.length > 0) {
          rawCollected.push(...unseen.map(item => normalizeRawFeedItem(item, source)));
          markSeenFeedItems(source.url, unseen);
        }
      } catch (error) {
        recordFeedResult(source.url, false);
        rawCollected.push({
          title: '', description: '', link: '', pubDate: null, category: source.category, source: source.url, rawSource: source.url,
          decisionTrace: [`fetch_failed:${source.url}`, `error:${error?.message || 'unknown'}`], dropReason: 'fetch_failed'
        });
      }
    }
  }

  const canonicalItems = buildCanonicalItems(rawCollected, {
    asOfDate,
    plannerWindowDays,
    mode: options.mode || 'offline',
    selectedCities: locations,
    settings: options.settings,
    locationLibrary: options.locationLibrary,
    sourceTrustOptions: options.sourceTrustOptions
  });

  const deduped = deduplicateCanonicalItems(canonicalItems, options.dedupeOptions || {});
  const ranked = rankEligibleItems(deduped.filter(item => item.upAheadEligible || item.plannerEligible));
  return {
    rawCount: rawCollected.length,
    canonicalCount: canonicalItems.length,
    dedupedCount: deduped.length,
    rankedItems: ranked,
    auditSummary: summarizeDecisionRecords(deduped),
    dropReport: buildDropReport(deduped),
    fetchPlan
  };
}
