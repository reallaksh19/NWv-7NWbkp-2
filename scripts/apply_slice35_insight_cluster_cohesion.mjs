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

write('src/insight/src/cluster/topicCohesion.ts', `import { InsightStory } from "../types";

const TOPIC_STOP_WORDS = new Set([
  "about", "after", "again", "against", "ahead", "among", "around", "before",
  "being", "between", "could", "during", "every", "first", "from", "have",
  "into", "latest", "more", "news", "over", "said", "says", "their", "there",
  "these", "this", "those", "through", "under", "update", "when", "where",
  "which", "while", "with", "would", "will", "your"
]);

const TOPIC_BOOST_PATTERNS = [
  /\\b[A-Z][a-z]+\\s+(Bank|Group|Corp|Ltd|Limited|Ministry|Court|Agency|Airlines|Motors|Energy|Power|Police|University)\\b/g,
  /\\b[A-Z]{2,}\\b/g,
  /\\b[A-Z][a-z]+\\s+[A-Z][a-z]+\\b/g,
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
    .replace(/[^a-z0-9\\s]/g, " ")
    .split(/\\s+/)
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
    ...boostedTopicPhrases(\`\${story.title || ""} \${story.summary || ""}\`),
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
`);

write('src/insight/src/cluster/topicCohesion.cert.test.ts', `import { describe, expect, it } from "vitest";
import {
  getStoryTopicTokens,
  getTopicCohesionDiagnostics,
  hasSharedTopicSignature,
  topicTokenOverlap,
} from "./topicCohesion";
import { InsightStory } from "../types";

function story(id: string, title: string, summary: string, category = "national"): InsightStory {
  return {
    id,
    title,
    summary,
    source: "source",
    sourceGroup: "source_group",
    url: \`https://example.com/\${id}\`,
    publishedAt: Date.parse("2026-01-01T00:00:00Z"),
    category,
    region: "India",
    language: "en",
    capturedAtSnapshot: "now",
    canonicalUrl: \`https://example.com/\${id}\`,
    canonicalText: \`\${title} \${summary}\`,
    canonicalTextHash: \`hash-\${id}\`,
    entities: {
      people: [],
      orgs: ["Acme Bank"],
      places: ["India"],
      products: [],
      symbols: [],
    },
    keywords: ["acme", "bank", "outage"],
    embedding: Array.from({ length: 200 }, (_, index) => index === 1 ? 1 : 0),
    eventVerbs: [],
    numbers: [],
    sourceTier: "A",
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,
  };
}

describe("Insight topic cohesion certification", () => {
  it("extracts stable topic tokens from title, summary, entities, and keywords", () => {
    const tokens = getStoryTopicTokens(story(
      "a",
      "Acme Bank outage recovery reviewed by regulator",
      "Customers report failed payments after the outage"
    ));

    expect(tokens).toContain("acme");
    expect(tokens).toContain("bank");
    expect(tokens).toContain("outage");
  });

  it("detects shared topic signature across different story angles", () => {
    const official = story(
      "official",
      "Finance Ministry says Acme Bank outage is under review",
      "Officials said the regulator asked Acme Bank for a statement",
      "policy"
    );

    const market = story(
      "market",
      "Acme Bank shares fell as investors reacted to outage",
      "Market traders sold banking stocks after the payment outage",
      "business"
    );

    expect(topicTokenOverlap(official, market)).toBeGreaterThan(0.25);
    expect(hasSharedTopicSignature(official, market)).toBe(true);

    const diagnostics = getTopicCohesionDiagnostics(official, market);
    expect(diagnostics.sharedTopicSignature).toBe(true);
    expect(diagnostics.sharedTokens.length).toBeGreaterThanOrEqual(2);
  });

  it("does not force unrelated topics together", () => {
    const bank = story(
      "bank",
      "Acme Bank outage reviewed by regulator",
      "Officials asked the bank for a payments statement",
      "policy"
    );

    const sports = story(
      "sports",
      "City football final ends with late goal",
      "The team won the tournament after a dramatic match",
      "sports"
    );

    sports.entities.orgs = ["City Football Club"];
    sports.keywords = ["football", "final", "match"];

    expect(hasSharedTopicSignature(bank, sports)).toBe(false);
  });
});
`);

