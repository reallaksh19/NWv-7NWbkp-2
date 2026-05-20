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

fs.mkdirSync('src/insight/src/tree', { recursive: true });

write('src/insight/src/tree/angleDiversityRecovery.ts', `import {
  AngleLabel,
  ChildCandidate,
  InsightConfig,
  InsightStory,
} from "../types";

const TARGET_VISIBLE_ANGLE_COUNT = 3;

export interface AngleRecoveryDiagnostic {
  id: string;
  angle: AngleLabel;
  sourceGroup: string;
  score: number;
  reasons: string[];
}

export interface AngleDiversityRecoveryResult {
  targetAngleCount: number;
  beforeAngleCount: number;
  afterAngleCount: number;
  recoveredCount: number;
  recovered: ChildCandidate[];
  recoveredDiagnostics: AngleRecoveryDiagnostic[];
  remaining: ChildCandidate[];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safeAngle(candidate: ChildCandidate): AngleLabel {
  return (candidate.angle || candidate.story.angle || "unknown") as AngleLabel;
}

function getSelectedAngles(selected: InsightStory[]): Set<AngleLabel> {
  return new Set(
    selected
      .map(story => (story.angle || "unknown") as AngleLabel)
      .filter(angle => angle !== "unknown")
  );
}

function getSelectedSourceGroups(selected: InsightStory[]): Set<string> {
  return new Set(selected.map(story => story.sourceGroup || story.source || "unknown"));
}

function countSelectedBySourceGroup(selected: InsightStory[], sourceGroup: string): number {
  return selected.filter(story => story.sourceGroup === sourceGroup).length;
}

function hasUsefulNumericSignal(candidate: ChildCandidate): boolean {
  return Array.isArray(candidate.story.numbers) && candidate.story.numbers.length > 0;
}

function hasUsefulTextSignal(candidate: ChildCandidate): boolean {
  const text = \`\${candidate.story.title || ""} \${candidate.story.summary || ""}\`.toLowerCase();
  return /official|minister|regulator|shares|market|investor|analyst|expert|explainer|timeline|backlash|viral|local|regional|investigation|documents?|data|figures|confirmed/.test(text);
}

export function getVisibleAngleCount(selected: InsightStory[]): number {
  return getSelectedAngles(selected).size;
}

export function scoreAngleRecoveryCandidate(
  candidate: ChildCandidate,
  selected: InsightStory[],
  cfg: InsightConfig
): {
  score: number;
  reasons: string[];
} {
  const angle = safeAngle(candidate);
  const selectedAngles = getSelectedAngles(selected);
  const selectedSourceGroups = getSelectedSourceGroups(selected);
  const reasons: string[] = [];

  let score = 0;

  if (angle === "unknown") {
    return {
      score: -999,
      reasons: ["unknown angle cannot be recovered"],
    };
  }

  if (!selectedAngles.has(angle)) {
    score += 4;
    reasons.push(\`new visible angle: \${angle}\`);
  } else {
    score -= 2;
    reasons.push(\`angle already visible: \${angle}\`);
  }

  if (!selectedSourceGroups.has(candidate.story.sourceGroup)) {
    score += 1.25;
    reasons.push(\`new source group: \${candidate.story.sourceGroup}\`);
  }

  const sourceGroupCount = countSelectedBySourceGroup(selected, candidate.story.sourceGroup);
  if (sourceGroupCount >= cfg.MAX_PER_SOURCE_GROUP) {
    score -= 1.5;
    reasons.push("source group is already saturated");
  }

  if (angle === "base_report" && selectedAngles.has("base_report")) {
    score -= 1.25;
    reasons.push("avoid repeated base report");
  }

  if (hasUsefulNumericSignal(candidate)) {
    score += 0.75;
    reasons.push("contains numeric/fact signal");
  }

  if (hasUsefulTextSignal(candidate)) {
    score += 0.75;
    reasons.push("contains angle evidence text");
  }

  score += Math.max(0, Number(candidate.story.sourceAuthority || 0)) * 0.45;
  score += Math.max(0, Number(candidate.story.freshnessScore || 0)) * 0.35;
  score += Math.max(0, Number(candidate.story.summaryQuality || 0)) * 0.25;
  score += Math.max(0, Number(candidate.relevanceToParent || 0)) * 0.25;

  return {
    score: round3(score),
    reasons: reasons.length > 0 ? reasons : ["best available recovery candidate"],
  };
}

export function recoverAngleDiversity(
  selected: InsightStory[],
  remaining: ChildCandidate[],
  cfg: InsightConfig,
  targetAngleCount = TARGET_VISIBLE_ANGLE_COUNT
): AngleDiversityRecoveryResult {
  const beforeAngleCount = getVisibleAngleCount(selected);
  const pool = [...remaining];
  const recovered: ChildCandidate[] = [];
  const recoveredDiagnostics: AngleRecoveryDiagnostic[] = [];
  const selectedIds = new Set(selected.map(story => story.id));

  while (
    selected.length < cfg.MAX_CHILDREN_PER_PARENT &&
    getVisibleAngleCount(selected) < targetAngleCount
  ) {
    const selectedAngles = getSelectedAngles(selected);

    const candidates = pool
      .filter(candidate => !selectedIds.has(candidate.story.id))
      .filter(candidate => {
        const angle = safeAngle(candidate);
        return angle !== "unknown" && !selectedAngles.has(angle);
      })
      .map(candidate => ({
        candidate,
        recovery: scoreAngleRecoveryCandidate(candidate, selected, cfg),
      }))
      .filter(item => item.recovery.score > 0)
      .sort((a, b) => {
        if (b.recovery.score !== a.recovery.score) {
          return b.recovery.score - a.recovery.score;
        }
        if (b.candidate.childScore !== a.candidate.childScore) {
          return b.candidate.childScore - a.candidate.childScore;
        }
        if (b.candidate.story.sourceAuthority !== a.candidate.story.sourceAuthority) {
          return b.candidate.story.sourceAuthority - a.candidate.story.sourceAuthority;
        }
        return b.candidate.story.freshnessScore - a.candidate.story.freshnessScore;
      });

    const best = candidates[0];
    if (!best) break;

    const angle = safeAngle(best.candidate);
    const reasons = [
      "angle diversity recovery",
      ...best.recovery.reasons,
    ];

    best.candidate.angle = angle;
    best.candidate.story.angle = angle;
    best.candidate.admittedBecause = reasons;

    (best.candidate.story as any).admittedBecause = reasons;
    (best.candidate.story as any).angleRecovery = {
      score: best.recovery.score,
      reasons,
    };

    selected.push(best.candidate.story);
    selectedIds.add(best.candidate.story.id);
    recovered.push(best.candidate);

    recoveredDiagnostics.push({
      id: best.candidate.story.id,
      angle,
      sourceGroup: best.candidate.story.sourceGroup,
      score: best.recovery.score,
      reasons,
    });

    const poolIndex = pool.indexOf(best.candidate);
    if (poolIndex >= 0) pool.splice(poolIndex, 1);
  }

  return {
    targetAngleCount,
    beforeAngleCount,
    afterAngleCount: getVisibleAngleCount(selected),
    recoveredCount: recovered.length,
    recovered,
    recoveredDiagnostics,
    remaining: pool,
  };
}

export default recoverAngleDiversity;
`);

