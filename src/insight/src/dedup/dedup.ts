// ─────────────────────────────────────────────
//  INSIGHT TAB — Deduplication (3 Layers)
// ─────────────────────────────────────────────

import { InsightStory, InsightConfig, AngleLabel } from "../types";
import { hasSharedTopicSignature, topicTokenOverlap } from "../cluster/topicCohesion";

// ── Duplicate diagnostics ─────────────────────────────────────────────────────

export type DuplicateDecisionReason =
  | "CANONICAL_URL_DUPLICATE"
  | "CANONICAL_TEXT_HASH_DUPLICATE"
  | "HARD_TITLE_SIMILARITY"
  | "HARD_EMBEDDING_SIMILARITY"
  | "SAME_EVENT_DUPLICATE"
  | "WEAK_ANGLE_VARIANT"
  | "SOURCE_REPEAT_DUPLICATE"
  | "USEFUL_EMBEDDING_VARIANT_RESCUED";

export interface DuplicateDecisionDiagnostic {
  hiddenId?: string;
  keptId: string;
  reason: DuplicateDecisionReason;
  score?: number;
  matchedId?: string;
  sourceGroup?: string;
  angle?: AngleLabel;
  note?: string;
}

export interface DuplicateDiagnosticsAccumulator {
  reasonCounts: Record<DuplicateDecisionReason, number>;
  decisions: DuplicateDecisionDiagnostic[];
}

export function createDuplicateDiagnostics(): DuplicateDiagnosticsAccumulator {
  return {
    reasonCounts: {
      CANONICAL_URL_DUPLICATE: 0,
      CANONICAL_TEXT_HASH_DUPLICATE: 0,
      HARD_TITLE_SIMILARITY: 0,
      HARD_EMBEDDING_SIMILARITY: 0,
      SAME_EVENT_DUPLICATE: 0,
      WEAK_ANGLE_VARIANT: 0,
      SOURCE_REPEAT_DUPLICATE: 0,
      USEFUL_EMBEDDING_VARIANT_RESCUED: 0,
    },
    decisions: [],
  };
}

function recordDuplicateDecision(
  diagnostics: DuplicateDiagnosticsAccumulator | undefined,
  reason: DuplicateDecisionReason,
  hiddenStory: InsightStory,
  keptStory: InsightStory,
  score?: number,
  matchedId?: string,
  note?: string
): void {
  if (!diagnostics) return;

  diagnostics.reasonCounts[reason] = (diagnostics.reasonCounts[reason] || 0) + 1;

  const decision: DuplicateDecisionDiagnostic = {
    hiddenId: hiddenStory.id,
    keptId: keptStory.id,
    reason,
    score,
    matchedId,
    sourceGroup: hiddenStory.sourceGroup,
    angle: hiddenStory.angle,
    note,
  };

  if (diagnostics.decisions.length < 100) {
    diagnostics.decisions.push(decision);
  }

  (hiddenStory as any).duplicateDecision = decision;
}

function getNewNumberCount(candidate: InsightStory, existing: InsightStory): number {
  const existingNumbers = new Set(existing.numbers.map(value => value.toLowerCase()));
  return candidate.numbers.filter(value => !existingNumbers.has(value.toLowerCase())).length;
}

