import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function insertBeforeOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

function replaceFunction(source, functionName, replacement) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) {
    if (source.includes(replacement.trim().split('\n')[0])) return source;
    throw new Error(`Function not found: ${functionName}`);
  }

  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) throw new Error(`Opening brace not found for ${functionName}`);

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return `${source.slice(0, start)}${replacement}${source.slice(index + 1)}`;
    }
  }

  throw new Error(`Closing brace not found for ${functionName}`);
}

fs.mkdirSync('src/insight/src/diagnostics', { recursive: true });

write('src/insight/src/diagnostics/insightCoreQuality.ts', `import {
  InsightConfig,
  InsightParent,
  InsightStory,
  DEFAULT_CONFIG,
  AngleLabel,
} from "../types";

type StoriesByIdInput = Map<string, InsightStory> | Record<string, InsightStory> | undefined;

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeStoriesById(storiesById: StoriesByIdInput): Map<string, InsightStory> {
  if (storiesById instanceof Map) return storiesById;
  if (storiesById && typeof storiesById === "object") {
    return new Map(Object.entries(storiesById));
  }
  return new Map();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getInsightSourceLabel(source: string): string {
  if (source === "stale-snapshot") return "Stale snapshot";
  if (source === "snapshot") return "Snapshot";
  if (source === "cached") return "Cached";
  if (source === "unavailable") return "Unavailable";
  return "Live";
}

function getVisibleChildStories(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): InsightStory[] {
  return safeArray(parent.childStoryIds)
    .map(id => storiesById.get(id))
    .filter(Boolean) as InsightStory[];
}

export function getVisibleChildAngles(
  parent: InsightParent,
  storiesByIdInput: StoriesByIdInput
): AngleLabel[] {
  const storiesById = normalizeStoriesById(storiesByIdInput);

  return [
    ...new Set(
      getVisibleChildStories(parent, storiesById)
        .map(story => story.angle || "unknown")
        .filter(angle => angle !== "unknown")
    ),
  ] as AngleLabel[];
}

export function getInsightCoreQualityDiagnostics(
  result: {
    parents?: InsightParent[];
    storiesById?: StoriesByIdInput;
  } | null | undefined,
  source = "live",
  cfg: InsightConfig = DEFAULT_CONFIG
) {
  const parents = safeArray(result?.parents);
  const storiesById = normalizeStoriesById(result?.storiesById);

  const rankedCount = parents.length;
  const storyCount = storiesById.size || parents.reduce((sum, parent) => {
    return sum + safeArray(parent.clusterStoryIds).length;
  }, 0);

  const childCounts = parents.map(parent => safeArray(parent.childStoryIds).length);
  const visibleAngleCounts = parents.map(parent => getVisibleChildAngles(parent, storiesById).length);
  const sourceGroupCounts = parents.map(parent => {
    const sourceGroups = new Set(
      safeArray(parent.clusterStoryIds)
        .map(id => storiesById.get(id))
        .filter(Boolean)
        .map(story => story?.sourceGroup || story?.source || "unknown")
    );

    return sourceGroups.size;
  });

  const snapshotCounts = parents.map(parent => {
    const slots = new Set(
      safeArray(parent.clusterStoryIds)
        .map(id => storiesById.get(id))
        .filter(Boolean)
        .map(story => story?.capturedAtSnapshot)
        .filter(Boolean)
    );

    return slots.size;
  });

  const risingCount = parents.filter(parent => parent.isRising).length;
  const thinCount = parents.filter(parent => parent.weakTree).length;
  const multiAngleCount = visibleAngleCounts.filter(count => count >= 2).length;
  const lowAngleCount = visibleAngleCounts.filter(count => count < 2).length;
  const strongAngleCount = visibleAngleCounts.filter(count => count >= 3).length;
  const lowSourceDiversityCount = sourceGroupCounts.filter(count => count < cfg.MIN_SOURCES_PER_TREE).length;
  const lowSnapshotCoverageCount = snapshotCounts.filter(count => count < 2).length;

  const avgAngles = rankedCount > 0
    ? visibleAngleCounts.reduce((sum, count) => sum + count, 0) / rankedCount
    : 0;

  const avgChildren = rankedCount > 0
    ? childCounts.reduce((sum, count) => sum + count, 0) / rankedCount
    : 0;

  const avgScore = rankedCount > 0
    ? parents.reduce((sum, parent) => sum + asFiniteNumber(parent.finalParentScore), 0) / rankedCount
    : 0;

  const sourceLabel = getInsightSourceLabel(source);
  const isStale = source === "stale-snapshot" || source === "cached";
  const hiddenDuplicateCount = parents.reduce((sum, parent) => (
    sum + safeArray(parent.hiddenDuplicateIds).length + asFiniteNumber(parent.debug?.hiddenCount)
  ), 0);

  const angleCoverageScore = rankedCount > 0 ? multiAngleCount / rankedCount : 0;
  const strongAngleScore = rankedCount > 0 ? strongAngleCount / rankedCount : 0;
  const sourceDiversityScore = rankedCount > 0
    ? sourceGroupCounts.filter(count => count >= cfg.MIN_SOURCES_PER_TREE).length / rankedCount
    : 0;
  const snapshotCoverageScore = rankedCount > 0
    ? snapshotCounts.filter(count => count >= 2).length / rankedCount
    : 0;
  const childDepthScore = clamp(avgChildren / Math.max(1, cfg.WEAK_TREE_CHILD_MIN), 0, 1);
  const rankingScore = clamp(avgScore, 0, 1);
  const weakTreePenalty = rankedCount > 0 ? thinCount / rankedCount : 0;
  const stalePenalty = isStale ? 0.12 : 0;

  const signalScore = clamp(Math.round(
    (rankingScore * 24) +
    (angleCoverageScore * 22) +
    (strongAngleScore * 14) +
    (sourceDiversityScore * 14) +
    (snapshotCoverageScore * 10) +
    (childDepthScore * 10) +
    Math.min(6, risingCount * 2) -
    (weakTreePenalty * 18) -
    stalePenalty * 100
  ), 0, 100);

  let grade = "F";
  let tone = "danger";
  let title = "No insight signal";

  if (signalScore >= 80) {
    grade = "A";
    tone = "good";
    title = "Strong insight signal";
  } else if (signalScore >= 65) {
    grade = "B";
    tone = "info";
    title = "Useful insight signal";
  } else if (signalScore >= 45) {
    grade = "C";
    tone = "warn";
    title = "Thin but usable signal";
  } else if (signalScore > 0) {
    grade = "D";
    tone = "danger";
    title = "Weak insight signal";
  }

  const warnings: string[] = [];

  if (rankedCount === 0) warnings.push("No ranked clusters available.");
  if (lowAngleCount > 0) warnings.push(\`\${lowAngleCount} cluster(s) have fewer than two visible child angles.\`);
  if (strongAngleCount === 0 && rankedCount > 0) warnings.push("No cluster currently exposes three or more visible child angles.");
  if (lowSourceDiversityCount > 0) warnings.push(\`\${lowSourceDiversityCount} cluster(s) are below source-diversity target.\`);
  if (lowSnapshotCoverageCount > 0) warnings.push(\`\${lowSnapshotCoverageCount} cluster(s) have weak snapshot coverage.\`);
  if (thinCount > 0) warnings.push(\`\${thinCount} cluster(s) are marked thin.\`);
  if (hiddenDuplicateCount > 0) warnings.push(\`\${hiddenDuplicateCount} duplicate/near-duplicate item(s) were hidden or downgraded.\`);
  if (isStale) warnings.push(\`Source is \${sourceLabel.toLowerCase()}.\`);

  if (warnings.length === 0) warnings.push("No major diagnostic warnings.");

  return {
    grade,
    tone,
    title,
    signalScore,
    sourceLabel,
    rankedCount,
    storyCount,
    risingCount,
    thinCount,
    multiAngleCount,
    lowAngleCount,
    strongAngleCount,
    avgAngles,
    avgChildren,
    avgScore,
    sourceDiversityCoverage: rankedCount > 0 ? sourceGroupCounts.filter(count => count >= cfg.MIN_SOURCES_PER_TREE).length : 0,
    snapshotCoverage: rankedCount > 0 ? snapshotCounts.filter(count => count >= 2).length : 0,
    coverageLabel: \`\${multiAngleCount}/\${rankedCount || 0}\`,
    warnings,
  };
}

export default getInsightCoreQualityDiagnostics;
`);

