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

fs.mkdirSync('src/insight/src/quality', { recursive: true });

write('src/insight/src/quality/insightE2EQuality.cert.test.ts', `import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightStory,
  SnapshotSlot,
} from "../types";
import { runInsightPipeline } from "../pipeline/pipeline";
import { invalidateSlot } from "../cache/cacheManager";
import { recoverInsightRuntimeQuality } from "../diagnostics/insightRuntimeQualityGate";
import { getInsightCoreQualityDiagnostics, getVisibleChildAngles } from "../diagnostics/insightCoreQuality";
import { repairInsightResult } from "../diagnostics/insightResultRepair";

const NOW = Date.parse("2026-01-01T12:00:00Z");

function vector(seed: number): number[] {
  const values = Array.from({ length: 200 }, () => 0);
  values[seed % 200] = 1;
  values[(seed + 13) % 200] = 0.55;
  values[(seed + 47) % 200] = 0.25;
  return values;
}

function makeStory(input: {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceGroup: string;
  category: string;
  slot: SnapshotSlot;
  seed: number;
  ageHours: number;
  numbers?: string[];
  eventVerbs?: string[];
  orgs?: string[];
  places?: string[];
  keywords?: string[];
  sourceAuthority?: number;
  rawProminence?: number;
}): InsightStory {
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    source: input.source,
    sourceGroup: input.sourceGroup,
    url: \`https://example.com/insight-e2e/\${input.id}\`,
    publishedAt: NOW - input.ageHours * 3_600_000,
    category: input.category,
    region: "India",
    language: "en",
    capturedAtSnapshot: input.slot,
    canonicalUrl: \`https://example.com/insight-e2e/\${input.id}\`,
    canonicalText: \`\${input.title} \${input.summary}\`,
    canonicalTextHash: \`hash-\${input.id}\`,
    entities: {
      people: [],
      orgs: input.orgs || ["Acme Bank"],
      places: input.places || ["India"],
      products: [],
      symbols: [],
    },
    keywords: input.keywords || ["acme", "bank", "outage", "payments"],
    embedding: vector(input.seed),
    eventVerbs: input.eventVerbs || ["announces"],
    numbers: input.numbers || [],
    sourceTier: "A",
    sourceAuthority: input.sourceAuthority ?? 0.84,
    freshnessScore: 0.9,
    rawProminence: input.rawProminence ?? 0.82,
    sentiment: 0,
    factualDensity: 0.78,
    summaryQuality: 0.92,
  };
}

const e2eStories: InsightStory[] = [
  makeStory({
    id: "base-wire-now",
    title: "Acme Bank payment outage recovery begins across India",
    summary: "Acme Bank says failed digital payments are being restored after a national outage affected customers.",
    source: "National Wire",
    sourceGroup: "national_wire",
    category: "national",
    slot: "now",
    seed: 1,
    ageHours: 1,
    numbers: ["2 hours", "1 million customers"],
    eventVerbs: ["announces"],
  }),
  makeStory({
    id: "official-now",
    title: "Finance Ministry says Acme Bank outage is under review",
    summary: "Officials said the regulator asked Acme Bank for a statement and confirmed customer deposits remain protected.",
    source: "Government Desk",
    sourceGroup: "government_desk",
    category: "policy",
    slot: "now",
    seed: 2,
    ageHours: 2,
    eventVerbs: ["confirmed", "reviewed"],
    orgs: ["Finance Ministry", "Acme Bank"],
  }),
  makeStory({
    id: "market-4h",
    title: "Acme Bank shares fell as investors reacted to payment outage",
    summary: "Shares fell 4 percent while investors sold banking stocks after the Acme Bank payment outage.",
    source: "Market Desk",
    sourceGroup: "market_desk",
    category: "business",
    slot: "minus4h",
    seed: 3,
    ageHours: 5,
    numbers: ["4 percent"],
    eventVerbs: ["fell", "sold"],
  }),
  makeStory({
    id: "expert-4h",
    title: "Analysts explain why Acme Bank outage matters",
    summary: "Experts warn the incident could raise compliance costs and analysts say the outage has wider implications.",
    source: "Analysis Desk",
    sourceGroup: "analysis_desk",
    category: "analysis",
    slot: "minus4h",
    seed: 4,
    ageHours: 7,
    eventVerbs: ["explain", "warn"],
  }),
  makeStory({
    id: "reaction-12h",
    title: "Customers criticise Acme Bank after outage goes viral",
    summary: "Users reacted on social media and residents said failed payments caused delays at shops.",
    source: "Public Desk",
    sourceGroup: "public_desk",
    category: "society",
    slot: "minus12h",
    seed: 5,
    ageHours: 15,
    eventVerbs: ["criticised", "reacted"],
  }),
  makeStory({
    id: "background-24h",
    title: "Explainer: what led to Acme Bank payment outage",
    summary: "A timeline explains how it started, key points, and why this matters for digital banking.",
    source: "Explainer Desk",
    sourceGroup: "explainer_desk",
    category: "explainer",
    slot: "minus24h",
    seed: 6,
    ageHours: 26,
    eventVerbs: ["explains"],
  }),
  makeStory({
    id: "regional-12h",
    title: "Chennai merchants report Acme Bank payment delays after outage",
    summary: "Local shops in Chennai said payment failures affected customers before services resumed.",
    source: "Chennai Desk",
    sourceGroup: "chennai_desk",
    category: "regional",
    slot: "minus12h",
    seed: 7,
    ageHours: 16,
    eventVerbs: ["reported", "resumed"],
    places: ["Chennai", "India"],
  }),
];

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  TOP_PARENTS: 3,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.12,
  WEAK_TREE_CHILD_MIN: 3,
  MIN_SOURCES_PER_TREE: 3,
  MAX_PER_SOURCE_GROUP: 3,
  MAX_PER_ANGLE: 4,
  TIER_D_EXCLUDE: false,
  SAME_EVENT_THRESHOLD: 0.86,
  POSSIBLE_EVENT_THRESHOLD: 0.70,
};

function clearCache() {
  for (const slot of ["now", "minus4h", "minus12h", "minus24h"] as SnapshotSlot[]) {
    invalidateSlot(slot);
  }
}

async function fetchFixture(slot: SnapshotSlot): Promise<InsightStory[]> {
  return e2eStories.filter(story => story.capturedAtSnapshot === slot);
}

function getGradeRank(grade: string): number {
  return ["F", "D", "C", "B", "A"].indexOf(grade);
}

describe("Insight E2E quality certification", () => {
  it("produces a C-or-better multi-angle Insight result through the full pipeline", async () => {
    clearCache();

    const rawResult = await runInsightPipeline(fetchFixture, cfg);
    const recovered = recoverInsightRuntimeQuality(
      repairInsightResult(rawResult),
      "live",
      cfg
    );

    const result = recovered.result;
    const diagnostics = getInsightCoreQualityDiagnostics(result, "live", cfg);

    expect(result.parents.length).toBeGreaterThanOrEqual(1);
    expect(getGradeRank(diagnostics.grade)).toBeGreaterThanOrEqual(getGradeRank("C"));
    expect(diagnostics.multiAngleCount).toBeGreaterThanOrEqual(1);
    expect(diagnostics.avgAngles).toBeGreaterThanOrEqual(2);

    const topParent = result.parents[0];
    const visibleAngles = getVisibleChildAngles(topParent, result.storiesById);
    const childStories = topParent.childStoryIds
      .map((id: string) => result.storiesById.get(id))
      .filter(Boolean) as InsightStory[];

    const childSourceGroups = new Set(
      childStories.map(story => story.sourceGroup)
    );

    expect(childStories.length).toBeGreaterThanOrEqual(4);
    expect(visibleAngles.length).toBeGreaterThanOrEqual(3);
    expect(childSourceGroups.size).toBeGreaterThanOrEqual(3);
    expect(childStories.some(story => !story.angle || story.angle === "unknown")).toBe(false);
  });

  it("records runtime gate and output-contract diagnostics in the E2E result", async () => {
    clearCache();

    const rawResult = await runInsightPipeline(fetchFixture, cfg);
    const recovered = recoverInsightRuntimeQuality(
      repairInsightResult(rawResult),
      "live",
      cfg
    );

    expect(recovered.result.outputContractVersion).toContain("insight-output-contract");
    expect(recovered.result.outputContractRepairDiagnostics).toBeTruthy();
    expect(recovered.result.runtimeQualityGate).toBeTruthy();

    const topParent = recovered.result.parents[0];
    expect(topParent.debug).toBeTruthy();
    expect((topParent.debug as any).postTreeQualityDiagnostics).toBeTruthy();
  });

  it("keeps the benchmark protected against one-angle regression", async () => {
    clearCache();

    const rawResult = await runInsightPipeline(fetchFixture, cfg);
    const recovered = recoverInsightRuntimeQuality(
      repairInsightResult(rawResult),
      "live",
      cfg
    );

    const oneAngleParents = recovered.result.parents.filter((parent: any) => (
      getVisibleChildAngles(parent, recovered.result.storiesById).length < 2
    ));

    expect(oneAngleParents.length).toBeLessThan(recovered.result.parents.length);
  });
});
`);

