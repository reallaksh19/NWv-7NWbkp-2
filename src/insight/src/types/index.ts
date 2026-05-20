// ─────────────────────────────────────────────
//  INSIGHT TAB — Core Types
// ─────────────────────────────────────────────

export type SnapshotSlot = "now" | "minus4h" | "minus12h" | "minus24h";

export type SourceTier = "A" | "B" | "C" | "D";

export type AngleLabel =
  | "base_report"
  | "official_response"
  | "market_reaction"
  | "fact_update"
  | "expert_analysis"
  | "regional_followup"
  | "correction"
  | "background_context"
  | "reaction_public"
  | "investigative_detail"
  | "unknown";

export type StoryBucket =
  | "DUPLICATE_OF_EXISTING_CHILD"
  | "ADD_AS_CHILD_TO_EXISTING_PARENT"
  | "MERGE_INTO_PARENT_CANDIDATE_POOL"
  | "NEW_PARENT_CANDIDATE";

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "WARN";

// ── Raw story as ingested from a news source ──────────────────────────────────

export interface RawStory {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceGroup: string;       // e.g. "reuters_group", "toi_group"
  url: string;
  publishedAt: number;       // epoch ms
  category?: string;
  region?: string;
  language?: string;
}

// ── Normalized story after enrichment ────────────────────────────────────────

export interface InsightStory extends RawStory {
  capturedAtSnapshot: SnapshotSlot;
  canonicalUrl: string;
  canonicalText: string;     // normalized title + summary
  canonicalTextHash: string;

  entities: {
    people: string[];
    orgs: string[];
    places: string[];
    products: string[];
    symbols: string[];
  };

  keywords: string[];
  embedding: number[];       // dense vector, e.g. 384-dim
  eventVerbs: string[];      // e.g. ["launches", "bans", "acquires"]
  numbers: string[];         // extracted numeric facts, e.g. ["₹4200Cr", "18%"]

  sourceTier: SourceTier;
  sourceAuthority: number;   // 0..1, derived from tier + editorial score
  freshnessScore: number;    // 0..1, from recency decay
  rawProminence: number;     // 0..1, from source placement / headline rank
  sentiment: number;         // -1..1
  factualDensity: number;    // 0..1, entity+number density
  summaryQuality: number;    // 0..1, length + completeness heuristic

  angle?: AngleLabel;
  bucket?: StoryBucket;
  parentId?: string;
}

// ── Parent insight cluster ────────────────────────────────────────────────────

export interface InsightParent {
  parentId: string;
  canonicalHeadline: string;
  canonicalSummary: string;

  clusterStoryIds: string[];
  childStoryIds: string[];           // selected, max 7
  hiddenDuplicateIds: string[];

  keyEntities: string[];
  keyPlaces: string[];
  keyVerbs: string[];
  keyNumbers: string[];

  firstSeenAt: number;
  latestSeenAt: number;

  snapshotPresence: Record<SnapshotSlot, boolean>;

  // scores
  impactScore: number;
  persistenceScore: number;
  sourceDiversityScore: number;
  noveltyScore: number;
  freshnessScore: number;
  crossSnapshotMomentum: number;
  editorialClarityScore: number;
  regionBoost: number;
  finalParentScore: number;

  isRising: boolean;
  weakTree: boolean;

  debug: ParentDebug;
}

export interface ParentDebug {
  clusterSize: number;
  hiddenCount: number;
  matchedSnapshots: SnapshotSlot[];
  scoreBreakdown: Record<string, number>;
  replacements: Array<{ replacedId: string; replacedBy: string; reason: string }>;
  representativeDiagnostics?: any;
}

// ── Child candidate (internal, during tree build) ────────────────────────────

export interface ChildCandidate {
  story: InsightStory;
  angle: AngleLabel;
  relevanceToParent: number;
  informationGain: number;
  sourceDiversityBonus: number;
  angleUniqueness: number;
  childScore: number;
  admittedBecause?: string[];
}

// ── Cache entry ───────────────────────────────────────────────────────────────

export interface SnapshotCacheEntry {
  slot: SnapshotSlot;
  fetchedAt: number;         // epoch ms
  stories: InsightStory[];
  parents?: InsightParent[]; // if full pipeline was cached
  ttlMs: number;
}

// ── Pipeline config (all tunable constants) ───────────────────────────────────

export interface InsightConfig {
  TOP_PARENTS: number;
  MAX_CHILDREN_PER_PARENT: number;

  HARD_DUP_TITLE_SIM: number;
  HARD_DUP_EMBED_SIM: number;
  SAME_EVENT_THRESHOLD: number;
  POSSIBLE_EVENT_THRESHOLD: number;

  MIN_CHILD_INFO_GAIN: number;
  REPLACE_MARGIN: number;

  MAX_PER_SOURCE_GROUP: number;
  MAX_PER_ANGLE: number;
  MIN_SOURCES_PER_TREE: number;
  WEAK_TREE_CHILD_MIN: number;

  STALE_PENALTY_PER_HOUR: number;
  PREWARM_BEFORE_TTL_MS: number;
  MAX_STORY_AGE_HOURS: number;

  CACHE_TTL: Record<SnapshotSlot, number>;         // ms
  CACHE_TOLERANCE: Record<SnapshotSlot, number>;   // ms

  RISING_THRESHOLD: number;
  REGION_BOOST: number;
  REGION_TAGS: string[];

  TIER_D_EXCLUDE: boolean;
  TIER_C_FALLBACK: boolean;
}

export const DEFAULT_CONFIG: InsightConfig = {
  TOP_PARENTS: 5,
  MAX_CHILDREN_PER_PARENT: 7,

  HARD_DUP_TITLE_SIM: 0.96,
  HARD_DUP_EMBED_SIM: 0.985,
  SAME_EVENT_THRESHOLD: 0.88,
  POSSIBLE_EVENT_THRESHOLD: 0.75,

  MIN_CHILD_INFO_GAIN: 0.22,
  REPLACE_MARGIN: 0.08,

  MAX_PER_SOURCE_GROUP: 2,
  MAX_PER_ANGLE: 3,
  MIN_SOURCES_PER_TREE: 3,
  WEAK_TREE_CHILD_MIN: 3,

  STALE_PENALTY_PER_HOUR: 0.08,
  PREWARM_BEFORE_TTL_MS: 55 * 60 * 1000,
  MAX_STORY_AGE_HOURS: 48,

  CACHE_TTL: {
    now:       0,
    minus4h:   60  * 60 * 1000,
    minus12h:  90  * 60 * 1000,
    minus24h:  120 * 60 * 1000,
  },
  CACHE_TOLERANCE: {
    now:       0,
    minus4h:   60  * 60 * 1000,
    minus12h:  120 * 60 * 1000,
    minus24h:  240 * 60 * 1000,
  },

  RISING_THRESHOLD: 3,
  REGION_BOOST: 0.03,
  REGION_TAGS: ["chennai", "trichy", "tamil nadu", "tn", "muscat", "oman"],

  TIER_D_EXCLUDE: true,
  TIER_C_FALLBACK: true,
};
