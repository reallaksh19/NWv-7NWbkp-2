import { runInsightPipeline, applyIncrementalUpdate, DEFAULT_CONFIG, normalizeStory } from '../insight/src/index.ts';
import { fetchStoriesForSlot as fetchRawStoriesForSlot } from './newsFetcher.js';
import { getEmbeddings } from './embeddingsAdapter.js';
import { extractEntities, extractVerbs, extractNumbers, extractKeywords } from './nlpAdapter.js';
import { loadInsightSnapshot, createSnapshotRawFetcher } from './insightSnapshotFetcher.js';
import { getInsightSnapshotSignals } from './insightSnapshotSignalAdapter.js';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities.js';

async function normalizeRawStories(rawStories, slot, cfg = DEFAULT_CONFIG) {
  if (!Array.isArray(rawStories) || rawStories.length === 0) return [];

  const validRawStories = rawStories
    .map((story) => ({
      ...story,
      publishedAt: Number(story?.publishedAt || 0),
      sourceGroup: story?.sourceGroup || story?.source || 'unknown',
      summary: story?.summary || story?.description || '',
      url: story?.url || story?.link || '',
    }))
    .filter((story) => story.title && story.url && Number.isFinite(story.publishedAt) && story.publishedAt > 0);

  if (validRawStories.length === 0) return [];

  const texts = validRawStories.map((story) => `${story.title || ''} ${story.summary || ''}`.trim());
  const embeddings = await getEmbeddings(texts);

  const enriched = await Promise.all(validRawStories.map(async (raw, index) => {
    const text = texts[index];
    const collectorSignals = getInsightSnapshotSignals(raw);
    const [entities, keywords, verbs, numbers] = collectorSignals.hasCollectorSignals
      ? [
          collectorSignals.entities,
          collectorSignals.keywords,
          collectorSignals.verbs,
          collectorSignals.numbers,
        ]
      : await Promise.all([
          extractEntities(text),
          extractKeywords(text),
          extractVerbs(text),
          extractNumbers(text),
        ]);

    return normalizeStory(
      {
        ...raw,
        angleHints: collectorSignals.angleHints,
        storySignals: {
          ...(raw.storySignals || {}),
          topicTokens: collectorSignals.topicTokens,
          numbers,
          angleHints: collectorSignals.angleHints,
        },
      },
      slot,
      cfg,
      embeddings[index],
      entities,
      keywords,
      verbs,
      numbers,
    );
  }));

  return enriched.filter(Boolean);
}

export async function slotFetcher(slot) {
  const rawStories = await fetchRawStoriesForSlot(slot);
  return normalizeRawStories(rawStories, slot, DEFAULT_CONFIG);
}

function createNormalizedSnapshotFetcher(snapshot, cfg = DEFAULT_CONFIG) {
  const rawFetcher = createSnapshotRawFetcher(snapshot);
  return async (slot) => normalizeRawStories(await rawFetcher(slot), slot, cfg);
}

export { runInsightPipeline, applyIncrementalUpdate, DEFAULT_CONFIG };

/**
 * createInsightFetcher — returns the appropriate SlotFetcher depending on runtime.
 *
 * On github.io (preferSnapshots = true):
 *   1. Try fresh snapshot  (file age ≤ 8 h)
 *   2. Try stale snapshot  (any age — used with warning)
 *   3. Empty state         (never falls back to live CORS proxies)
 *
 * On full-runtime (local / self-hosted):
 *   Returns the live slotFetcher as before.
 *
 * @returns {Promise<{ fetcher: Function, source: string, snapshotTs: number, contentHash: string }>}
 */
export async function createInsightFetcher() {
  const { preferSnapshots } = getRuntimeCapabilities();

  if (preferSnapshots) {
    const fresh = await loadInsightSnapshot({ allowStale: false });
    if (fresh) {
      return {
        fetcher:     createNormalizedSnapshotFetcher(fresh, DEFAULT_CONFIG),
        source:      'snapshot',
        snapshotTs:  fresh.fetchedAt,
        contentHash: fresh.contentHash,
        snapshotRuntimeSummary: fresh.runtimeSummary,
      };
    }

    const stale = await loadInsightSnapshot({ allowStale: true });
    if (stale) {
      console.warn('[InsightFetcher] Using stale snapshot — fresh snapshot unavailable');
      const staleConfig = {
        ...DEFAULT_CONFIG,
        WEAK_TREE_CHILD_MIN: 1,
        MIN_SOURCES_PER_TREE: 1,
        TIER_D_EXCLUDE: false,
      };
      return {
        fetcher:     createNormalizedSnapshotFetcher(stale, staleConfig),
        source:      'stale-snapshot',
        snapshotTs:  stale.fetchedAt,
        contentHash: stale.contentHash,
        snapshotRuntimeSummary: stale.runtimeSummary,
        pipelineConfigOverrides: {
          WEAK_TREE_CHILD_MIN: 1,
          MIN_SOURCES_PER_TREE: 1,
          TIER_D_EXCLUDE: false,
        },
      };
    }

    // No snapshot available — return empty state (never hit live APIs on static host)
    return {
      fetcher:     async () => [],
      source:      'unavailable',
      snapshotTs:  0,
      contentHash: '',
    };
  }

  // Full-runtime: use live slotFetcher
  return {
    fetcher:     slotFetcher,
    source:      'live',
    snapshotTs:  Date.now(),
    contentHash: '',
  };
}

import { buildInsightBenchmarkArticles } from '../benchmarks/insightBenchmark.js';

// ── Benchmark slot fetcher (dev mode only) ────────────────────────────────
export const benchmarkSlotFetcher = async (slot) => {
  const all = buildInsightBenchmarkArticles();
  const NOW = Date.now();
  const H   = 3_600_000;
  return all.filter(a => {
    const age = NOW - a.publishedAt;
    switch (slot) {
      case 'now'      : return age < 4 * H;
      case 'minus4h'  : return age >= 4 * H  && age < 12 * H;
      case 'minus12h' : return age >= 12 * H && age < 24 * H;
      case 'minus24h' : return age >= 24 * H && age < 36 * H;
      default         : return true;
    }
  });
};