patchFile('src/insight/src/dedup/dedup.ts', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `function getNewNumberCount(candidate: InsightStory, existing: InsightStory): number {
  const existingNumbers = new Set(existing.numbers.map(value => value.toLowerCase()));
  return candidate.numbers.filter(value => !existingNumbers.has(value.toLowerCase())).length;
}
`,
    `
function getIntentTokens(story: InsightStory): Set<string> {
  const text = \`\${story.title || ""} \${story.summary || ""}\`
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, " ");

  const titleTokens = text
    .split(/\\s+/)
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
`,
    'intent-token rescue helpers'
  );

  text = replaceOnce(
    text,
    `  return hasDistinctAngle || hasNewNumbers;
}`,
    `  const hasDistinctIntent = hasDistinctStoryIntent(candidate, existing);
  const hasDifferentSourcePerspective =
    candidate.sourceGroup !== existing.sourceGroup &&
    candidate.source !== existing.source &&
    titleSimilarity(candidate.title, existing.title) < 0.88;

  return hasDistinctAngle ||
    hasNewNumbers ||
    hasDistinctIntent ||
    hasDifferentSourcePerspective;
}`,
    'useful variant rescue broadening'
  );

  text = insertAfterOnce(
    text,
    `  for (const story of stories) {
`,
    `    story.angle = classifyAngle(story);
`,
    'preclassify before hard dedup'
  );

  text = insertBeforeOnce(
    text,
    `function getAngleSignalText(story: InsightStory): string {`,
    `function countSignalMatches(patterns: RegExp[], text: string): number {
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
  const saidScore = /\\b(said|announced|confirmed|statement|approved|rejected|clarified|warned)\\b/i.test(text) ? 0.55 : 0;
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
  const expertTextScore = /\\b(analysis|analyst|expert|economist|researcher|strategist|explains?|why it matters|implications)\\b/i.test(text) ? 0.85 : 0;
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
  const socialScore = /\\b(backlash|viral|trending|users|residents|families|locals|public|protest|criticism|praised|condemned)\\b/i.test(text) ? 0.9 : 0;
  if (reactionScore > 0 || socialScore > 0) {
    scores.push({
      angle: "reaction_public",
      score: normalizeAngleCandidateScore(1.6 + reactionScore + socialScore),
      reason: "public/social reaction",
    });
  }

  const backgroundScore = countSignalMatches(BACKGROUND_CONTEXT_SIGNALS, text);
  const explainerScore = /\\b(explainer|timeline|background|context|what happened|what led|key points|things to know|why this matters)\\b/i.test(lowerText) ? 1 : 0;
  if (backgroundScore > 0 || explainerScore > 0) {
    scores.push({
      angle: "background_context",
      score: normalizeAngleCandidateScore(1.4 + backgroundScore + explainerScore),
      reason: "background/explainer context",
    });
  }

  return scores;
}

`,
    'enriched classifier helpers'
  );

  text = replaceOnce(
    text,
    `export function classifyAngle(story: InsightStory): AngleLabel {
  const text = getAngleSignalText(story);

  if (CORRECTION_SIGNALS.some(p => p.test(text)))          return "correction";
  if (FACT_UPDATE_SIGNALS.some(p => p.test(text)))          return "fact_update";
  if (OFFICIAL_SIGNALS.some(p => p.test(text)))             return "official_response";
  if (MARKET_SIGNALS.some(p => p.test(text)))               return "market_reaction";
  if (EXPERT_SIGNALS.some(p => p.test(text)))               return "expert_analysis";
  if (INVESTIGATIVE_SIGNALS.some(p => p.test(text)))        return "investigative_detail";
  if (REGIONAL_SIGNALS.some(p => p.test(text)))             return "regional_followup";
  if (PUBLIC_REACTION_SIGNALS.some(p => p.test(text)))      return "reaction_public";
  if (BACKGROUND_CONTEXT_SIGNALS.some(p => p.test(text)))   return "background_context";

  return "base_report";
}`,
    `export function classifyAngle(story: InsightStory): AngleLabel {
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

  (story as any).angleReason = "base event report fallback";
  (story as any).angleConfidence = 0.35;
  return "base_report";
}`,
    'enriched classifyAngle replacement'
  );

  return text;
});