write('src/insight/src/tree/angleDiversityRecovery.cert.test.ts', `import { describe, expect, it } from "vitest";
import { recoverAngleDiversity, scoreAngleRecoveryCandidate } from "./angleDiversityRecovery";
import {
  ChildCandidate,
  InsightConfig,
  InsightStory,
  DEFAULT_CONFIG,
} from "../types";

function story(id: string, angle: any, sourceGroup: string): InsightStory {
  return {
    id,
    title: \`\${angle} title for Acme Bank story\`,
    summary: \`\${angle} summary includes official market analyst explainer public reaction signals and 4 percent data.\`,
    source: sourceGroup,
    sourceGroup,
    url: \`https://example.com/\${id}\`,
    publishedAt: Date.parse("2026-01-01T00:00:00Z"),
    category: "news",
    region: "India",
    language: "en",
    capturedAtSnapshot: "now",
    canonicalUrl: \`https://example.com/\${id}\`,
    canonicalText: id,
    canonicalTextHash: \`hash-\${id}\`,
    entities: {
      people: [],
      orgs: ["Acme Bank"],
      places: ["India"],
      products: [],
      symbols: [],
    },
    keywords: ["acme", "bank", "policy"],
    embedding: Array.from({ length: 200 }, (_, index) => index === id.length ? 1 : 0),
    eventVerbs: ["announces"],
    numbers: ["4 percent"],
    sourceTier: "A",
    sourceAuthority: 0.85,
    freshnessScore: 0.9,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.9,
    angle,
  };
}

function candidate(item: InsightStory): ChildCandidate {
  return {
    story: item,
    angle: item.angle || "unknown",
    relevanceToParent: 0.8,
    informationGain: 0.05,
    sourceDiversityBonus: 0,
    angleUniqueness: 1,
    childScore: 0.62,
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  MAX_CHILDREN_PER_PARENT: 7,
  MAX_PER_SOURCE_GROUP: 2,
};

describe("Insight angle diversity recovery certification", () => {
  it("scores new-angle recovery candidates above repeated angles", () => {
    const selected = [story("base", "base_report", "wire")];
    const newAngle = candidate(story("official", "official_response", "gov"));
    const repeatedAngle = candidate(story("base-2", "base_report", "wire2"));

    const newScore = scoreAngleRecoveryCandidate(newAngle, selected, cfg);
    const repeatedScore = scoreAngleRecoveryCandidate(repeatedAngle, selected, cfg);

    expect(newScore.score).toBeGreaterThan(repeatedScore.score);
    expect(newScore.reasons.join(" ")).toContain("new visible angle");
  });

  it("recovers missing visible angles from remaining candidates", () => {
    const selected = [story("base", "base_report", "wire")];

    const remaining = [
      candidate(story("official", "official_response", "gov")),
      candidate(story("market", "market_reaction", "market")),
      candidate(story("expert", "expert_analysis", "analysis")),
    ];

    const result = recoverAngleDiversity(selected, remaining, cfg, 3);

    expect(result.beforeAngleCount).toBe(1);
    expect(result.afterAngleCount).toBeGreaterThanOrEqual(3);
    expect(result.recoveredCount).toBeGreaterThanOrEqual(2);
    expect(selected.map(item => item.angle)).toContain("official_response");
    expect(selected.map(item => item.angle)).toContain("market_reaction");
    expect(result.recoveredDiagnostics.length).toBe(result.recoveredCount);
  });

  it("does not recover unknown-only candidates", () => {
    const selected = [story("base", "base_report", "wire")];
    const remaining = [candidate(story("unknown", "unknown", "unknown-source"))];

    const result = recoverAngleDiversity(selected, remaining, cfg, 3);

    expect(result.recoveredCount).toBe(0);
    expect(result.afterAngleCount).toBe(1);
  });
});
`);

