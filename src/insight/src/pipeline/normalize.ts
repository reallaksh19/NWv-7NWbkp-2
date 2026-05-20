// ─────────────────────────────────────────────
//  INSIGHT TAB — Story Normalization
// ─────────────────────────────────────────────

import { RawStory, InsightStory, SourceTier, SnapshotSlot, InsightConfig } from "../types";

// ── Source tier registry ──────────────────────────────────────────────────────

const TIER_MAP: Record<string, SourceTier> = {
  // Tier A
  reuters:           "A", ap:             "A", bbc:           "A",
  bloomberg:         "A", ft:             "A", "financial express": "A",
  "the hindu":       "A", "hindu":        "A",

  // Tier B
  ndtv:              "B", toi:            "B", "times of india": "B",
  moneycontrol:      "B", cnbc:           "B", "oman observer":  "B",

  // Tier C — admitted only as fallback
  // (everything else defaults to C)
};

const CLICKBAIT_PATTERNS = [
  /you won'?t believe/i,
  /shocking(ly)?/i,
  /goes viral/i,
  /breaks the internet/i,
  /this changes everything/i,
  /\bOMG\b/,
  /^\d+ (things|reasons|ways) /i,
];

const TIER_AUTHORITY: Record<SourceTier, number> = {
  A: 1.0, B: 0.75, C: 0.45, D: 0.0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getSourceTier(sourceGroup: string): SourceTier {
  const key = sourceGroup.toLowerCase().trim();
  return TIER_MAP[key] ?? "C";
}

export function isTierD(story: RawStory): boolean {
  // No byline signal (can be extended with actual byline field)
  const title = story.title ?? "";
  if (CLICKBAIT_PATTERNS.some(p => p.test(title))) return true;
  if (!story.source || story.source.trim() === "") return true;
  return false;
}

/**
 * Recency decay: smooth curve, not binary cutoff.
 */
export function computeFreshnessScore(publishedAt: number): number {
  const ageHours = (Date.now() - publishedAt) / (60 * 60 * 1000);
  if (ageHours <= 2)  return 1.0;
  if (ageHours <= 6)  return 0.90;
  if (ageHours <= 12) return 0.75;
  if (ageHours <= 18) return 0.60;
  if (ageHours <= 24) return 0.45;
  return 0.0; // older than 24h for freshness purposes; 48h hard cutoff enforced in pipeline
}

/**
 * Simple canonical URL: strip query params used for tracking.
 */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const TRACKING_PARAMS = [
      "utm_source","utm_medium","utm_campaign","utm_content","utm_term",
      "ref","source","cid","fbclid","gclid","msclkid","_ga",
    ];
    TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Fast 32-bit hash for dedup comparison.
 */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/**
 * Normalize title+summary into a canonical text for hashing/comparison.
 */
export function makeCanonicalText(title: string, summary: string): string {
  return (title + " " + summary)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristic factual density: ratio of entity+number tokens to total words.
 */
export function computeFactualDensity(story: RawStory, numbers: string[], entities: string[]): number {
  const words = (story.title + " " + story.summary).split(/\s+/).length;
  const signals = numbers.length + entities.length;
  return Math.min(1, signals / Math.max(1, words / 5));
}

/**
 * Summary quality: penalize very short or very long summaries.
 */
export function computeSummaryQuality(summary: string): number {
  const words = summary.split(/\s+/).length;
  if (words < 10) return 0.3;
  if (words < 20) return 0.6;
  if (words <= 80) return 1.0;
  if (words <= 120) return 0.8;
  return 0.5;
}

// ── Main normalizer ───────────────────────────────────────────────────────────

/**
 * Converts a RawStory into a full InsightStory with all scoring fields.
 * Embedding must be injected externally (e.g. from an embeddings service).
 */
export function normalizeStory(
  raw: RawStory,
  slot: SnapshotSlot,
  cfg: InsightConfig,
  embedding: number[],
  extractedEntities: InsightStory["entities"],
  extractedKeywords: string[],
  extractedVerbs: string[],
  extractedNumbers: string[],
): InsightStory | null {
  const ageHours = (Date.now() - raw.publishedAt) / (60 * 60 * 1000);
  if (ageHours > cfg.MAX_STORY_AGE_HOURS) return null;

  if (cfg.TIER_D_EXCLUDE && isTierD(raw)) return null;

  const tier = getSourceTier(raw.sourceGroup);
  if (cfg.TIER_D_EXCLUDE && tier === "D") return null;

  const canonicalText = makeCanonicalText(raw.title, raw.summary);
  const allEntities = [
    ...extractedEntities.people,
    ...extractedEntities.orgs,
    ...extractedEntities.places,
  ];

  return {
    ...raw,
    capturedAtSnapshot: slot,
    canonicalUrl: canonicalizeUrl(raw.url),
    canonicalText,
    canonicalTextHash: hashString(canonicalText),
    entities: extractedEntities,
    keywords: extractedKeywords,
    embedding,
    eventVerbs: extractedVerbs,
    numbers: extractedNumbers,
    sourceTier: tier,
    sourceAuthority: TIER_AUTHORITY[tier],
    freshnessScore: computeFreshnessScore(raw.publishedAt),
    rawProminence: 0.5, // override from source placement data if available
    sentiment: 0,       // override from sentiment model if available
    factualDensity: computeFactualDensity(raw, extractedNumbers, allEntities),
    summaryQuality: computeSummaryQuality(raw.summary),
  };
}

/**
 * Tier C fallback filter:
 * If TIER_C_FALLBACK is true, remove Tier C stories for any event
 * cluster that already has at least one Tier A or B story.
 * Applied after clustering.
 */
export function applyTierCFallback(
  stories: InsightStory[],
  cfg: InsightConfig
): InsightStory[] {
  if (!cfg.TIER_C_FALLBACK) return stories;

  // Group by parentId
  const byParent = new Map<string, InsightStory[]>();
  for (const s of stories) {
    const pid = s.parentId ?? "__none__";
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(s);
  }

  const result: InsightStory[] = [];
  for (const [, group] of byParent) {
    const hasHighTier = group.some(s => s.sourceTier === "A" || s.sourceTier === "B");
    if (hasHighTier) {
      result.push(...group.filter(s => s.sourceTier !== "C"));
    } else {
      result.push(...group);
    }
  }
  return result;
}
