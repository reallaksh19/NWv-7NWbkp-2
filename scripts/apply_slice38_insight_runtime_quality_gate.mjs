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

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

fs.mkdirSync('src/insight/src/diagnostics', { recursive: true });

write('src/insight/src/diagnostics/insightRuntimeQualityGate.ts', `import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightParent,
  InsightStory,
} from "../types";
import { buildChildTree, isWeakTree } from "../tree/treeBuilder";
import { computePostTreeQualityScore } from "../pipeline/pipeline";
import { getInsightCoreQualityDiagnostics, getVisibleChildAngles } from "./insightCoreQuality";
import { repairInsightResult } from "./insightResultRepair";

const RECOVERY_CONFIG_OVERRIDES: Partial<InsightConfig> = {
  MIN_CHILD_INFO_GAIN: 0.08,
  WEAK_TREE_CHILD_MIN: 2,
  MIN_SOURCES_PER_TREE: 2,
  MAX_PER_SOURCE_GROUP: 3,
  MAX_PER_ANGLE: 4,
  TIER_D_EXCLUDE: false,
};

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeStoriesById(storiesById: any): Map<string, InsightStory> {
  if (storiesById instanceof Map) return storiesById;
  if (storiesById && typeof storiesById === "object") {
    return new Map(Object.entries(storiesById));
  }
  return new Map();
}

function cloneStory(story: InsightStory): InsightStory {
  return {
    ...story,
    entities: {
      people: [...(story.entities?.people || [])],
      orgs: [...(story.entities?.orgs || [])],
      places: [...(story.entities?.places || [])],
      products: [...(story.entities?.products || [])],
      symbols: [...(story.entities?.symbols || [])],
    },
    keywords: [...(story.keywords || [])],
    embedding: [...(story.embedding || [])],
    eventVerbs: [...(story.eventVerbs || [])],
    numbers: [...(story.numbers || [])],
  };
}

function cloneParent(parent: InsightParent): InsightParent {
  return {
    ...parent,
    clusterStoryIds: [...safeArray(parent.clusterStoryIds)],
    childStoryIds: [...safeArray(parent.childStoryIds)],
    hiddenDuplicateIds: [...safeArray(parent.hiddenDuplicateIds)],
    keyEntities: [...safeArray(parent.keyEntities)],
    keyPlaces: [...safeArray(parent.keyPlaces)],
    keyVerbs: [...safeArray(parent.keyVerbs)],
    keyNumbers: [...safeArray(parent.keyNumbers)],
    snapshotPresence: { ...parent.snapshotPresence },
    debug: {
      ...(parent.debug || {}),
      matchedSnapshots: [...safeArray(parent.debug?.matchedSnapshots)],
      scoreBreakdown: { ...(parent.debug?.scoreBreakdown || {}) },
      replacements: [...safeArray(parent.debug?.replacements)],
    },
  };
}

function cloneResult(result: any) {
  const storiesById = normalizeStoriesById(result?.storiesById);
  const clonedStoriesById = new Map<string, InsightStory>();

  for (const [id, story] of storiesById.entries()) {
    clonedStoriesById.set(id, cloneStory(story));
  }

  return {
    ...result,
    parents: safeArray<InsightParent>(result?.parents).map(cloneParent),
    storiesById: clonedStoriesById,
    hiddenIds: result?.hiddenIds instanceof Set ? new Set(result.hiddenIds) : new Set<string>(),
  };
}

function getGradeRank(grade: string): number {
  return ["F", "D", "C", "B", "A"].indexOf(grade);
}

export function isInsightQualityAcceptable(diagnostics: any): boolean {
  if (!diagnostics) return false;

  const gradeOk = getGradeRank(diagnostics.grade) >= getGradeRank("C");
  const angleOk =
    Number(diagnostics.multiAngleCount || 0) >= 1 &&
    Number(diagnostics.avgAngles || 0) >= 2;

  return gradeOk && angleOk;
}

export function makeInsightRecoveryConfig(cfg: InsightConfig = DEFAULT_CONFIG): InsightConfig {
  return {
    ...cfg,
    ...RECOVERY_CONFIG_OVERRIDES,
  };
}

function rebuildParentTreeForRecovery(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): InsightParent {
  const clusterStories = safeArray(parent.clusterStoryIds)
    .map(id => storiesById.get(id))
    .filter(Boolean)
    .map(story => cloneStory(story as InsightStory));

  const hiddenIds = new Set<string>();
  const children = buildChildTree(parent, clusterStories, cfg, hiddenIds);

  parent.childStoryIds = children.map(child => child.id);
  parent.hiddenDuplicateIds = [...hiddenIds].filter(id => parent.clusterStoryIds.includes(id));
  parent.weakTree = isWeakTree(children, cfg);

  for (const child of children) {
    storiesById.set(child.id, child);
  }

  computePostTreeQualityScore(parent, storiesById, cfg);

  (parent.debug as any).runtimeQualityRecovery = {
    attempted: true,
    recoveryConfig: RECOVERY_CONFIG_OVERRIDES,
    childCount: children.length,
    visibleAngles: getVisibleChildAngles(parent, storiesById),
    weakTree: parent.weakTree,
  };

  return parent;
}

export function recoverInsightRuntimeQuality(
  result: any,
  source = "live",
  cfg: InsightConfig = DEFAULT_CONFIG
) {
  const firstPass = repairInsightResult(result);
  const firstDiagnostics = getInsightCoreQualityDiagnostics(firstPass, source, cfg);

  if (isInsightQualityAcceptable(firstDiagnostics)) {
    return {
      result: {
        ...firstPass,
        runtimeQualityGate: {
          attempted: false,
          recovered: false,
          reason: "first-pass acceptable",
          before: firstDiagnostics,
          after: firstDiagnostics,
        },
      },
      diagnostics: firstDiagnostics,
      gate: {
        attempted: false,
        recovered: false,
        reason: "first-pass acceptable",
      },
    };
  }

  const recoveryConfig = makeInsightRecoveryConfig(cfg);
  const recovered = cloneResult(firstPass);
  const storiesById = normalizeStoriesById(recovered.storiesById);

  recovered.parents = safeArray<InsightParent>(recovered.parents).map(parent => (
    rebuildParentTreeForRecovery(parent, storiesById, recoveryConfig)
  ));

  recovered.parents.sort((a: InsightParent, b: InsightParent) => {
    const aScore = Number((a.debug as any)?.postTreeQualityDiagnostics?.postTreeQualityScore || 0);
    const bScore = Number((b.debug as any)?.postTreeQualityDiagnostics?.postTreeQualityScore || 0);

    if (bScore !== aScore) return bScore - aScore;
    return Number(b.finalParentScore || 0) - Number(a.finalParentScore || 0);
  });

  recovered.parents = recovered.parents.slice(0, recoveryConfig.TOP_PARENTS);
  recovered.storiesById = storiesById;

  const repairedRecovered = repairInsightResult(recovered);
  const afterDiagnostics = getInsightCoreQualityDiagnostics(repairedRecovered, source, recoveryConfig);
  const recoveredOk = isInsightQualityAcceptable(afterDiagnostics);

  const runtimeQualityGate = {
    attempted: true,
    recovered: recoveredOk,
    reason: recoveredOk
      ? "relaxed-tree recovery produced acceptable output"
      : "relaxed-tree recovery could not produce acceptable output",
    before: firstDiagnostics,
    after: afterDiagnostics,
    recoveryConfig: RECOVERY_CONFIG_OVERRIDES,
  };

  return {
    result: {
      ...repairedRecovered,
      runtimeQualityGate,
    },
    diagnostics: afterDiagnostics,
    gate: runtimeQualityGate,
  };
}

export default recoverInsightRuntimeQuality;
`);

