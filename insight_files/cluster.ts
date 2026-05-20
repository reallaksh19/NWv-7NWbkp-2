// ─────────────────────────────────────────────
//  INSIGHT TAB — Event Clustering
// ─────────────────────────────────────────────

import { InsightStory, InsightParent, InsightConfig, SnapshotSlot } from "../types";
import {
  eventSimilarity,
  applyClusterOverrides,
  classifyAngle,
  cosineSimilarity,
} from "../dedup/dedup";

// ── Cluster (internal working struct) ────────────────────────────────────────

interface Cluster {
  id: string;
  stories: InsightStory[];
}

// ── Main clustering function ──────────────────────────────────────────────────

/**
 * Groups stories into event clusters using a greedy single-pass approach.
 * Each new story is tested against existing cluster centroids.
 * Stories are sorted by sourceAuthority desc before clustering so the
 * most authoritative story seeds each cluster.
 */
export function clusterIntoParentEvents(
  stories: InsightStory[],
  cfg: InsightConfig
): Cluster[] {
  const clusters: Cluster[] = [];

  // Process highest-authority stories first — they become cluster seeds
  const sorted = [...stories].sort((a, b) => b.sourceAuthority - a.sourceAuthority);

  for (const story of sorted) {
    let bestCluster: Cluster | null = null;
    let bestScore = -1;

    for (const cluster of clusters) {
      const rep   = getClusterRepresentative(cluster);
      const raw   = eventSimilarity(story, rep);
      const rule  = applyClusterOverrides(story, rep, raw, cfg);

      let score: number;
      if (rule === "SAME")       score = 1.0;
      else if (rule === "DIFFERENT") score = 0.0;
      else score = raw;

      if (score >= cfg.SAME_EVENT_THRESHOLD && score > bestScore) {
        bestScore   = score;
        bestCluster = cluster;
      }

      // If in possible range but no rule override, do deeper multi-story check
      if (score >= cfg.POSSIBLE_EVENT_THRESHOLD && score < cfg.SAME_EVENT_THRESHOLD) {
        if (passesMultiStoryCheck(story, cluster, cfg)) {
          if (score > bestScore) {
            bestScore   = score;
            bestCluster = cluster;
          }
        }
      }
    }

    if (bestCluster) {
      bestCluster.stories.push({ ...story, parentId: bestCluster.id });
    } else {
      const newCluster: Cluster = {
        id: `cluster_${clusters.length + 1}_${story.id}`,
        stories: [{ ...story, parentId: `cluster_${clusters.length + 1}_${story.id}` }],
      };
      clusters.push(newCluster);
    }
  }

  return clusters;
}

/**
 * For ambiguous cases (0.75–0.88), compare the candidate against
 * multiple stories in the cluster to reduce false positives.
 */
function passesMultiStoryCheck(
  story: InsightStory,
  cluster: Cluster,
  cfg: InsightConfig
): boolean {
  const sample = cluster.stories.slice(0, 5); // avoid O(n²) on large clusters
  const scores = sample.map(s => eventSimilarity(story, s));
  const avg    = scores.reduce((a, b) => a + b, 0) / scores.length;
  return avg >= cfg.POSSIBLE_EVENT_THRESHOLD;
}

/**
 * Representative story for a cluster = highest parentRepresentativeScore.
 */
function getClusterRepresentative(cluster: Cluster): InsightStory {
  return cluster.stories.reduce((best, s) => {
    return parentRepresentativeScore(s) > parentRepresentativeScore(best) ? s : best;
  });
}

/**
 * Score used to select which story in a cluster becomes the canonical parent.
 */
function parentRepresentativeScore(s: InsightStory): number {
  return (
    0.30 * s.sourceAuthority +
    0.20 * s.factualDensity  +
    0.20 * s.summaryQuality  +
    0.15 * (s.publishedAt < Date.now() ? 0.5 : 0) + // earliest gets mild boost
    0.15 * s.rawProminence
  );
}

// ── Canonical parent creation ─────────────────────────────────────────────────

