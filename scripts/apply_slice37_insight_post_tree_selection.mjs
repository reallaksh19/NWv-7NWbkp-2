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

function insertBeforeOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function replaceFunction(source, functionName, replacement) {
  const marker = `function ${functionName}`;
  let start = source.indexOf(marker);

  if (start < 0) {
    const exportedMarker = `export function ${functionName}`;
    start = source.indexOf(exportedMarker);
  }

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

patchFile('src/insight/src/pipeline/pipeline.ts', source => {
  let text = source;

  text = insertBeforeOnce(
    text,
    `// ── Top-parent selection with weak tree demotion ──────────────────────────────`,
    `function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getParentChildStories(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): InsightStory[] {
  return safeArray(parent.childStoryIds)
    .map(id => storiesById.get(id))
    .filter(Boolean) as InsightStory[];
}

function getVisibleAngleCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const angles = new Set(
    getParentChildStories(parent, storiesById)
      .map(story => story.angle || "unknown")
      .filter(angle => angle !== "unknown")
  );

  return angles.size;
}

function getChildSourceGroupCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const sourceGroups = new Set(
    getParentChildStories(parent, storiesById)
      .map(story => story.sourceGroup || story.source || "unknown")
  );

  return sourceGroups.size;
}

function getClusterSnapshotCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const snapshots = new Set(
    safeArray(parent.clusterStoryIds)
      .map(id => storiesById.get(id))
      .filter(Boolean)
      .map(story => story?.capturedAtSnapshot)
      .filter(Boolean)
  );

  return snapshots.size;
}

function getAngleRecoveryCount(parent: InsightParent): number {
  const diagnostics = (parent.debug as any)?.childSelectionDiagnostics;
  return Number(diagnostics?.angleRecovery?.recoveredCount || 0);
}

export function computePostTreeQualityScore(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): number {
  const childCount = safeArray(parent.childStoryIds).length;
  const visibleAngleCount = getVisibleAngleCount(parent, storiesById);
  const childSourceGroupCount = getChildSourceGroupCount(parent, storiesById);
  const snapshotCount = getClusterSnapshotCount(parent, storiesById);
  const recoveryCount = getAngleRecoveryCount(parent);

  const baseScore = clamp01(Number(parent.finalParentScore || 0));
  const angleBonus = Math.min(0.30, visibleAngleCount * 0.09);
  const strongAngleBonus = visibleAngleCount >= 3 ? 0.10 : 0;
  const childDepthBonus = Math.min(0.12, (childCount / Math.max(1, cfg.WEAK_TREE_CHILD_MIN)) * 0.10);
  const sourceDiversityBonus = Math.min(0.10, (childSourceGroupCount / Math.max(1, cfg.MIN_SOURCES_PER_TREE)) * 0.08);
  const snapshotBonus = Math.min(0.08, snapshotCount * 0.02);
  const recoveryBonus = Math.min(0.06, recoveryCount * 0.02);

  const singleAnglePenalty = visibleAngleCount < 2 ? 0.22 : 0;
  const weakTreePenalty = parent.weakTree ? 0.18 : 0;
  const thinChildPenalty = childCount < cfg.WEAK_TREE_CHILD_MIN ? 0.10 : 0;

  const postTreeQualityScore =
    baseScore +
    angleBonus +
    strongAngleBonus +
    childDepthBonus +
    sourceDiversityBonus +
    snapshotBonus +
    recoveryBonus -
    singleAnglePenalty -
    weakTreePenalty -
    thinChildPenalty;

  const roundedScore = Math.round(postTreeQualityScore * 10000) / 10000;

  (parent.debug as any).postTreeQualityDiagnostics = {
    formulaVersion: "post-tree-quality-v1-angle-first-selection",
    baseScore,
    childCount,
    visibleAngleCount,
    childSourceGroupCount,
    snapshotCount,
    recoveryCount,
    angleBonus,
    strongAngleBonus,
    childDepthBonus,
    sourceDiversityBonus,
    snapshotBonus,
    recoveryBonus,
    singleAnglePenalty,
    weakTreePenalty,
    thinChildPenalty,
    postTreeQualityScore: roundedScore,
  };

  return roundedScore;
}

`,
    'post-tree quality helpers'
  );

  text = replaceFunction(
    text,
    'selectTopParentsWithWeakTreeCheck',
    `export function selectTopParentsWithWeakTreeCheck(
  ranked: InsightParent[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig,
  hiddenIds: Set<string>
): InsightParent[] {
  const evaluated: InsightParent[] = [];

  for (const parent of ranked) {
    const clusterStories = parent.clusterStoryIds
      .map(id => storiesById.get(id))
      .filter(Boolean) as InsightStory[];

    const children = buildChildTree(parent, clusterStories, cfg, hiddenIds);
    parent.childStoryIds = children.map(c => c.id);

    // Persist selected child objects back into storiesById so UI-visible child
    // records keep the angle, childScore, informationGain and admission reasons
    // assigned during tree construction.
    for (const child of children) {
      storiesById.set(child.id, child);
    }

    const clusterIdSet = new Set(parent.clusterStoryIds);
    parent.hiddenDuplicateIds = [...hiddenIds].filter(id => clusterIdSet.has(id));

    parent.weakTree = isWeakTree(children, cfg);
    computePostTreeQualityScore(parent, storiesById, cfg);

    evaluated.push(parent);
  }

  evaluated.sort((a, b) => {
    const aQuality = Number((a.debug as any)?.postTreeQualityDiagnostics?.postTreeQualityScore || 0);
    const bQuality = Number((b.debug as any)?.postTreeQualityDiagnostics?.postTreeQualityScore || 0);

    if (bQuality !== aQuality) return bQuality - aQuality;
    if (b.finalParentScore !== a.finalParentScore) return b.finalParentScore - a.finalParentScore;

    return b.latestSeenAt - a.latestSeenAt;
  });

  const strongTrees = evaluated.filter(parent => !parent.weakTree);
  const weakTrees = evaluated.filter(parent => parent.weakTree);

  return [...strongTrees, ...weakTrees].slice(0, cfg.TOP_PARENTS);
}`
  );

  return text;
});

write('src/insight/src/pipeline/postTreeSelection.cert.test.ts', `import { describe, expect, it } from "vitest";
import {
  computePostTreeQualityScore,
  selectTopParentsWithWeakTreeCheck,
} from "./pipeline";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightParent,
  InsightStory,
} from "../types";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function vector(seed: number): number[] {
  const values = Array.from({ length: 200 }, () => 0);
  values[seed % 200] = 1;
  values[(seed + 17) % 200] = 0.4;
  return values;
}

function story(
  id: string,
  title: string,
  summary: string,
  sourceGroup: string,
  seed: number,
  angle?: any
): InsightStory {
  return {
    id,
    title,
    summary,
    source: sourceGroup,
    sourceGroup,
    url: \`https://example.com/\${id}\`,
    publishedAt: NOW,
    category: "news",
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
    embedding: vector(seed),
    eventVerbs: ["announces"],
    numbers: [],
    sourceTier: "A",
    sourceAuthority: 0.82,
    freshnessScore: 0.86,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.7,
    summaryQuality: 0.9,
    angle,
  };
}

function parent(
  id: string,
  storyIds: string[],
  finalParentScore: number,
  weakTree = false
): InsightParent {
  return {
    parentId: id,
    canonicalHeadline: id,
    canonicalSummary: id,
    clusterStoryIds: storyIds,
    childStoryIds: storyIds,
    hiddenDuplicateIds: [],
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: NOW,
    latestSeenAt: NOW,
    snapshotPresence: {
      now: true,
      minus4h: false,
      minus12h: false,
      minus24h: false,
    },
    impactScore: finalParentScore,
    persistenceScore: finalParentScore,
    sourceDiversityScore: finalParentScore,
    noveltyScore: finalParentScore,
    freshnessScore: finalParentScore,
    crossSnapshotMomentum: finalParentScore,
    editorialClarityScore: finalParentScore,
    regionBoost: 0,
    finalParentScore,
    isRising: false,
    weakTree,
    debug: {
      clusterSize: storyIds.length,
      hiddenCount: 0,
      matchedSnapshots: ["now"],
      scoreBreakdown: {},
      replacements: [],
    },
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  TOP_PARENTS: 1,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.95,
  WEAK_TREE_CHILD_MIN: 3,
  MIN_SOURCES_PER_TREE: 3,
  TIER_D_EXCLUDE: false,
};

describe("Insight post-tree selection certification", () => {
  it("gives higher post-tree quality to multi-angle trees than single-angle thin trees", () => {
    const storiesById = new Map<string, InsightStory>();

    const singleStories = [
      story("single-1", "High authority market update", "General update without a second perspective.", "wire", 1, "base_report"),
    ];

    const multiStories = [
      story("multi-official", "Finance Ministry says Acme Bank outage is under review", "Officials said regulator asked for statement.", "gov", 2, "official_response"),
      story("multi-market", "Acme Bank shares fell as investors reacted to outage", "Shares fell after investors reacted.", "market", 3, "market_reaction"),
      story("multi-expert", "Analysts explain why Acme Bank outage matters", "Experts warn of wider implications.", "analysis", 4, "expert_analysis"),
    ];

    for (const item of [...singleStories, ...multiStories]) {
      storiesById.set(item.id, item);
    }

    const single = parent("single", singleStories.map(item => item.id), 0.92, true);
    const multi = parent("multi", multiStories.map(item => item.id), 0.62, false);

    const singleScore = computePostTreeQualityScore(single, storiesById, cfg);
    const multiScore = computePostTreeQualityScore(multi, storiesById, cfg);

    expect(multiScore).toBeGreaterThan(singleScore);
    expect((multi.debug as any).postTreeQualityDiagnostics.visibleAngleCount).toBe(3);
  });

  it("selects the multi-angle parent even when pre-tree ranking placed it lower", () => {
    const hiddenIds = new Set<string>();
    const storiesById = new Map<string, InsightStory>();

    const singleStories = [
      story("single-1", "MegaCorp reports quarterly update", "Company update repeats the same base report.", "wire_1", 10),
      story("single-2", "MegaCorp update continues", "Company update repeats the same base report.", "wire_1", 11),
    ];

    const multiStories = [
      story("official", "Finance Ministry says Acme Bank outage is under review", "Officials said regulator asked for statement.", "gov", 20),
      story("market", "Acme Bank shares fell as investors reacted to outage", "Shares fell after investors reacted.", "market", 21),
      story("expert", "Analysts explain why Acme Bank outage matters", "Experts warn of wider implications.", "analysis", 22),
      story("reaction", "Customers criticise Acme Bank after outage goes viral", "Users reacted on social media.", "reaction", 23),
    ];

    for (const item of [...singleStories, ...multiStories]) {
      storiesById.set(item.id, item);
    }

    const highSingle = parent("single-high-score", singleStories.map(item => item.id), 0.94, false);
    const lowerMulti = parent("multi-lower-score", multiStories.map(item => item.id), 0.60, false);

    const selected = selectTopParentsWithWeakTreeCheck(
      [highSingle, lowerMulti],
      storiesById,
      cfg,
      hiddenIds
    );

    expect(selected[0].parentId).toBe("multi-lower-score");
    expect((selected[0].debug as any).postTreeQualityDiagnostics.visibleAngleCount).toBeGreaterThanOrEqual(3);
  });
});
`);

write('scripts/test_insight_post_tree_selection_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const pipeline = read('src/insight/src/pipeline/pipeline.ts');
const unitTest = read('src/insight/src/pipeline/postTreeSelection.cert.test.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'computePostTreeQualityScore', 'postTreeQualityDiagnostics', 'visibleAngleCount',
  'singleAnglePenalty', 'weakTreePenalty', 'strongAngleBonus',
  'selectTopParentsWithWeakTreeCheck', 'strongTrees', 'weakTrees'
]) {
  assert(pipeline.includes(token), \`pipeline.ts missing post-tree selection token: \${token}\`);
}

for (const token of [
  'Insight post-tree selection certification',
  'multi-angle trees than single-angle thin trees',
  'selects the multi-angle parent',
  'pre-tree ranking placed it lower',
  'visibleAngleCount'
]) {
  assert(unitTest.includes(token), \`postTreeSelection.cert.test.ts missing token: \${token}\`);
}

assert(packageJson.includes('"test:insight-post-tree-selection"'), 'package.json must include test:insight-post-tree-selection');
assert(certGate.includes("['npm', ['run', 'test:insight-post-tree-selection']]"), 'certification gate must run test:insight-post-tree-selection');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight post-tree quality selection slice' }, null, 2));
console.log('PASS: Insight post-tree selection static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-post-tree-selection'] = 'node scripts/test_insight_post_tree_selection_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-post-tree-selection']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-cache-contract']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-cache-contract']],",
      "  ['npm', ['run', 'test:insight-cache-contract']],\n  ['npm', ['run', 'test:insight-post-tree-selection']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-post-tree-selection']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\nSlice 37 Insight post-tree selection patch complete.');