write('src/insight/src/diagnostics/insightRuntimeQualityGate.cert.test.ts', `import { describe, expect, it } from "vitest";
import {
  isInsightQualityAcceptable,
  makeInsightRecoveryConfig,
  recoverInsightRuntimeQuality,
} from "./insightRuntimeQualityGate";
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
  values[(seed + 31) % 200] = 0.4;
  return values;
}

function story(
  id: string,
  title: string,
  summary: string,
  sourceGroup: string,
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
    factualDensity: 0.72,
    summaryQuality: 0.9,
  };
}

function parent(stories: InsightStory[]): InsightParent {
  return {
    parentId: "parent-acme",
    canonicalHeadline: "Acme Bank outage",
    canonicalSummary: "Acme Bank outage has recoverable angles",
    clusterStoryIds: stories.map(item => item.id),
    childStoryIds: [stories[0].id],
    hiddenDuplicateIds: stories.slice(1).map(item => item.id),
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: NOW,
    latestSeenAt: NOW,
    snapshotPresence: {
      now: true,
      minus4h: true,
      minus12h: true,
      minus24h: false,
    },
    impactScore: 0.55,
    persistenceScore: 0.55,
    sourceDiversityScore: 0.55,
    noveltyScore: 0.55,
    freshnessScore: 0.55,
    crossSnapshotMomentum: 0.55,
    editorialClarityScore: 0.55,
    regionBoost: 0,
    finalParentScore: 0.55,
    isRising: false,
    weakTree: true,
    debug: {
      clusterSize: stories.length,
      hiddenCount: stories.length - 1,
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

describe("Insight runtime quality gate certification", () => {
  it("recognizes acceptable C-or-better multi-angle diagnostics", () => {
    expect(isInsightQualityAcceptable({
      grade: "C",
      multiAngleCount: 1,
      avgAngles: 2.1,
    })).toBe(true);

    expect(isInsightQualityAcceptable({
      grade: "D",
      multiAngleCount: 1,
      avgAngles: 2.1,
    })).toBe(false);
  });

  it("creates a relaxed recovery config without mutating the base config", () => {
    const recovered = makeInsightRecoveryConfig(cfg);

    expect(recovered.MIN_CHILD_INFO_GAIN).toBeLessThan(cfg.MIN_CHILD_INFO_GAIN);
    expect(recovered.WEAK_TREE_CHILD_MIN).toBeLessThanOrEqual(cfg.WEAK_TREE_CHILD_MIN);
    expect(cfg.MIN_CHILD_INFO_GAIN).toBe(0.95);
  });

  it("recovers a weak single-child result when cluster stories contain visible angles", () => {
    const stories = [
      story(
        "base",
        "Acme Bank announces payment outage recovery",
        "Acme Bank says failed payments are being restored across India.",
        "wire",
        1
      ),
      story(
        "official",
        "Finance Ministry says Acme Bank outage is under review",
        "Officials said the regulator asked Acme Bank for a statement.",
        "gov",
        2
      ),
      story(
        "market",
        "Acme Bank shares fell as investors reacted to outage",
        "Shares fell 4 percent and investors sold banking stocks.",
        "market",
        3
      ),
      story(
        "expert",
        "Analysts explain why Acme Bank outage matters",
        "Experts warn of wider implications.",
        "analysis",
        4
      ),
    ];

    const result = {
      parents: [parent(stories)],
      storiesById: new Map(stories.map(item => [item.id, item])),
    };

    const recovered = recoverInsightRuntimeQuality(result, "live", cfg);

    expect(recovered.gate.attempted).toBe(true);
    expect(recovered.result.runtimeQualityGate.attempted).toBe(true);
    expect(recovered.result.parents[0].childStoryIds.length).toBeGreaterThanOrEqual(3);
    expect(recovered.diagnostics.avgAngles).toBeGreaterThanOrEqual(2);
    expect(recovered.diagnostics.multiAngleCount).toBeGreaterThanOrEqual(1);
  });
});
`);