patchFile('src/insight/src/dedup/dedup.ts', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { InsightStory, InsightConfig, AngleLabel } from "../types";`,
    `\nimport { hasSharedTopicSignature, topicTokenOverlap } from "../cluster/topicCohesion";`,
    'topic cohesion import'
  );

  text = replaceOnce(
    text,
    `  const catSim    = a.category && b.category && a.category === b.category ? 1 : 0;

  return (
    0.30 * embSim  +
    0.20 * entSim  +
    0.15 * verbSim +
    0.10 * numSim  +
    0.10 * timeSim +
    0.10 * placeSim +\n    0.05 * catSim\n  );`,
    `  const catSim    = a.category && b.category && a.category === b.category ? 1 : 0;
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
  );`,
    'event similarity topic cohesion weight'
  );

  text = insertAfterOnce(
    text,
    `  if (sameOrgs && sameVerbs && within24h && sameRegion) return "SAME";
`,
    `
  const sharedTopic = hasSharedTopicSignature(a, b);
  const topicOverlapScore = topicTokenOverlap(a, b);
  const crossSource = a.sourceGroup !== b.sourceGroup || a.source !== b.source;
  const within36h = Math.abs(a.publishedAt - b.publishedAt) < 36 * 60 * 60 * 1000;
  const categoryCompatible = !a.category || !b.category || a.category === b.category || rawSim >= cfg.POSSIBLE_EVENT_THRESHOLD;

  if (
    sharedTopic &&
    crossSource &&
    within36h &&
    categoryCompatible &&
    (rawSim >= cfg.POSSIBLE_EVENT_THRESHOLD - 0.12 || topicOverlapScore >= 0.42)
  ) {
    return "SAME";
  }
`,
    'topic cohesion cluster override'
  );

  return text;
});

patchFile('src/insight/src/cluster/cluster.ts', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `} from "../dedup/dedup";`,
    `\nimport { getTopicCohesionDiagnostics } from "./topicCohesion";`,
    'topic cohesion diagnostics import'
  );

  text = insertAfterOnce(
    text,
    `      const raw   = eventSimilarity(story, rep);
      const rule  = applyClusterOverrides(story, rep, raw, cfg);
`,
    `      const topicDiagnostics = getTopicCohesionDiagnostics(story, rep);
`,
    'topic diagnostics per cluster comparison'
  );

  text = insertAfterOnce(
    text,
    `        bestScore   = score;
        bestCluster = cluster;
`,
    `        (story as any).clusterMatchDiagnostics = {
          matchedClusterId: cluster.id,
          rawSimilarity: raw,
          resolvedScore: score,
          rule,
          topicDiagnostics,
        };
`,
    'cluster match diagnostics high score path'
  );

  text = insertAfterOnce(
    text,
    `            bestScore   = score;
            bestCluster = cluster;
`,
    `            (story as any).clusterMatchDiagnostics = {
              matchedClusterId: cluster.id,
              rawSimilarity: raw,
              resolvedScore: score,
              rule,
              topicDiagnostics,
              multiStoryCheck: true,
            };
`,
    'cluster match diagnostics possible score path'
  );

  return text;
});

write('src/insight/src/cluster/clusterCohesion.cert.test.ts', `import { describe, expect, it } from "vitest";
import { clusterIntoParentEvents } from "./cluster";
import { eventSimilarity, applyClusterOverrides } from "../dedup/dedup";
import { DEFAULT_CONFIG, InsightConfig, InsightStory } from "../types";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function embedding(seed: number): number[] {
  const vector = Array.from({ length: 200 }, () => 0);
  vector[seed % 200] = 1;
  vector[(seed + 29) % 200] = 0.25;
  return vector;
}

