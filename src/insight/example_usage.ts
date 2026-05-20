// ─────────────────────────────────────────────
//  INSIGHT TAB — Usage Example
// ─────────────────────────────────────────────
//
//  This file shows how to wire the pipeline to your actual data sources.
//  Replace the stub implementations with your real embeddings service,
//  NLP extractor, and news API calls.
//
// ─────────────────────────────────────────────

import {
  runInsightPipeline,
  applyIncrementalUpdate,
  DEFAULT_CONFIG,
  InsightConfig,
  InsightStory,
  SnapshotSlot,
  InsightRunResult,
  normalizeStory,
} from "./src/index";

// ── 1. Override config if needed ──────────────────────────────────────────────

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  TOP_PARENTS:          5,
  MAX_CHILDREN_PER_PARENT: 7,
  REGION_TAGS:          ["chennai", "trichy", "tamil nadu", "tn", "muscat"],
  REGION_BOOST:         0.04,   // slightly stronger local boost
};

// ── 2. Implement the slot fetcher ─────────────────────────────────────────────
//
//  This is called by the pipeline for each slot that needs a fresh fetch.
//  It must return fully normalized InsightStory objects.
//
//  The normalization step requires:
//    - An embedding from your embeddings service (e.g. all-MiniLM-L6-v2 via local server,
//      or OpenAI text-embedding-3-small, etc.)
//    - Entity extraction (spaCy, Duckling, or an LLM prompt)
//    - Keyword/verb/number extraction
//
//  All of these are left as stubs below. Swap them out for your actual services.

async function fetchStoriesForSlot(slot: SnapshotSlot): Promise<InsightStory[]> {
  const targetTime = slotToTimestamp(slot);

  // ── Fetch raw stories from your news aggregator ───────────────────────────
  const rawStories = await fetchRawNewsAround(targetTime);

  // ── Enrich each story ─────────────────────────────────────────────────────
  const enriched: InsightStory[] = [];

  for (const raw of rawStories) {
    const [embedding, entities, keywords, verbs, numbers] = await Promise.all([
      getEmbedding(raw.title + " " + raw.summary),
      extractEntities(raw.title + " " + raw.summary),
      extractKeywords(raw.title + " " + raw.summary),
      extractVerbs(raw.title + " " + raw.summary),
      extractNumbers(raw.title + " " + raw.summary),
    ]);

    const story = normalizeStory(
      raw,
      slot,
      cfg,
      embedding,
      entities,
      keywords,
      verbs,
      numbers,
    );

    if (story) enriched.push(story);
  }

  return enriched;
}

// ── 3. Run the pipeline ───────────────────────────────────────────────────────

let lastResult: InsightRunResult | null = null;

async function refreshInsights(): Promise<InsightRunResult> {
  const previousSizes = lastResult
    ? new Map(lastResult.parents.map(p => [p.parentId, p.clusterStoryIds.length]))
    : new Map();

  lastResult = await runInsightPipeline(
    fetchStoriesForSlot,
    cfg,
    previousSizes,
    // Optional: background pre-warm callback
    (slot) => {
      console.log(`[Insight] Pre-warming slot: ${slot}`);
      fetchStoriesForSlot(slot).then(stories => {
        // The cache manager will pick this up on next run
      });
    }
  );

  return lastResult;
}

// ── 4. Handle incremental updates (e.g. called every ~5 min for "now" slot) ───

async function handleNewNowStories(newStories: InsightStory[]): Promise<void> {
  if (!lastResult) return;
  lastResult = applyIncrementalUpdate(newStories, lastResult, cfg);
  // Push updated lastResult.parents to your UI
}

// ── 5. Example output structure ───────────────────────────────────────────────

function formatForUI(result: InsightRunResult) {
  return result.parents.map((parent, i) => ({
    rank:           i + 1,
    headline:       parent.canonicalHeadline,
    summary:        parent.canonicalSummary,
    score:          parent.finalParentScore.toFixed(2),
    isRising:       parent.isRising,
    weakTree:       parent.weakTree,
    sourceCount:    [...new Set(parent.clusterStoryIds.map(id => {
                      return result.storiesById.get(id)?.sourceGroup ?? "";
                    }))].filter(Boolean).length,
    hiddenCount:    parent.hiddenDuplicateIds.length,
    snapshots:      parent.snapshotPresence,
    children:       parent.childStoryIds.map(id => {
                      const s = result.storiesById.get(id)!;
                      return {
                        angle:    s.angle,
                        source:   s.source,
                        title:    s.title,
                        summary:  s.summary,
                        timeAgo:  msToHumanAge(Date.now() - s.publishedAt),
                      };
                    }),
    debug:          parent.debug,
  }));
}

function msToHumanAge(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60)   return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ── Stub helpers (replace with real implementations) ─────────────────────────

function slotToTimestamp(slot: SnapshotSlot): number {
  const offsets: Record<SnapshotSlot, number> = {
    now:      0,
    minus4h:  4  * 3600 * 1000,
    minus12h: 12 * 3600 * 1000,
    minus24h: 24 * 3600 * 1000,
  };
  return Date.now() - offsets[slot];
}

async function fetchRawNewsAround(_targetTime: number) {
  // Replace: call your RSS/news API and return RawStory[]
  return [];
}

async function getEmbedding(_text: string): Promise<number[]> {
  // Replace: call your embeddings service
  // e.g. POST http://localhost:8080/embed → { embedding: number[] }
  return new Array(384).fill(0);
}

async function extractEntities(_text: string) {
  // Replace: NLP entity extraction
  return { people: [], orgs: [], places: [], products: [], symbols: [] };
}

async function extractKeywords(_text: string): Promise<string[]> {
  // Replace: keyword extraction
  return [];
}

async function extractVerbs(_text: string): Promise<string[]> {
  // Replace: verb extraction (spaCy, or simple regex)
  return [];
}

async function extractNumbers(_text: string): Promise<string[]> {
  // Replace: number/fact extraction (Duckling or regex)
  const matches = _text.match(/[\d,.]+\s*(billion|million|crore|lakh|%|thousand|cr|mn)?/gi);
  return matches ?? [];
}

export { refreshInsights, handleNewNowStories, formatForUI };