patchFile('src/pages/InsightPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { INSIGHT_OUTPUT_CONTRACT_VERSION, repairInsightResult } from '../insight/src/diagnostics/insightResultRepair.ts';`,
    `\nimport { recoverInsightRuntimeQuality } from '../insight/src/diagnostics/insightRuntimeQualityGate.ts';`,
    'runtime quality gate import'
  );

  text = replaceOnce(
    text,
    `      const r = repairInsightResult(await runInsightPipeline(fetcher, config));
      if (!isMounted.current) return;`,
    `      const runtimeQuality = recoverInsightRuntimeQuality(
        repairInsightResult(await runInsightPipeline(fetcher, config)),
        src,
        config
      );
      const r = runtimeQuality.result;
      if (!isMounted.current) return;`,
    'apply runtime quality gate after pipeline'
  );

  text = insertAfterOnce(
    text,
    `  const behaviorEvidence = getInsightBehaviorEvidence(result);
`,
    `  const runtimeQualityGate = result?.runtimeQualityGate || null;
`,
    'runtime gate variable'
  );

  text = insertAfterOnce(
    text,
    `      <InsightBehaviorEvidencePanel evidence={behaviorEvidence} />
`,
    `      {runtimeQualityGate && (
        <section
          className={\`insight-runtime-quality insight-runtime-quality--\${runtimeQualityGate.recovered ? 'recovered' : runtimeQualityGate.attempted ? 'attempted' : 'accepted'}\`}
          data-insight-runtime-quality-gate="post-pipeline-recovery"
        >
          <div className="insight-runtime-quality__eyebrow">Runtime quality gate</div>
          <h2>{runtimeQualityGate.recovered ? 'Recovered Insight quality' : runtimeQualityGate.attempted ? 'Recovery attempted' : 'First-pass accepted'}</h2>
          <p>{runtimeQualityGate.reason}</p>
          <div className="insight-runtime-quality__meta">
            <span>Before: {runtimeQualityGate.before?.grade || '-'}</span>
            <span>After: {runtimeQualityGate.after?.grade || '-'}</span>
            <span>Avg angles: {Number(runtimeQualityGate.after?.avgAngles || 0).toFixed(1)}</span>
          </div>
        </section>
      )}
`,
    'runtime quality gate panel render'
  );

  return text;
});