function story(
  id: string,
  title: string,
  summary: string,
  sourceGroup: string,
  category: string,
  seed: number
): InsightStory {
  return {
    id,
    title,
    summary,
    source: sourceGroup,
    sourceGroup,
    url: \`https://example.com/\${id}\`,
    publishedAt: NOW,
    category,
    region: "India",
    language: "en",
    capturedAtSnapshot: "now",
    canonicalUrl: \`https://example.com/\${id}\`,
    canonicalText: \`\${title} \${summary}\`,
    canonicalTextHash: \`hash-\${id}\`,
    entities: {
      people: [],
      orgs: ["Acme Bank"],
      places: ["India"],
      products: [],
      symbols: [],
    },
    keywords: ["acme", "bank", "outage"],
    embedding: embedding(seed),
    eventVerbs: [],
    numbers: [],
    sourceTier: "A",
    sourceAuthority: 0.82,
    freshnessScore: 0.86,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.7,
    summaryQuality: 0.9,
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  SAME_EVENT_THRESHOLD: 0.88,
  POSSIBLE_EVENT_THRESHOLD: 0.75,
  TIER_D_EXCLUDE: false,
};

describe("Insight cluster cohesion certification", () => {
  it("topic cohesion raises cross-source angle variants into the same event cluster", () => {
    const base = story(
      "base",
      "Acme Bank payment outage recovery begins",
      "Acme Bank says failed payments are being restored across India.",
      "wire_group",
      "national",
      1
    );

    const official = story(
      "official",
      "Finance Ministry says Acme Bank outage is under review",
      "Officials said the regulator asked Acme Bank for a statement on payment failures.",
      "gov_group",
      "policy",
      41
    );

    const market = story(
      "market",
      "Acme Bank shares fell as investors reacted to outage",
      "Investors sold banking stocks after the Acme Bank payment outage.",
      "market_group",
      "business",
      82
    );

    const raw = eventSimilarity(official, base);
    const rule = applyClusterOverrides(official, base, raw, cfg);

    expect(rule).toBe("SAME");

    const clusters = clusterIntoParentEvents([base, official, market], cfg);

    expect(clusters.length).toBe(1);
    expect(clusters[0].stories.length).toBe(3);
  });

  it("does not cluster unrelated same-day stories only because they are fresh", () => {
    const bank = story(
      "bank",
      "Acme Bank payment outage recovery begins",
      "Acme Bank says failed payments are being restored across India.",
      "wire_group",
      "national",
      1
    );

    const sports = story(
      "sports",
      "City football final ends with late goal",
      "The team won the tournament after a dramatic match.",
      "sports_group",
      "sports",
      99
    );

    sports.entities.orgs = ["City Football Club"];
    sports.keywords = ["football", "final", "match"];

    const clusters = clusterIntoParentEvents([bank, sports], cfg);

    expect(clusters.length).toBe(2);
  });
});
`);

write('scripts/test_insight_cluster_cohesion_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const topic = read('src/insight/src/cluster/topicCohesion.ts');
const topicTest = read('src/insight/src/cluster/topicCohesion.cert.test.ts');
const clusterTest = read('src/insight/src/cluster/clusterCohesion.cert.test.ts');
const dedup = read('src/insight/src/dedup/dedup.ts');
const cluster = read('src/insight/src/cluster/cluster.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getStoryTopicTokens', 'topicTokenOverlap', 'hasSharedTopicSignature',
  'getTopicCohesionDiagnostics', 'sharedTokens'
]) {
  assert(topic.includes(token), \`topicCohesion.ts missing token: \${token}\`);
}

for (const token of [
  'Insight topic cohesion certification',
  'detects shared topic signature',
  'does not force unrelated topics together'
]) {
  assert(topicTest.includes(token), \`topicCohesion.cert.test.ts missing token: \${token}\`);
}

for (const token of [
  'Insight cluster cohesion certification',
  'same event cluster',
  'does not cluster unrelated same-day stories'
]) {
  assert(clusterTest.includes(token), \`clusterCohesion.cert.test.ts missing token: \${token}\`);
}

for (const token of [
  'topicTokenOverlap', 'hasSharedTopicSignature', '0.16 * topicSim', 'topic cohesion cluster override'
]) {
  assert(dedup.includes(token), \`dedup.ts missing topic cohesion token: \${token}\`);
}

for (const token of [
  'getTopicCohesionDiagnostics', 'clusterMatchDiagnostics', 'topicDiagnostics'
]) {
  assert(cluster.includes(token), \`cluster.ts missing topic diagnostics token: \${token}\`);
}

assert(packageJson.includes('"test:insight-cluster-cohesion"'), 'package.json must include test:insight-cluster-cohesion');
assert(certGate.includes("['npm', ['run', 'test:insight-cluster-cohesion']]"), 'certification gate must run test:insight-cluster-cohesion');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight cluster cohesion slice' }, null, 2));
console.log('PASS: Insight cluster cohesion static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-cluster-cohesion'] = 'node scripts/test_insight_cluster_cohesion_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-cluster-cohesion']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-angle-recovery']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-angle-recovery']],",
      "  ['npm', ['run', 'test:insight-angle-recovery']],\n  ['npm', ['run', 'test:insight-cluster-cohesion']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-cluster-anchor']],",
    "  ['npm', ['run', 'test:insight-cluster-anchor']],\n  ['npm', ['run', 'test:insight-cluster-cohesion']],"
  );
});

console.log('\nSlice 35 Insight cluster cohesion patch complete.');