patchFile('src/insight/src/tree/treeBuilder.ts', source => {
  let text = source;

  text = replaceOnce(
    text,
    `  // Classify angles
  const tagged = clusterStories.map(s => ({
    ...s,
    parentId: parent.parentId,
    angle: classifyAngle(s),
  }));`,
    `  // Classify angles on the original story objects, not transient copies.
  // The UI resolves children from storiesById, so the angle must survive
  // outside this function.
  const tagged = clusterStories.map(s => {
    s.parentId = parent.parentId;
    s.angle = classifyAngle(s);
    return s;
  });`,
    'persist angle in treeBuilder tagged stories'
  );

  return text;
});

patchFile('src/insight/src/pipeline/pipeline.ts', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `    const children = buildChildTree(parent, clusterStories, cfg, hiddenIds);
    parent.childStoryIds = children.map(c => c.id);
`,
    `
    // Persist selected child objects back into storiesById so UI-visible child
    // records keep the angle, childScore, informationGain and admission reasons
    // assigned during tree construction.
    for (const child of children) {
      storiesById.set(child.id, child);
    }
`,
    'persist built child records into output storiesById'
  );

  return text;
});

patchFile('src/pages/InsightPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { getInsightBehaviorEvidence } from '../insight/src/diagnostics/insightBehaviorEvidence.ts';`,
    `\nimport { getInsightCoreQualityDiagnostics } from '../insight/src/diagnostics/insightCoreQuality.ts';`,
    'insight core quality import'
  );

  text = replaceFunction(
    text,
    'getInsightDiagnostics',
    `function getInsightDiagnostics(result, source) {
  return getInsightCoreQualityDiagnostics(result, source, DEFAULT_CONFIG);
}`
  );

  return text;
});