function getIntentTokens(story: InsightStory): Set<string> {
  const text = `${story.title || ""} ${story.summary || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const titleTokens = text
    .split(/\s+/)
    .filter(token => token.length >= 5)
    .filter(token => !/^(about|after|before|their|there|which|could|would|should|while|where|being|under|over)$/.test(token));

  return new Set([
    ...(story.eventVerbs || []).map(token => token.toLowerCase()),
    ...(story.keywords || []).map(token => token.toLowerCase()),
    ...(story.numbers || []).map(token => token.toLowerCase()),
    classifyAngle(story),
    ...titleTokens.slice(0, 8),
  ]);
}

function intentOverlap(candidate: InsightStory, existing: InsightStory): number {
  const candidateTokens = getIntentTokens(candidate);
  const existingTokens = getIntentTokens(existing);

  if (candidateTokens.size === 0 || existingTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of candidateTokens) {
    if (existingTokens.has(token)) intersection += 1;
  }

  const union = candidateTokens.size + existingTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function hasDistinctStoryIntent(candidate: InsightStory, existing: InsightStory): boolean {
  const candidateTokens = getIntentTokens(candidate);
  if (candidateTokens.size < 3) return false;

  return intentOverlap(candidate, existing) <= 0.42;
}

export function shouldKeepUsefulVariantOverEmbeddingDuplicate(
  candidate: InsightStory,
  existing: InsightStory
): boolean {
  const isCrossSource = candidate.sourceGroup !== existing.sourceGroup;
  if (!isCrossSource) return false;

  const isSameUrl = candidate.canonicalUrl === existing.canonicalUrl;
  const isSameTextHash = candidate.canonicalTextHash === existing.canonicalTextHash;
  if (isSameUrl || isSameTextHash) return false;

  const titleSim = titleSimilarity(candidate.title, existing.title);
  if (titleSim >= 0.92) return false;

  const candidateAngle = classifyAngle(candidate);
  const existingAngle = classifyAngle(existing);
  const hasDistinctAngle = candidateAngle !== existingAngle;
  const hasNewNumbers = getNewNumberCount(candidate, existing) > 0;

  const hasDistinctIntent = hasDistinctStoryIntent(candidate, existing);
  const hasDifferentSourcePerspective =
    candidate.sourceGroup !== existing.sourceGroup &&
    candidate.source !== existing.source &&
    titleSimilarity(candidate.title, existing.title) < 0.88;

  return hasDistinctAngle ||
    hasNewNumbers ||
    hasDistinctIntent ||
    hasDifferentSourcePerspective;
}

function recordUsefulVariantRescue(
  diagnostics: DuplicateDiagnosticsAccumulator | undefined,
  candidate: InsightStory,
  matchedStory: InsightStory,
  score: number
): void {
  if (!diagnostics) return;

  const reason: DuplicateDecisionReason = "USEFUL_EMBEDDING_VARIANT_RESCUED";

  diagnostics.reasonCounts[reason] = (diagnostics.reasonCounts[reason] || 0) + 1;

  const decision: DuplicateDecisionDiagnostic = {
    keptId: candidate.id,
    reason,
    score,
    matchedId: matchedStory.id,
    sourceGroup: candidate.sourceGroup,
    angle: classifyAngle(candidate),
    note: "cross-source useful variant rescued from hard embedding duplicate path",
  };

  if (diagnostics.decisions.length < 100) {
    diagnostics.decisions.push(decision);
  }

  (candidate as any).duplicateDecision = {
    ...decision,
    rescued: true,
  };
}

export function getDuplicateDiagnosticsSummary(
  diagnostics: DuplicateDiagnosticsAccumulator
): Record<DuplicateDecisionReason, number> {
  return { ...diagnostics.reasonCounts };
}

// ── Similarity helpers ────────────────────────────────────────────────────────

/**
 * Cosine similarity between two dense vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Character n-gram based title similarity (Jaccard on trigrams).
 * Lightweight proxy for edit-distance without heavy deps.
 */
export function titleSimilarity(a: string, b: string): number {
  const ngrams = (s: string, n = 3) => {
    const norm = s.toLowerCase().replace(/\s+/g, " ").trim();
    const set = new Set<string>();
    for (let i = 0; i <= norm.length - n; i++) set.add(norm.slice(i, i + n));
    return set;
  };
  const ga = ngrams(a);
  const gb = ngrams(b);
  let intersection = 0;
  for (const g of ga) if (gb.has(g)) intersection++;
  const union = ga.size + gb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Jaccard overlap of two string arrays (lowercased).
 */
function jaccardOverlap(a: string[], b: string[]): number {
  const sa = new Set(a.map(x => x.toLowerCase()));
  const sb = new Set(b.map(x => x.toLowerCase()));
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── Layer A: Hard Duplicate Removal ──────────────────────────────────────────

/**
 * Returns the de-duplicated list. Hidden duplicate IDs are pushed into
 * the provided `hiddenIds` set for later surfacing in the UI.
 *
 * Winner selection: highest sourceAuthority → earliest publishedAt.
 */
export function getAngleVariantDecision(
  candidate: InsightStory,
  selectedChildren: InsightStory[]
): {
  eligible: boolean;
  reason?: DuplicateDecisionReason;
  matchedId?: string;
  metrics?: {
    entityOverlap?: number;
    numberOverlap?: number;
    titleSimilarity?: number;
    embeddingSimilarity?: number;
  };
} {
  if (selectedChildren.length === 0) return { eligible: true };

  const sameAngle = selectedChildren.filter(c => c.angle === candidate.angle);
  if (sameAngle.length === 0) return { eligible: true };

  for (const existing of sameAngle) {
    const entOverlap = entityOverlap(candidate, existing);
    const numOverlap = numberFactMatch(candidate, existing);
    const titleSim = titleSimilarity(candidate.title, existing.title);
    const embedSim = cosineSimilarity(candidate.embedding, existing.embedding);

    if (entOverlap > 0.7 && numOverlap > 0.6 && embedSim > 0.85) {
      return {
        eligible: false,
        reason: "WEAK_ANGLE_VARIANT",
        matchedId: existing.id,
        metrics: {
          entityOverlap: entOverlap,
          numberOverlap: numOverlap,
          embeddingSimilarity: embedSim,
        },
      };
    }

    if (titleSim > 0.80 && embedSim > 0.80) {
      return {
        eligible: false,
        reason: "SAME_EVENT_DUPLICATE",
        matchedId: existing.id,
        metrics: {
          titleSimilarity: titleSim,
          embeddingSimilarity: embedSim,
        },
      };
    }
  }

  return { eligible: true };
}

export function removeHardDuplicates(
  stories: InsightStory[],
  cfg: InsightConfig,
  hiddenIds: Set<string>,
  diagnostics: DuplicateDiagnosticsAccumulator = createDuplicateDiagnostics()
): InsightStory[] {
  const kept: InsightStory[] = [];
  const seenUrls = new Map<string, InsightStory>();
  const seenHashes = new Map<string, InsightStory>();

  for (const story of stories) {
    story.angle = classifyAngle(story);
    if (seenUrls.has(story.canonicalUrl)) {
      const previous = seenUrls.get(story.canonicalUrl)!;
      const winner = pickWinner(previous, story);
      const hidden = winner === story ? previous : story;

      hiddenIds.add(hidden.id);
      recordDuplicateDecision(
        diagnostics,
        "CANONICAL_URL_DUPLICATE",
        hidden,
        winner,
        1,
        previous.id,
        "same canonical URL"
      );

      seenUrls.set(story.canonicalUrl, winner);
      continue;
    }

    if (seenHashes.has(story.canonicalTextHash)) {
      const previous = seenHashes.get(story.canonicalTextHash)!;
      const winner = pickWinner(previous, story);
      const hidden = winner === story ? previous : story;

      hiddenIds.add(hidden.id);
      recordDuplicateDecision(
        diagnostics,
        "CANONICAL_TEXT_HASH_DUPLICATE",
        hidden,
        winner,
        1,
        previous.id,
        "same canonical text hash"
      );

      seenHashes.set(story.canonicalTextHash, winner);
      continue;
    }

    const sameGroupMatch = kept.find(
      k => k.sourceGroup === story.sourceGroup &&
           titleSimilarity(k.title, story.title) >= cfg.HARD_DUP_TITLE_SIM
    );
    if (sameGroupMatch) {
      const score = titleSimilarity(sameGroupMatch.title, story.title);
      const winner = pickWinner(sameGroupMatch, story);
      const hidden = winner === story ? sameGroupMatch : story;

      hiddenIds.add(hidden.id);
      recordDuplicateDecision(
        diagnostics,
        "HARD_TITLE_SIMILARITY",
        hidden,
        winner,
        score,
        sameGroupMatch.id,
        `title similarity >= ${cfg.HARD_DUP_TITLE_SIM}`
      );

      if (winner !== sameGroupMatch) {
        const idx = kept.indexOf(sameGroupMatch);
        kept[idx] = winner;
      }
      continue;
    }

    const embedMatch = kept.find(
      k => cosineSimilarity(k.embedding, story.embedding) >= cfg.HARD_DUP_EMBED_SIM
    );
    if (embedMatch) {
      const score = cosineSimilarity(embedMatch.embedding, story.embedding);

      if (shouldKeepUsefulVariantOverEmbeddingDuplicate(story, embedMatch)) {
        recordUsefulVariantRescue(
          diagnostics,
          story,
          embedMatch,
          score
        );

        seenUrls.set(story.canonicalUrl, story);
        seenHashes.set(story.canonicalTextHash, story);
        kept.push(story);
        continue;
      }

      const winner = pickWinner(embedMatch, story);
      const hidden = winner === story ? embedMatch : story;

      hiddenIds.add(hidden.id);
      recordDuplicateDecision(
        diagnostics,
        "HARD_EMBEDDING_SIMILARITY",
        hidden,
        winner,
        score,
        embedMatch.id,
        `embedding similarity >= ${cfg.HARD_DUP_EMBED_SIM}`
      );

      if (winner !== embedMatch) {
        const idx = kept.indexOf(embedMatch);
        kept[idx] = winner;
      }
      continue;
    }

    seenUrls.set(story.canonicalUrl, story);
    seenHashes.set(story.canonicalTextHash, story);
    kept.push(story);
  }

  return kept;
}

function pickWinner(a: InsightStory, b: InsightStory): InsightStory {
  if (a.sourceAuthority !== b.sourceAuthority)
    return a.sourceAuthority > b.sourceAuthority ? a : b;
  return a.publishedAt <= b.publishedAt ? a : b; // earlier = original
}

// ── Layer B: Event Similarity (for clustering) ────────────────────────────────

/**
 * Composite event similarity score used for clustering decisions.
 * Returns a value 0..1.
 */
export function eventSimilarity(a: InsightStory, b: InsightStory): number {
  const embSim    = cosineSimilarity(a.embedding, b.embedding);
  const entSim    = entityOverlap(a, b);
  const verbSim   = verbMatch(a, b);
  const numSim    = numberFactMatch(a, b);
  const timeSim   = timeProximity(a, b);
  const placeSim  = jaccardOverlap(a.entities.places, b.entities.places);
  const catSim    = a.category && b.category && a.category === b.category ? 1 : 0;
  const topicSim  = topicTokenOverlap(a, b);

  return (
    0.24 * embSim  +
    0.17 * entSim  +
    0.12 * verbSim +
    0.09 * numSim  +
    0.09 * timeSim +
    0.08 * placeSim +
    0.05 * catSim +
    0.16 * topicSim
  );
}

function entityOverlap(a: InsightStory, b: InsightStory): number {
  const orgs    = jaccardOverlap(a.entities.orgs, b.entities.orgs);
  const people  = jaccardOverlap(a.entities.people, b.entities.people);
  const products = jaccardOverlap(a.entities.products, b.entities.products);
  // orgs carry most weight for event identity
  return 0.5 * orgs + 0.3 * people + 0.2 * products;
}

function verbMatch(a: InsightStory, b: InsightStory): number {
  if (!a.eventVerbs.length || !b.eventVerbs.length) return 0;
  return jaccardOverlap(a.eventVerbs, b.eventVerbs);
}

function numberFactMatch(a: InsightStory, b: InsightStory): number {
  if (!a.numbers.length || !b.numbers.length) return 0;
  return jaccardOverlap(a.numbers, b.numbers);
}

function timeProximity(a: InsightStory, b: InsightStory): number {
  const diffMs = Math.abs(a.publishedAt - b.publishedAt);
  const diffH  = diffMs / (60 * 60 * 1000);
  if (diffH <= 1)  return 1.0;
  if (diffH <= 4)  return 0.8;
  if (diffH <= 12) return 0.6;
  if (diffH <= 24) return 0.3;
  return 0.0;
}

/**
 * Rule-based overrides applied on top of the similarity score.
 */
export function applyClusterOverrides(
  a: InsightStory,
  b: InsightStory,
  rawSim: number,
  cfg: InsightConfig
): "SAME" | "DIFFERENT" | "USE_SCORE" {
  // Force SAME
  const sameOrgs   = a.entities.orgs.some(o => b.entities.orgs.includes(o));
  const sameVerbs  = a.eventVerbs.some(v => b.eventVerbs.includes(v));
  const within24h  = Math.abs(a.publishedAt - b.publishedAt) < 24 * 60 * 60 * 1000;
  const sameRegion = jaccardOverlap(a.entities.places, b.entities.places) > 0.4;

  if (sameOrgs && sameVerbs && within24h && sameRegion) return "SAME";

  // topic cohesion cluster override
  const sharedTopic = hasSharedTopicSignature(a, b);
  const topicOverlapScore = topicTokenOverlap(a, b);
  const crossSource = a.sourceGroup !== b.sourceGroup || a.source !== b.source;
  const within36h = Math.abs(a.publishedAt - b.publishedAt) < 36 * 60 * 60 * 1000;
  const categoryCompatible = !a.category || !b.category || a.category === b.category || rawSim >= cfg.POSSIBLE_EVENT_THRESHOLD;

  if (
    sharedTopic &&
    crossSource &&
    within36h &&
    (categoryCompatible || topicOverlapScore >= 0.30) &&
    (rawSim >= cfg.POSSIBLE_EVENT_THRESHOLD - 0.12 || topicOverlapScore >= 0.30)
  ) {
    return "SAME";
  }

  // Force DIFFERENT
  if (
    sameOrgs &&
    a.eventVerbs.length > 0 &&
    b.eventVerbs.length > 0 &&
    jaccardOverlap(a.eventVerbs, b.eventVerbs) < 0.1 // clearly different actions
  ) return "DIFFERENT";

  // Same org, unrelated categories
  if (
    sameOrgs &&
    a.category && b.category &&
    a.category !== b.category &&
    rawSim < cfg.POSSIBLE_EVENT_THRESHOLD
  ) return "DIFFERENT";

  return "USE_SCORE";
}

// ── Layer C: Angle Deduplication ─────────────────────────────────────────────

const OFFICIAL_SIGNALS = [
  /spokesperson/i, /minister/i, /official statement/i, /company said/i,
  /regulator said/i, /police confirmed/i, /government said/i, /mea/i,
  /secretary/i, /chairman/i, /ceo said/i, /officially announced/i,
  /government announced/i, /ministry announced/i, /regulator announced/i,
  /officials? said/i, /authorities said/i, /court said/i, /rbi said/i,
  /sebi said/i, /central bank said/i, /white house said/i,
  /according to the ministry/i, /according to officials/i,
];

const MARKET_SIGNALS = [
  /shares rose/i, /shares fell/i, /stock (up|down)/i, /yields moved/i,
  /futures (dropped|rose)/i, /crypto (rally|fell)/i, /market reaction/i,
  /nifty/i, /sensex/i, /bse/i, /nse/i, /intraday/i,
  /stocks? (rallied|slumped|gained|lost|jumped|dropped)/i,
  /investors? (cheered|sold|bought|reacted)/i,
  /rupee/i, /bond yields?/i, /oil prices?/i, /gold prices?/i,
];

const FACT_UPDATE_SIGNALS = [
  /toll (rises?|climbs?) to/i, /revised estimate/i, /updated count/i,
  /latest figures/i, /now confirmed/i, /figures updated/i,
  /new data/i, /updated figures/i,
  /latest update/i, /new figures/i, /fresh data/i,
  /according to data/i, /data showed/i, /report showed/i,
  /confirmed cases/i, /death toll/i, /casualty count/i,
  // NOTE: "correction:" deliberately removed — it belongs in CORRECTION_SIGNALS only
];

const EXPERT_SIGNALS = [
  /analysts? (say|warn|note)/i, /experts? (warn|say)/i, /economists? (note|say)/i,
  /think tank/i, /commentary/i, /crisil/i, /ficci/i, /cii/i, /imf/i,
  /analysis/i, /explained by/i, /what experts say/i,
  /why it matters/i, /what it means/i, /implications/i,
  /strategists? said/i, /researchers? said/i,
];

const CORRECTION_SIGNALS = [
  /corrected/i, /clarified/i, /amended/i, /debunked/i, /false claim/i,
  /update:/i, /editor'?s? note/i,
];

const REGIONAL_SIGNALS = [
  /local impact/i, /state government/i, /city council/i,
  /chennai/i, /trichy/i, /tamil nadu/i, /tn/i, /muscat/i, /oman/i, /kerala/i,
  /regional/i, /district/i, /municipal/i, /local authorities/i,
  /statewide/i, /in the state/i, /in the city/i,
];

const INVESTIGATIVE_SIGNALS = [
  /investigation/i, /leaked/i, /exclusive/i, /document shows/i,
  /sources say/i, /whistleblower/i,
  /records show/i, /documents reveal/i, /internal memo/i,
  /probe/i, /inquiry/i, /audit found/i, /obtained by/i,
];

const PUBLIC_REACTION_SIGNALS = [
  /public reaction/i, /people reacted/i, /residents said/i,
  /citizens said/i, /users reacted/i, /social media/i,
  /went viral/i, /trending/i, /protesters/i, /protests erupted/i,
  /backlash/i, /criticism/i, /praised by/i, /condemned by/i,
  /families said/i, /locals said/i,
];

const BACKGROUND_CONTEXT_SIGNALS = [
  /background/i, /explainer/i, /timeline/i, /what happened/i,
  /how it started/i, /why this matters/i, /what led to/i,
  /history of/i, /context/i, /key points/i, /all you need to know/i,
  /five things to know/i, /things to know/i,
];

function countSignalMatches(patterns: RegExp[], text: string): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function normalizeAngleCandidateScore(score: number): number {
  return Math.max(0, Math.round(score * 1000) / 1000);
}

function getSourceAndCategoryText(story: InsightStory): string {
  return [
    story.source,
    story.sourceGroup,
    story.category,
    story.region,
    story.language,
  ].filter(Boolean).join(" ").toLowerCase();
}

function getAngleCandidateScores(story: InsightStory, text: string): Array<{
  angle: AngleLabel;
  score: number;
  reason: string;
}> {
  const sourceAndCategory = getSourceAndCategoryText(story);
  const lowerText = text.toLowerCase();
  const scores: Array<{ angle: AngleLabel; score: number; reason: string }> = [];

  const collectorAngleHints = Array.isArray((story as any).angleHints)
    ? (story as any).angleHints
    : Array.isArray((story as any).storySignals?.angleHints)
      ? (story as any).storySignals.angleHints
      : [];

  for (const hint of collectorAngleHints) {
    const angle = typeof hint === "string" ? hint : hint?.angle;
    if (!angle || angle === "unknown") continue;

    const rawScore = typeof hint === "string" ? 0.5 : Number(hint?.score || 0.5);
    scores.push({
      angle: angle as AngleLabel,
      score: normalizeAngleCandidateScore(2.4 + Math.max(0, Math.min(1, rawScore)) * 2.2),
      reason: "collector JSON angle hint",
    });
  }

  const correctionScore = countSignalMatches(CORRECTION_SIGNALS, text);
  if (correctionScore > 0) {
    scores.push({
      angle: "correction",
      score: normalizeAngleCandidateScore(4 + correctionScore),
      reason: "correction/update language",
    });
  }

  const factScore = countSignalMatches(FACT_UPDATE_SIGNALS, text);
  const numberScore = Math.min(2, (story.numbers || []).length * 0.35);
  if (factScore > 0 || numberScore >= 0.7) {
    scores.push({
      angle: "fact_update",
      score: normalizeAngleCandidateScore(2.2 + factScore + numberScore),
      reason: "new numbers or updated facts",
    });
  }

  const officialScore = countSignalMatches(OFFICIAL_SIGNALS, text);
  const officialSourceScore = /government|ministry|minister|regulator|police|court|rbi|sebi|official|authority|company|press/.test(sourceAndCategory) ? 0.9 : 0;
  const saidScore = /\b(said|announced|confirmed|statement|approved|rejected|clarified|warned)\b/i.test(text) ? 0.55 : 0;
  if (officialScore > 0 || officialSourceScore > 0 || saidScore > 0) {
    scores.push({
      angle: "official_response",
      score: normalizeAngleCandidateScore(1.5 + officialScore + officialSourceScore + saidScore),
      reason: "official or institutional response",
    });
  }

  const marketScore = countSignalMatches(MARKET_SIGNALS, text);
  const marketCategoryScore = /business|market|finance|stocks|economy|money|crypto/.test(sourceAndCategory) ? 0.75 : 0;
  if (marketScore > 0 || marketCategoryScore > 0) {
    scores.push({
      angle: "market_reaction",
      score: normalizeAngleCandidateScore(1.6 + marketScore + marketCategoryScore),
      reason: "market/business reaction",
    });
  }

  const expertScore = countSignalMatches(EXPERT_SIGNALS, text);
  const expertTextScore = /\b(analysis|analyst|expert|economist|researcher|strategist|explains?|why it matters|implications)\b/i.test(text) ? 0.85 : 0;
  if (expertScore > 0 || expertTextScore > 0) {
    scores.push({
      angle: "expert_analysis",
      score: normalizeAngleCandidateScore(1.7 + expertScore + expertTextScore),
      reason: "expert analysis language",
    });
  }

  const investigativeScore = countSignalMatches(INVESTIGATIVE_SIGNALS, text);
  if (investigativeScore > 0) {
    scores.push({
      angle: "investigative_detail",
      score: normalizeAngleCandidateScore(1.8 + investigativeScore),
      reason: "investigative/source-detail language",
    });
  }

  const regionalScore = countSignalMatches(REGIONAL_SIGNALS, text);
  const regionalEntityScore = (story.entities?.places || []).length > 0 && /local|city|state|district|regional|chennai|trichy|tamil nadu|muscat|oman/i.test(text)
    ? 0.75
    : 0;
  if (regionalScore > 0 || regionalEntityScore > 0) {
    scores.push({
      angle: "regional_followup",
      score: normalizeAngleCandidateScore(1.5 + regionalScore + regionalEntityScore),
      reason: "regional/local follow-up",
    });
  }

  const reactionScore = countSignalMatches(PUBLIC_REACTION_SIGNALS, text);
  const socialScore = /\b(backlash|viral|trending|users|residents|families|locals|public|protest|criticism|praised|condemned)\b/i.test(text) ? 0.9 : 0;
  if (reactionScore > 0 || socialScore > 0) {
    scores.push({
      angle: "reaction_public",
      score: normalizeAngleCandidateScore(1.6 + reactionScore + socialScore),
      reason: "public/social reaction",
    });
  }

  const backgroundScore = countSignalMatches(BACKGROUND_CONTEXT_SIGNALS, text);
  const explainerScore = /\b(explainer|timeline|background|context|what happened|what led|key points|things to know|why this matters)\b/i.test(lowerText) ? 1 : 0;
  if (backgroundScore > 0 || explainerScore > 0) {
    scores.push({
      angle: "background_context",
      score: normalizeAngleCandidateScore(1.4 + backgroundScore + explainerScore),
      reason: "background/explainer context",
    });
  }

  return scores;
}

function getAngleSignalText(story: InsightStory): string {
  return `${story.title || ""} ${story.summary || ""}`.trim();
}

/**
 * Classify a story's angle within a parent cluster.
 */
export function classifyAngle(story: InsightStory): AngleLabel {
  const text = getAngleSignalText(story);
  const candidates = getAngleCandidateScores(story, text)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.angle.localeCompare(b.angle);
    });

  const best = candidates[0];

  if (best && best.score >= 1.6) {
    (story as any).angleReason = best.reason;
    (story as any).angleConfidence = Math.min(1, best.score / 5);
    return best.angle;
  }

  // Secondary regex fallbacks to ensure signal patterns are always consulted.
  if (CORRECTION_SIGNALS.some(p => p.test(text)))           return "correction";
  if (FACT_UPDATE_SIGNALS.some(p => p.test(text)))          return "fact_update";
  if (OFFICIAL_SIGNALS.some(p => p.test(text)))             return "official_response";
  if (MARKET_SIGNALS.some(p => p.test(text)))               return "market_reaction";
  if (EXPERT_SIGNALS.some(p => p.test(text)))               return "expert_analysis";
  if (INVESTIGATIVE_SIGNALS.some(p => p.test(text)))        return "investigative_detail";
  if (REGIONAL_SIGNALS.some(p => p.test(text)))             return "regional_followup";
  if (PUBLIC_REACTION_SIGNALS.some(p => p.test(text)))      return "reaction_public";
  if (BACKGROUND_CONTEXT_SIGNALS.some(p => p.test(text)))   return "background_context";

  (story as any).angleReason = "base event report fallback";
  (story as any).angleConfidence = 0.35;
  return "base_report";
}

/**
 * Determine whether a story adds genuinely new information over stories
 * already selected into the tree (angle-level dedup).
 * Returns true if the story should be ELIGIBLE, false if it's an angle duplicate.
 */
export function isAngleVariant(
  candidate: InsightStory,
  selectedChildren: InsightStory[]
): boolean {
  return getAngleVariantDecision(candidate, selectedChildren).eligible;
}