patchFile('src/insight/src/tree/treeBuilder.ts', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { cosineSimilarity, getAngleVariantDecision, classifyAngle } from "../dedup/dedup";`,
    `\nimport { recoverAngleDiversity } from "./angleDiversityRecovery";`,
    'angle recovery import'
  );

  text = insertBeforeOnce(
    text,
    `  diversityTieBreaks: Array<{`,
    `  angleRecovery: {
    targetAngleCount: number;
    beforeAngleCount: number;
    afterAngleCount: number;
    recoveredCount: number;
    recoveredCandidates: Array<{
      id: string;
      angle: AngleLabel;
      sourceGroup: string;
      score: number;
      reasons: string[];
    }>;
  };
`,
    'angle recovery diagnostics type'
  );

  text = insertBeforeOnce(
    text,
    `    diversityTieBreaks: [],`,
    `    angleRecovery: {
      targetAngleCount: 3,
      beforeAngleCount: 0,
      afterAngleCount: 0,
      recoveredCount: 0,
      recoveredCandidates: [],
    },
`,
    'angle recovery diagnostics init'
  );

  text = insertBeforeOnce(
    text,
    `  // Remaining non-selected → hidden duplicates
  for (const c of remaining) {`,
    `  // Angle diversity recovery fallback:
  // Normal selection can reject useful perspectives when information gain is
  // low after the first child. Before hiding the remaining pool, recover
  // high-evidence stories that expose new visible angles.
  const angleRecovery = recoverAngleDiversity(selected, remaining, cfg, 3);

  diagnostics.angleRecovery = {
    targetAngleCount: angleRecovery.targetAngleCount,
    beforeAngleCount: angleRecovery.beforeAngleCount,
    afterAngleCount: angleRecovery.afterAngleCount,
    recoveredCount: angleRecovery.recoveredCount,
    recoveredCandidates: angleRecovery.recoveredDiagnostics,
  };

  for (const recovered of angleRecovery.recovered) {
    const admittedBecause = recovered.admittedBecause || [
      "angle diversity recovery",
      \`recovered angle: \${recovered.angle}\`,
    ];

    recovered.admittedBecause = admittedBecause;
    (recovered.story as any).admittedBecause = admittedBecause;
    (recovered.story as any).childScore = round3(recovered.childScore);
    (recovered.story as any).informationGain = round3(recovered.informationGain);

    recordAdmittedChild(diagnostics, recovered, admittedBecause);
  }

  remaining.length = 0;
  remaining.push(...angleRecovery.remaining);

`,
    'angle recovery before hiding remaining'
  );

  return text;
});

write('src/insight/src/tree/treeBuilderAngleRecovery.cert.test.ts', `import { describe, expect, it } from "vitest";
import { buildChildTree } from "./treeBuilder";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightParent,
  InsightStory,
} from "../types";

const NOW = Date.parse("2026-01-01T08:00:00Z");

function embedding(seed: number): number[] {
  const vector = Array.from({ length: 200 }, () => 0);
  vector[seed % 200] = 1;
  vector[(seed + 11) % 200] = 0.5;
  return vector;
}

function makeStory(id: string, title: string, summary: string, sourceGroup: string, seed: number): InsightStory {
  return {
    id,
    title,
    summary,
    source: sourceGroup,
    sourceGroup,
    url: \`https://example.com/\${id}\`,
    publishedAt: NOW,
    category: "national",
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
    eventVerbs: ["announces"],
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

function makeParent(stories: InsightStory[]): InsightParent {
  return {
    parentId: "parent-acme-outage",
    canonicalHeadline: "Acme Bank outage recovery",
    canonicalSummary: "Acme Bank outage has official, market, expert and public angles.",
    clusterStoryIds: stories.map(story => story.id),
    childStoryIds: [],
    hiddenDuplicateIds: [],
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: NOW,
    latestSeenAt: NOW,
    snapshotPresence: {
      now: true,
      minus4h: true,
      minus12h: false,
      minus24h: false,
    },
    impactScore: 0,
    persistenceScore: 0.8,
    sourceDiversityScore: 0.9,
    noveltyScore: 0.8,
    freshnessScore: 0.9,
    crossSnapshotMomentum: 0.8,
    editorialClarityScore: 0.9,
    regionBoost: 0,
    finalParentScore: 0,
    isRising: false,
    weakTree: false,
    debug: {
      clusterSize: stories.length,
      hiddenCount: 0,
      matchedSnapshots: ["now"],
      scoreBreakdown: {},
      replacements: [],
    },
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.95,
  WEAK_TREE_CHILD_MIN: 3,
  MIN_SOURCES_PER_TREE: 3,
  TIER_D_EXCLUDE: false,
};

describe("Tree builder angle recovery certification", () => {
  it("recovers visible angle diversity even when strict information gain rejects candidates", () => {
    const stories = [
      makeStory(
        "base",
        "Acme Bank announces payment outage recovery",
        "Acme Bank says payment services are being restored across India.",
        "wire_group",
        1
      ),
      makeStory(
        "official",
        "Finance Ministry says Acme Bank outage is under review",
        "Officials said the regulator asked Acme Bank for a statement and confirmed deposits remain protected.",
        "gov_group",
        2
      ),
      makeStory(
        "market",
        "Acme Bank shares fell as investors reacted to outage",
        "Shares fell 4 percent and investors sold banking stocks after the outage.",
        "market_group",
        3
      ),
      makeStory(
        "expert",
        "Analysts explain why Acme Bank outage matters",
        "Experts warn the outage could raise compliance costs and analysts say the incident has wider implications.",
        "analysis_group",
        4
      ),
      makeStory(
        "reaction",
        "Customers criticise Acme Bank after outage goes viral",
        "Users reacted on social media and residents said failed payments caused delays.",
        "reaction_group",
        5
      ),
    ];

    const parent = makeParent(stories);
    const hiddenIds = new Set<string>();

    const children = buildChildTree(parent, stories, cfg, hiddenIds);
    const angles = [...new Set(children.map(child => child.angle || "unknown"))];

    expect(children.length).toBeGreaterThanOrEqual(3);
    expect(angles.length).toBeGreaterThanOrEqual(3);
    expect(angles).toContain("official_response");
    expect(angles).toContain("market_reaction");
    expect(parent.debug.childSelectionDiagnostics.angleRecovery.recoveredCount).toBeGreaterThanOrEqual(1);
    expect(parent.debug.childSelectionDiagnostics.angleRecovery.afterAngleCount).toBeGreaterThanOrEqual(3);
  });
});
`);

write('scripts/test_insight_angle_recovery_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const recovery = read('src/insight/src/tree/angleDiversityRecovery.ts');
const recoveryTest = read('src/insight/src/tree/angleDiversityRecovery.cert.test.ts');
const treeTest = read('src/insight/src/tree/treeBuilderAngleRecovery.cert.test.ts');
const treeBuilder = read('src/insight/src/tree/treeBuilder.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'recoverAngleDiversity',
  'scoreAngleRecoveryCandidate',
  'TARGET_VISIBLE_ANGLE_COUNT',
  'new visible angle',
  'angle diversity recovery',
  'recoveredDiagnostics'
]) {
  assert(recovery.includes(token), \`angleDiversityRecovery.ts missing token: \${token}\`);
}

for (const token of [
  'Insight angle diversity recovery certification',
  'recovers missing visible angles',
  'does not recover unknown-only candidates'
]) {
  assert(recoveryTest.includes(token), \`angleDiversityRecovery.cert.test.ts missing token: \${token}\`);
}

for (const token of [
  'Tree builder angle recovery certification',
  'strict information gain rejects candidates',
  'angleRecovery.recoveredCount',
  'angleRecovery.afterAngleCount'
]) {
  assert(treeTest.includes(token), \`treeBuilderAngleRecovery.cert.test.ts missing token: \${token}\`);
}

for (const token of [
  'recoverAngleDiversity',
  'Angle diversity recovery fallback',
  'diagnostics.angleRecovery',
  'remaining.push(...angleRecovery.remaining)',
  'recordAdmittedChild(diagnostics, recovered'
]) {
  assert(treeBuilder.includes(token), \`treeBuilder.ts missing angle recovery token: \${token}\`);
}

assert(
  packageJson.includes('"test:insight-angle-recovery"'),
  'package.json must include test:insight-angle-recovery'
);

assert(
  certGate.includes("['npm', ['run', 'test:insight-angle-recovery']]"),
  'certification gate must run test:insight-angle-recovery'
);

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight angle recovery fallback slice' }, null, 2));
console.log('PASS: Insight angle recovery static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-angle-recovery'] = 'node scripts/test_insight_angle_recovery_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-angle-recovery']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-core-recovery']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-core-recovery']],",
      "  ['npm', ['run', 'test:insight-core-recovery']],\n  ['npm', ['run', 'test:insight-angle-recovery']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-angle-classifier-enrichment']],",
    "  ['npm', ['run', 'test:insight-angle-classifier-enrichment']],\n  ['npm', ['run', 'test:insight-angle-recovery']],"
  );
});

console.log('\nSlice 34 Insight angle recovery patch complete.');
