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
import { getTopicCohesionDiagnostics } from "./topicCohesion";

// ── Cluster (internal working struct) ────────────────────────────────────────

interface Cluster {
  id: string;
  stories: InsightStory[];
  // FIX M-1: maintain a running mean embedding so comparisons use the centroid,
  // not just the first/highest-authority seed story
  centroidEmbedding: number[];
}

/** Update centroid in-place when a new story is added to the cluster. */
function updateCentroid(cluster: Cluster, newStory: InsightStory): void {
  const n  = cluster.stories.length; // count BEFORE push
  const ce = cluster.centroidEmbedding;
  const ne = newStory.embedding;
  if (ce.length === 0 || ce.length !== ne.length) {
    cluster.centroidEmbedding = [...ne];
    return;
  }
  // Incremental mean: centroid = (centroid * n + new) / (n + 1)
  const updated = ce.map((v, i) => (v * n + ne[i]) / (n + 1));
  // Re-normalise to unit length
  const mag = Math.sqrt(updated.reduce((s, x) => s + x * x, 0)) || 1;
  cluster.centroidEmbedding = updated.map(x => x / mag);
}

/** Synthetic story wrapping the centroid for use with eventSimilarity. */
function centroidStory(cluster: Cluster): InsightStory {
  const rep = getClusterRepresentative(cluster);
  return { ...rep, embedding: cluster.centroidEmbedding };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function computeClusterSeedScore(story: InsightStory): number {
  return (
    0.35 * clamp01(story.sourceAuthority) +
    0.25 * clamp01(story.rawProminence) +
    0.20 * clamp01(story.freshnessScore) +
    0.10 * clamp01(story.factualDensity) +
    0.10 * clamp01(story.summaryQuality)
  );
}

export function computeParentRepresentativeScore(story: InsightStory): number {
  return (
    0.30 * clamp01(story.sourceAuthority) +
    0.25 * clamp01(story.rawProminence) +
    0.20 * clamp01(story.summaryQuality) +
    0.15 * clamp01(story.factualDensity) +
    0.10 * clamp01(story.freshnessScore)
  );
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
  const sorted = [...stories].sort((a, b) => {
    const scoreDiff = computeClusterSeedScore(b) - computeClusterSeedScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    const authorityDiff = b.sourceAuthority - a.sourceAuthority;
    if (authorityDiff !== 0) return authorityDiff;

    return b.publishedAt - a.publishedAt;
  });

  for (const story of sorted) {
    let bestCluster: Cluster | null = null;
    let bestScore = -1;

    for (const cluster of clusters) {
      // FIX M-1: compare against centroid story, not just the seeding representative
      const rep   = centroidStory(cluster);
      const raw   = eventSimilarity(story, rep);
      const rule  = applyClusterOverrides(story, rep, raw, cfg);
      const topicDiagnostics = getTopicCohesionDiagnostics(story, rep);

      let score: number;
      if (rule === "SAME")       score = 1.0;
      else if (rule === "DIFFERENT") score = 0.0;
      else score = raw;

      if (score >= cfg.SAME_EVENT_THRESHOLD && score > bestScore) {
        bestScore   = score;
        bestCluster = cluster;
        (story as any).clusterMatchDiagnostics = {
          matchedClusterId: cluster.id,
          rawSimilarity: raw,
          resolvedScore: score,
          rule,
          topicDiagnostics,
        };
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
      // FIX M-1: update centroid before pushing so subsequent comparisons reflect the new member
      updateCentroid(bestCluster, story);
      bestCluster.stories.push({ ...story, parentId: bestCluster.id });
    } else {
      const newCluster: Cluster = {
        id: `cluster_${clusters.length + 1}_${story.id}`,
        stories: [{ ...story, parentId: `cluster_${clusters.length + 1}_${story.id}` }],
        centroidEmbedding: [...story.embedding],  // FIX M-1: seed centroid from first story
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
  return cluster.stories.reduce((best, story) => {
    const storyScore = computeParentRepresentativeScore(story);
    const bestScore = computeParentRepresentativeScore(best);

    if (storyScore !== bestScore) {
      return storyScore > bestScore ? story : best;
    }

    if (story.sourceAuthority !== best.sourceAuthority) {
      return story.sourceAuthority > best.sourceAuthority ? story : best;
    }

    return story.publishedAt > best.publishedAt ? story : best;
  });
}

// ── Canonical parent creation ─────────────────────────────────────────────────

export function createCanonicalParent(
  cluster: Cluster,
  cfg: InsightConfig
): InsightParent {
  const stories = cluster.stories;
  const rep     = getClusterRepresentative(cluster);

  const representativeDiagnostics = {
    formulaVersion: "cluster-representative-v2-top-story-anchor",
    representativeId: rep.id,
    representativeScore: computeParentRepresentativeScore(rep),
    clusterSeedScore: computeClusterSeedScore(rep),
    rawProminence: rep.rawProminence,
    freshnessScore: rep.freshnessScore,
    sourceAuthority: rep.sourceAuthority,
  };

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
      representativeDiagnostics,
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