write('scripts/test_insight_e2e_quality_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const unitTest = read('src/insight/src/quality/insightE2EQuality.cert.test.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'Insight E2E quality certification',
  'runInsightPipeline', 'recoverInsightRuntimeQuality', 'repairInsightResult',
  'getInsightCoreQualityDiagnostics', 'getVisibleChildAngles',
  'C-or-better multi-angle Insight result',
  'visibleAngles.length', 'childSourceGroups.size', 'one-angle regression'
]) {
  assert(unitTest.includes(token), \`insightE2EQuality.cert.test.ts missing token: \${token}\`);
}

for (const token of [
  'official-now', 'market-4h', 'expert-4h', 'reaction-12h', 'background-24h', 'regional-12h'
]) {
  assert(unitTest.includes(token), \`E2E fixture missing story token: \${token}\`);
}

assert(packageJson.includes('"test:insight-e2e-quality"'), 'package.json must include test:insight-e2e-quality');
assert(certGate.includes("['npm', ['run', 'test:insight-e2e-quality']]"), 'certification gate must run test:insight-e2e-quality');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight E2E quality benchmark slice' }, null, 2));
console.log('PASS: Insight E2E quality static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-e2e-quality'] = 'node scripts/test_insight_e2e_quality_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-e2e-quality']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-nlp-enrichment']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-nlp-enrichment']],",
      "  ['npm', ['run', 'test:insight-nlp-enrichment']],\n  ['npm', ['run', 'test:insight-e2e-quality']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-e2e-quality']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\nSlice 41 Insight E2E quality benchmark patch complete.');