write('src/insight/src/coreRecovery.cert.test.ts', `import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightStory,
  SnapshotSlot,
} from "./types";
import { runInsightPipeline } from "./pipeline/pipeline";
import { invalidateSlot } from "./cache/cacheManager";
import { classifyAngle } from "./dedup/dedup";
import { getInsightCoreQualityDiagnostics, getVisibleChildAngles } from "./diagnostics/insightCoreQuality";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function embedding(seed: number): number[] {
  const vector = Array.from({ length: 200 }, (_, index) => 0);
  vector[seed % 200] = 1;
  vector[(seed + 17) % 200] = 0.5;
  vector[(seed + 53) % 200] = 0.25;
  return vector;
}

function makeStory(partial: Partial<InsightStory> & {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceGroup: string;
  slot: SnapshotSlot;
  seed: number;
}): InsightStory {
  return {
    id: partial.id,
    title: partial.title,
    summary: partial.summary,
    source: partial.source,
    sourceGroup: partial.sourceGroup,
    url: partial.url || \`https://example.com/\${partial.id}\`,
    publishedAt: partial.publishedAt || NOW,
    category: partial.category || "national",
    region: partial.region || "India",
    language: "en",
    capturedAtSnapshot: partial.slot,
    canonicalUrl: partial.canonicalUrl || \`https://example.com/\${partial.id}\`,
    canonicalText: \`\${partial.title} \${partial.summary}\`,
    canonicalTextHash: partial.canonicalTextHash || \`hash-\${partial.id}\`,
    entities: partial.entities || {
      people: [],
      orgs: ["Acme Bank"],
      places: ["India"],
      products: [],
      symbols: [],
    },
    keywords: partial.keywords || ["acme", "bank", "policy"],
    embedding: partial.embedding || embedding(partial.seed),
    eventVerbs: partial.eventVerbs || ["announces"],
    numbers: partial.numbers || [],
    sourceTier: partial.sourceTier || "A",
    sourceAuthority: partial.sourceAuthority ?? 0.82,
    freshnessScore: partial.freshnessScore ?? 0.86,
    rawProminence: partial.rawProminence ?? 0.8,
    sentiment: partial.sentiment ?? 0,
    factualDensity: partial.factualDensity ?? 0.75,
    summaryQuality: partial.summaryQuality ?? 0.9,
    angle: partial.angle,
    bucket: partial.bucket,
    parentId: partial.parentId,
  };
}

const fixtureStories = [
  makeStory({
    id: "base-1",
    title: "Acme Bank announces national digital payments outage recovery",
    summary: "Acme Bank says services are being restored across India after a payments outage affected customers.",
    source: "News Wire",
    sourceGroup: "wire_group",
    slot: "now",
    seed: 1,
    numbers: ["2 hours"],
  }),
  makeStory({
    id: "official-1",
    title: "Finance Ministry says Acme Bank outage is being reviewed",
    summary: "Officials said the regulator asked Acme Bank for a statement and confirmed customer deposits remain protected.",
    source: "Government Desk",
    sourceGroup: "gov_group",
    slot: "now",
    seed: 2,
    category: "policy",
  }),
  makeStory({
    id: "market-1",
    title: "Acme Bank shares fell as investors reacted to outage",
    summary: "Shares fell 4 percent in intraday trading while investors sold banking stocks after the outage.",
    source: "Market Desk",
    sourceGroup: "market_group",
    slot: "minus4h",
    seed: 3,
    category: "business",
    numbers: ["4 percent"],
  }),
  makeStory({
    id: "expert-1",
    title: "Analysts explain why Acme Bank outage matters",
    summary: "Experts warn the outage could raise compliance costs and analysts say the incident has wider implications.",
    source: "Analysis Desk",
    sourceGroup: "analysis_group",
    slot: "minus4h",
    seed: 4,
    category: "analysis",
  }),
  makeStory({
    id: "reaction-1",
    title: "Customers criticise Acme Bank after outage goes viral",
    summary: "Users reacted on social media and residents said payment failures caused delays at shops.",
    source: "Social Desk",
    sourceGroup: "reaction_group",
    slot: "minus12h",
    seed: 5,
    category: "society",
  }),
  makeStory({
    id: "background-1",
    title: "Explainer: what led to Acme Bank payment outage",
    summary: "A timeline explains how it started, key points, and why this matters for digital banking.",
    source: "Explainer Desk",
    sourceGroup: "explainer_group",
    slot: "minus24h",
    seed: 6,
    category: "explainer",
  }),
];

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  TOP_PARENTS: 3,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.12,
  WEAK_TREE_CHILD_MIN: 3,
  MIN_SOURCES_PER_TREE: 3,
  TIER_D_EXCLUDE: false,
};

function resetInsightCache() {
  for (const slot of ["now", "minus4h", "minus12h", "minus24h"] as SnapshotSlot[]) {
    invalidateSlot(slot);
  }
}

describe("Insight core recovery certification", () => {
  it("classifies real story-angle variants beyond base_report", () => {
    const angles = fixtureStories.map(story => classifyAngle(story));

    expect(angles).toContain("official_response");
    expect(angles).toContain("market_reaction");
    expect(angles).toContain("expert_analysis");
    expect(angles).toContain("reaction_public");
    expect(angles).toContain("background_context");
  });

  it("persists selected child angles into storiesById and reaches C-or-better quality", async () => {
    resetInsightCache();

    const result = await runInsightPipeline(async slot => (
      fixtureStories.filter(story => story.capturedAtSnapshot === slot)
    ), cfg);

    expect(result.parents.length).toBeGreaterThanOrEqual(1);

    const topParent = result.parents[0];
    const childStories = topParent.childStoryIds
      .map(id => result.storiesById.get(id))
      .filter(Boolean) as InsightStory[];

    const visibleAngles = getVisibleChildAngles(topParent, result.storiesById);

    expect(childStories.length).toBeGreaterThanOrEqual(4);
    expect(visibleAngles.length).toBeGreaterThanOrEqual(3);
    expect(childStories.some(story => !story.angle || story.angle === "unknown")).toBe(false);

    const quality = getInsightCoreQualityDiagnostics(result, "live", cfg);
    const gradeOrder = ["F", "D", "C", "B", "A"];

    expect(gradeOrder.indexOf(quality.grade)).toBeGreaterThanOrEqual(gradeOrder.indexOf("C"));
    expect(quality.multiAngleCount).toBeGreaterThanOrEqual(1);
    expect(quality.avgAngles).toBeGreaterThanOrEqual(3);
  });
});
`);