patchFile('src/styles/InsightPage.css', source => {
  if (source.includes('.insight-runtime-quality')) return source;

  return source + `

/* ==========================================================================
   Insight runtime quality gate
   Slice 38
   ========================================================================== */

.insight-runtime-quality {
  margin: 14px 0;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(88, 166, 255, 0.24);
  background:
    radial-gradient(420px 180px at 100% 0%, rgba(88, 166, 255, 0.12), transparent 62%),
    rgba(15, 23, 42, 0.72);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
}

.insight-runtime-quality--recovered {
  border-color: rgba(34, 197, 94, 0.42);
}

.insight-runtime-quality--attempted {
  border-color: rgba(245, 158, 11, 0.42);
}

.insight-runtime-quality--accepted {
  border-color: rgba(88, 166, 255, 0.34);
}

.insight-runtime-quality__eyebrow {
  color: #93c5fd;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.insight-runtime-quality h2 {
  margin: 5px 0;
  color: var(--text-primary, #FFFFFF);
  font-size: 1.08rem;
}

.insight-runtime-quality p {
  margin: 0;
  color: var(--text-secondary, #9CA5B0);
  font-size: 0.86rem;
  line-height: 1.45;
}

.insight-runtime-quality__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.insight-runtime-quality__meta span {
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid rgba(88, 166, 255, 0.18);
  background: rgba(88, 166, 255, 0.10);
  color: #bfdbfe;
  font-size: 0.74rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
`;
});

write('scripts/test_insight_runtime_quality_gate_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const gate = read('src/insight/src/diagnostics/insightRuntimeQualityGate.ts');
const gateTest = read('src/insight/src/diagnostics/insightRuntimeQualityGate.cert.test.ts');
const page = read('src/pages/InsightPage.jsx');
const css = read('src/styles/InsightPage.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'recoverInsightRuntimeQuality', 'isInsightQualityAcceptable', 'makeInsightRecoveryConfig',
  'RECOVERY_CONFIG_OVERRIDES', 'runtimeQualityGate', 'relaxed-tree recovery'
]) {
  assert(gate.includes(token), \`insightRuntimeQualityGate.ts missing token: \${token}\`);
}

for (const token of [
  'Insight runtime quality gate certification',
  'recovers a weak single-child result',
  'visible angles', 'multiAngleCount'
]) {
  assert(gateTest.includes(token), \`insightRuntimeQualityGate.cert.test.ts missing token: \${token}\`);
}

for (const token of [
  'recoverInsightRuntimeQuality', 'runtimeQuality.result',
  'data-insight-runtime-quality-gate', 'post-pipeline-recovery', 'Runtime quality gate'
]) {
  assert(page.includes(token), \`InsightPage.jsx missing runtime gate token: \${token}\`);
}

for (const token of [
  '.insight-runtime-quality', '.insight-runtime-quality--recovered', '.insight-runtime-quality__meta'
]) {
  assert(css.includes(token), \`InsightPage.css missing runtime gate CSS token: \${token}\`);
}

assert(packageJson.includes('"test:insight-runtime-quality-gate"'), 'package.json must include test:insight-runtime-quality-gate');
assert(certGate.includes("['npm', ['run', 'test:insight-runtime-quality-gate']]"), 'certification gate must run test:insight-runtime-quality-gate');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight runtime quality gate slice' }, null, 2));
console.log('PASS: Insight runtime quality gate static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-runtime-quality-gate'] = 'node scripts/test_insight_runtime_quality_gate_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-runtime-quality-gate']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-post-tree-selection']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-post-tree-selection']],",
      "  ['npm', ['run', 'test:insight-post-tree-selection']],\n  ['npm', ['run', 'test:insight-runtime-quality-gate']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-runtime-quality-gate']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\nSlice 38 Insight runtime quality gate patch complete.');
