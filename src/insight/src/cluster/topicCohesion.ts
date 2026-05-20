import { InsightStory } from "../types";

const TOPIC_STOP_WORDS = new Set([
  "about", "after", "again", "against", "ahead", "among", "around", "before",
  "being", "between", "could", "during", "every", "first", "from", "have",
  "into", "latest", "more", "news", "over", "said", "says", "their", "there",
  "these", "this", "those", "through", "under", "update", "when", "where",
  "which", "while", "with", "would", "will", "your"
]);

const TOPIC_BOOST_PATTERNS = [
  /\b[A-Z][a-z]+\s+(Bank|Group|Corp|Ltd|Limited|Ministry|Court|Agency|Airlines|Motors|Energy|Power|Police|University)\b/g,
  /\b[A-Z]{2,}\b/g,
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
];

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(token => token.length >= 4)
    .filter(token => !TOPIC_STOP_WORDS.has(token));
}

function boostedTopicPhrases(text: string): string[] {
  const phrases: string[] = [];

  for (const pattern of TOPIC_BOOST_PATTERNS) {
    for (const match of String(text || "").matchAll(pattern)) {
      const phrase = normalizeToken(match[0]);
      if (phrase.length >= 4) phrases.push(phrase);
    }
  }

  return phrases;
}

export function getStoryTopicTokens(story: InsightStory): string[] {
  const text = [
    story.title,
    story.summary,
    story.category,
    story.region,
    ...(story.entities?.orgs || []),
    ...(story.entities?.places || []),
    ...(story.entities?.people || []),
    ...(story.entities?.products || []),
    ...(story.keywords || []),
  ].filter(Boolean).join(" ");

  const tokens = [
    ...tokenize(text),
    ...boostedTopicPhrases(`${story.title || ""} ${story.summary || ""}`),
    ...(story.entities?.orgs || []).map(normalizeToken),
    ...(story.entities?.places || []).map(normalizeToken),
  ].filter(Boolean);

  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([token]) => token)
    .slice(0, 16);
}

export function topicTokenOverlap(a: InsightStory, b: InsightStory): number {
  const aTokens = new Set(getStoryTopicTokens(a));
  const bTokens = new Set(getStoryTopicTokens(b));

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  const smallerSetSize = Math.min(aTokens.size, bTokens.size);
  const containment = intersection / Math.max(1, smallerSetSize);

  const union = aTokens.size + bTokens.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  return Math.max(jaccard, containment * 0.72);
}

export function hasSharedTopicSignature(a: InsightStory, b: InsightStory): boolean {
  const overlap = topicTokenOverlap(a, b);

  if (overlap >= 0.34) return true;

  const aTokens = new Set(getStoryTopicTokens(a));
  const bTokens = new Set(getStoryTopicTokens(b));

  const strongTokens = [...aTokens].filter(token => {
    if (!bTokens.has(token)) return false;

    return token.length >= 7 ||
      /bank|ministry|court|market|shares|outage|policy|election|storm|crash|launch|strike|attack|regulator/.test(token);
  });

  return strongTokens.length >= 2;
}

export function getTopicCohesionDiagnostics(a: InsightStory, b: InsightStory) {
  const aTokens = getStoryTopicTokens(a);
  const bTokens = getStoryTopicTokens(b);
  const bSet = new Set(bTokens);
  const shared = aTokens.filter(token => bSet.has(token));

  return {
    topicOverlap: topicTokenOverlap(a, b),
    sharedTopicSignature: hasSharedTopicSignature(a, b),
    aTokens,
    bTokens,
    sharedTokens: shared,
  };
}