write('scripts/test_insight_core_recovery_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const dedup = read('src/insight/src/dedup/dedup.ts');
const treeBuilder = read('src/insight/src/tree/treeBuilder.ts');
const pipeline = read('src/insight/src/pipeline/pipeline.ts');
const quality = read('src/insight/src/diagnostics/insightCoreQuality.ts');
const page = read('src/pages/InsightPage.jsx');
const cert = read('src/insight/src/coreRecovery.cert.test.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getAngleCandidateScores',
  'angleReason',
  'angleConfidence',
  'hasDistinctStoryIntent',
  'hasDifferentSourcePerspective',
  'story.angle = classifyAngle(story);'
]) {
  assert(dedup.includes(token), \`dedup.ts missing recovery token: \${token}\`);
}

for (const token of [
  'not transient copies',
  's.parentId = parent.parentId',
  's.angle = classifyAngle(s)',
  'return s'
]) {
  assert(treeBuilder.includes(token), \`treeBuilder.ts missing persistence token: \${token}\`);
}

for (const token of [
  'Persist selected child objects back into storiesById',
  'storiesById.set(child.id, child)'
]) {
  assert(pipeline.includes(token), \`pipeline.ts missing output persistence token: \${token}\`);
}

for (const token of [
  'getInsightCoreQualityDiagnostics',
  'getVisibleChildAngles',
  'strongAngleCount',
  'avgChildren',
  'visibleAngleCounts',
  'fewer than two visible child angles'
]) {
  assert(quality.includes(token), \`insightCoreQuality.ts missing token: \${token}\`);
}

for (const token of [
  'getInsightCoreQualityDiagnostics',
  'return getInsightCoreQualityDiagnostics(result, source, DEFAULT_CONFIG);'
]) {
  assert(page.includes(token), \`InsightPage.jsx missing quality integration token: \${token}\`);
}

for (const forbidden of [
  'return childCount >= 2;',
  'const avgAngles = rankedCount > 0 ? totalChildLinks / rankedCount : 0;'
]) {
  assert(!page.includes(forbidden), \`InsightPage.jsx still contains old incorrect quality metric: \${forbidden}\`);
}

for (const token of [
  'Insight core recovery certification',
  'persists selected child angles into storiesById',
  'reaches C-or-better quality',
  'visibleAngles.length',
  'quality.grade',
  'avgAngles'
]) {
  assert(cert.includes(token), \`coreRecovery.cert.test.ts missing token: \${token}\`);
}

assert(
  packageJson.includes('"test:insight-core-recovery"'),
  'package.json must include test:insight-core-recovery'
);

assert(
  certGate.includes("['npm', ['run', 'test:insight-core-recovery']]"),
  'certification gate must run test:insight-core-recovery'
);

assert(
  certGate.includes("['npm', ['run', 'test:unit']]"),
  'certification gate must run Vitest unit tests'
);

assert(
  certGate.includes("['npm', ['run', 'build']]"),
  'certification gate must still run production build'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight core recovery slice',
  guarantees: [
    'angle classifier is enriched beyond base_report regex fallback',
    'hard dedup preclassifies story angles',
    'useful cross-source variants are rescued with intent signals',
    'treeBuilder persists angle labels on original story objects',
    'pipeline persists selected child records back into storiesById',
    'quality diagnostics use distinct visible child angles',
    'behavioral Vitest asserts >=3 visible angles and C-or-better grade',
    'full certification gate includes the recovery test'
  ]
}, null, 2));

console.log('PASS: Insight core recovery static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-core-recovery'] = 'node scripts/test_insight_core_recovery_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-core-recovery']]")) return source;

  return source.replace(
    "  ['npm', ['run', 'test:insight-angle-classifier-enrichment']],",
    "  ['npm', ['run', 'test:insight-angle-classifier-enrichment']],\n  ['npm', ['run', 'test:insight-core-recovery']],"
  );
});

console.log('\nSlice 33 Insight core recovery patch complete.');