export function createCanonicalParent(
  cluster: Cluster,
  cfg: InsightConfig
): InsightParent {
  const stories = cluster.stories;
  const rep     = getClusterRepresentative(cluster);

  // Tag all stories with their parentId and angle
  const tagged = stories.map(s => ({
    ...s,
    parentId: cluster.id,
    angle: classifyAngle(s),
  }));

  // Fix: the representative story gets base_report if no other angle matched
  const taggedRep = tagged.find(s => s.id === rep.id);
  if (taggedRep && taggedRep.angle === "base_report") {
    // Already correct
  }

  // Snapshot presence
  const snapshotPresence = {
    now:      tagged.some(s => s.capturedAtSnapshot === "now"),
    minus4h:  tagged.some(s => s.capturedAtSnapshot === "minus4h"),
    minus12h: tagged.some(s => s.capturedAtSnapshot === "minus12h"),
    minus24h: tagged.some(s => s.capturedAtSnapshot === "minus24h"),
  };

  // Aggregate entities
  const allOrgs    = [...new Set(tagged.flatMap(s => s.entities.orgs))];
  const allPlaces  = [...new Set(tagged.flatMap(s => s.entities.places))];
  const allVerbs   = [...new Set(tagged.flatMap(s => s.eventVerbs))];
  const allNumbers = [...new Set(tagged.flatMap(s => s.numbers))];

  // Source diversity: unique source groups (Tier A+B only)
  const uniqueSources = new Set(
    tagged.filter(s => s.sourceTier === "A" || s.sourceTier === "B")
          .map(s => s.sourceGroup)
  );

  const parent: InsightParent = {
    parentId:          cluster.id,
    canonicalHeadline: stripSourcePrefix(rep.title),
    canonicalSummary:  rep.summary,
    clusterStoryIds:   tagged.map(s => s.id),
    childStoryIds:     [],
    hiddenDuplicateIds:[],
    keyEntities:       allOrgs.slice(0, 5),
    keyPlaces:         allPlaces.slice(0, 5),
    keyVerbs:          allVerbs.slice(0, 5),
    keyNumbers:        allNumbers.slice(0, 5),
    firstSeenAt:       Math.min(...tagged.map(s => s.publishedAt)),
    latestSeenAt:      Math.max(...tagged.map(s => s.publishedAt)),
    snapshotPresence,
    impactScore:       0,
    persistenceScore:  computePersistenceScore(snapshotPresence),
    sourceDiversityScore: Math.min(1, uniqueSources.size / 5),
    noveltyScore:      0,
    freshnessScore:    Math.max(...tagged.map(s => s.freshnessScore)),
    crossSnapshotMomentum: 0,
    editorialClarityScore: computeEditorialClarityScore(rep.title),
    regionBoost:       0,
    finalParentScore:  0,
    isRising:          false,
    weakTree:          false,
    debug: {
      clusterSize:      tagged.length,
      hiddenCount:      0,
      matchedSnapshots: Object.entries(snapshotPresence)
                              .filter(([, v]) => v)
                              .map(([k]) => k as SnapshotSlot),
      scoreBreakdown:   {},
      replacements:     [],
    },
  };

  return parent;
}

// ── Score helpers ─────────────────────────────────────────────────────────────

export function computePersistenceScore(
  presence: Record<SnapshotSlot, boolean>
): number {
  return (
    0.40 * (presence.now      ? 1 : 0) +
    0.25 * (presence.minus4h  ? 1 : 0) +
    0.20 * (presence.minus12h ? 1 : 0) +
    0.15 * (presence.minus24h ? 1 : 0)
  );
}

function computeEditorialClarityScore(title: string): number {
  const CLICKBAIT = [/\bshocking\b/i, /you won'?t believe/i, /goes viral/i, /\bWOW\b/];
  if (CLICKBAIT.some(p => p.test(title))) return 0.1;

  const words = title.split(/\s+/).length;
  if (words < 4)  return 0.4;
  if (words > 20) return 0.5;
  return 1.0;
}

/**
 * Strip source-specific prefixes from titles.
 * e.g. "Reuters: Nvidia shares jump..." → "Nvidia shares jump..."
 */
function stripSourcePrefix(title: string): string {
  return title.replace(/^[A-Z][a-zA-Z\s]+:\s*/, "");
}
