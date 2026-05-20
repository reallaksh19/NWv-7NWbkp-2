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

write('src/insight/src/diagnostics/insightResultRepair.ts', `import { classifyAngle } from "../dedup/dedup";
import {
  AngleLabel,
  InsightParent,
  InsightStory,
} from "../types";

type StoriesByIdLike = Map<string, InsightStory> | Record<string, InsightStory> | undefined | null;

export const INSIGHT_OUTPUT_CONTRACT_VERSION = "insight-output-contract-v4-angle-persisted";

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeStoriesByIdForRepair(storiesById: StoriesByIdLike): Map<string, InsightStory> {
  if (storiesById instanceof Map) return storiesById;
  if (storiesById && typeof storiesById === "object") {
    return new Map(Object.entries(storiesById));
  }
  return new Map();
}

function isMissingAngle(angle: unknown): boolean {
  return !angle || angle === "unknown";
}

function getVisibleAngleSet(parent: InsightParent, storiesById: Map<string, InsightStory>): Set<AngleLabel> {
  return new Set(
    safeArray(parent.childStoryIds)
      .map(id => storiesById.get(id))
      .filter(Boolean)
      .map(story => (story?.angle || "unknown") as AngleLabel)
      .filter(angle => angle !== "unknown")
  );
}

export function repairInsightStoryAngle(story: InsightStory, parentId?: string): {
  story: InsightStory;
  changed: boolean;
  previousAngle?: AngleLabel | "unknown";
  repairedAngle: AngleLabel;
} {
  const previousAngle = (story.angle || "unknown") as AngleLabel | "unknown";

  if (parentId && story.parentId !== parentId) {
    story.parentId = parentId;
  }

  if (!isMissingAngle(story.angle)) {
    return {
      story,
      changed: false,
      previousAngle,
      repairedAngle: story.angle as AngleLabel,
    };
  }

  const repairedAngle = classifyAngle(story);
  story.angle = repairedAngle;

  (story as any).angleRepair = {
    repaired: true,
    previousAngle,
    repairedAngle,
    contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
  };

  return {
    story,
    changed: true,
    previousAngle,
    repairedAngle,
  };
}

export function repairInsightResult(result: any) {
  if (!result || typeof result !== "object") return result;

  const storiesById = normalizeStoriesByIdForRepair(result.storiesById);
  const parents = safeArray<InsightParent>(result.parents);

  const repairDiagnostics = {
    contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    repairedStoryAngles: 0,
    repairedParentLinks: 0,
    parentsWithVisibleAngles: 0,
    parentsStillSingleAngle: 0,
    childLinksChecked: 0,
    missingStoryLinks: 0,
    repairedStories: [] as Array<{
      id: string;
      parentId: string;
      previousAngle?: AngleLabel | "unknown";
      repairedAngle: AngleLabel;
    }>,
  };

  for (const parent of parents) {
    const childIds = safeArray(parent.childStoryIds);

    for (const childId of childIds) {
      repairDiagnostics.childLinksChecked += 1;

      const story = storiesById.get(childId);
      if (!story) {
        repairDiagnostics.missingStoryLinks += 1;
        continue;
      }

      const beforeParent = story.parentId;
      const repaired = repairInsightStoryAngle(story, parent.parentId);

      if (beforeParent !== story.parentId) {
        repairDiagnostics.repairedParentLinks += 1;
      }

      if (repaired.changed) {
        repairDiagnostics.repairedStoryAngles += 1;

        if (repairDiagnostics.repairedStories.length < 50) {
          repairDiagnostics.repairedStories.push({
            id: story.id,
            parentId: parent.parentId,
            previousAngle: repaired.previousAngle,
            repairedAngle: repaired.repairedAngle,
          });
        }
      }

      storiesById.set(childId, story);
    }

    const visibleAngles = getVisibleAngleSet(parent, storiesById);
    if (visibleAngles.size >= 2) {
      repairDiagnostics.parentsWithVisibleAngles += 1;
    } else if (childIds.length > 0) {
      repairDiagnostics.parentsStillSingleAngle += 1;
    }

    parent.debug = parent.debug || {
      clusterSize: safeArray(parent.clusterStoryIds).length,
      hiddenCount: safeArray(parent.hiddenDuplicateIds).length,
      matchedSnapshots: [],
      scoreBreakdown: {},
      replacements: [],
    };

    (parent.debug as any).outputContractRepair = {
      contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
      visibleAngleCount: visibleAngles.size,
      visibleAngles: [...visibleAngles],
    };
  }

  return {
    ...result,
    parents,
    storiesById,
    outputContractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    outputContractRepairDiagnostics: repairDiagnostics,
  };
}

export function isInsightResultContractCurrent(result: any): boolean {
  return result?.outputContractVersion === INSIGHT_OUTPUT_CONTRACT_VERSION;
}

export function getInsightResultRepairSummary(result: any) {
  const repaired = repairInsightResult(result);
  const diagnostics = repaired?.outputContractRepairDiagnostics || {};

  return {
    contractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    current: isInsightResultContractCurrent(repaired),
    repairedStoryAngles: Number(diagnostics.repairedStoryAngles || 0),
    repairedParentLinks: Number(diagnostics.repairedParentLinks || 0),
    parentsWithVisibleAngles: Number(diagnostics.parentsWithVisibleAngles || 0),
    parentsStillSingleAngle: Number(diagnostics.parentsStillSingleAngle || 0),
    missingStoryLinks: Number(diagnostics.missingStoryLinks || 0),
  };
}

export default repairInsightResult;
`);

write('src/insight/src/diagnostics/insightResultRepair.cert.test.ts', `import { describe, expect, it } from "vitest";
import {
  INSIGHT_OUTPUT_CONTRACT_VERSION,
  getInsightResultRepairSummary,
  isInsightResultContractCurrent,
  repairInsightResult,
} from "./insightResultRepair";
import { InsightParent, InsightStory } from "../types";

function story(id: string, title: string, summary: string): InsightStory {
  return {
    id,
    title,
    summary,
    source: "source",
    sourceGroup: "source_group",
    url: \`https://example.com/\${id}\`,
    publishedAt: Date.parse("2026-01-01T00:00:00Z"),
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
    keywords: ["acme", "bank"],
    embedding: Array.from({ length: 200 }, (_, index) => index === 1 ? 1 : 0),
    eventVerbs: ["announces"],
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

function parent(): InsightParent {
  return {
    parentId: "parent-1",
    canonicalHeadline: "Acme Bank outage",
    canonicalSummary: "Acme Bank outage has multiple angles",
    clusterStoryIds: ["official", "market"],
    childStoryIds: ["official", "market"],
    hiddenDuplicateIds: [],
    keyEntities: ["Acme Bank"],
    keyPlaces: ["India"],
    keyVerbs: ["announces"],
    keyNumbers: [],
    firstSeenAt: Date.parse("2026-01-01T00:00:00Z"),
    latestSeenAt: Date.parse("2026-01-01T00:00:00Z"),
    snapshotPresence: {
      now: true,
      minus4h: false,
      minus12h: false,
      minus24h: false,
    },
    impactScore: 0.8,
    persistenceScore: 0.8,
    sourceDiversityScore: 0.8,
    noveltyScore: 0.8,
    freshnessScore: 0.8,
    crossSnapshotMomentum: 0.8,
    editorialClarityScore: 0.8,
    regionBoost: 0,
    finalParentScore: 0.8,
    isRising: false,
    weakTree: false,
    debug: {
      clusterSize: 2,
      hiddenCount: 0,
      matchedSnapshots: ["now"],
      scoreBreakdown: {},
      replacements: [],
    },
  };
}

describe("Insight result repair certification", () => {
  it("backfills missing child angles in cached storiesById map", () => {
    const result = {
      parents: [parent()],
      storiesById: new Map([
        [
          "official",
          story(
            "official",
            "Finance Ministry says Acme Bank outage is under review",
            "Officials said the regulator asked Acme Bank for a statement"
          ),
        ],
        [
          "market",
          story(
            "market",
            "Acme Bank shares fell as investors reacted to outage",
            "Shares fell 4 percent and investors sold banking stocks"
          ),
        ],
      ]),
    };

    const repaired = repairInsightResult(result);
    const official = repaired.storiesById.get("official");
    const market = repaired.storiesById.get("market");

    expect(repaired.outputContractVersion).toBe(INSIGHT_OUTPUT_CONTRACT_VERSION);
    expect(official.angle).toBe("official_response");
    expect(market.angle).toBe("market_reaction");
    expect(repaired.outputContractRepairDiagnostics.repairedStoryAngles).toBe(2);
    expect(isInsightResultContractCurrent(repaired)).toBe(true);
  });

  it("repairs object-shaped cached storiesById after JSON rehydration", () => {
    const result = {
      parents: [parent()],
      storiesById: {
        official: story(
          "official",
          "Finance Ministry says Acme Bank outage is under review",
          "Officials said the regulator asked Acme Bank for a statement"
        ),
        market: story(
          "market",
          "Acme Bank shares fell as investors reacted to outage",
          "Shares fell 4 percent and investors sold banking stocks"
        ),
      },
    };

    const summary = getInsightResultRepairSummary(result);

    expect(summary.current).toBe(true);
    expect(summary.repairedStoryAngles).toBe(2);
    expect(summary.parentsWithVisibleAngles).toBe(1);
  });

  it("keeps already-current contract results current", () => {
    const result = repairInsightResult({
      parents: [parent()],
      storiesById: new Map([
        [
          "official",
          {
            ...story(
              "official",
              "Finance Ministry says Acme Bank outage is under review",
              "Officials said the regulator asked Acme Bank for a statement"
            ),
            angle: "official_response",
          },
        ],
        [
          "market",
          {
            ...story(
              "market",
              "Acme Bank shares fell as investors reacted to outage",
              "Shares fell 4 percent and investors sold banking stocks"
            ),
            angle: "market_reaction",
          },
        ],
      ]),
      outputContractVersion: INSIGHT_OUTPUT_CONTRACT_VERSION,
    });

    expect(isInsightResultContractCurrent(result)).toBe(true);
    expect(result.outputContractRepairDiagnostics.repairedStoryAngles).toBe(0);
  });
});
`);

patchFile('src/pages/InsightPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { getInsightBehaviorEvidence } from '../insight/src/diagnostics/insightBehaviorEvidence.ts';`,
    `\nimport { INSIGHT_OUTPUT_CONTRACT_VERSION, repairInsightResult } from '../insight/src/diagnostics/insightResultRepair.ts';`,
    'insight output repair import'
  );

  text = insertAfterOnce(
    text,
    `const CACHE_KEY      = 'insight_pipeline_cache';`,
    `\nconst CACHE_SCHEMA_VERSION = INSIGHT_OUTPUT_CONTRACT_VERSION;`,
    'cache schema version constant'
  );

  text = replaceOnce(
    text,
    `    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE) return null;
    // Re-inflate the Map (JSON.stringify flattens it)
    if (data && !(data.storiesById instanceof Map)) {
      data.storiesById = new Map(Object.entries(data.storiesById || {}));
    }
    return { ts, data };`,
    `    const { ts, data, schemaVersion } = JSON.parse(raw);
    if (schemaVersion !== CACHE_SCHEMA_VERSION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (Date.now() - ts > CACHE_MAX_AGE) return null;
    // Re-inflate the Map (JSON.stringify flattens it)
    if (data && !(data.storiesById instanceof Map)) {
      data.storiesById = new Map(Object.entries(data.storiesById || {}));
    }
    const repaired = repairInsightResult(data);
    return { ts, data: repaired };`,
    'readCache schema gate and repair'
  );

  text = replaceOnce(
    text,
    `    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: serialisable }));`,
    `    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      schemaVersion: CACHE_SCHEMA_VERSION,
      data: serialisable
    }));`,
    'writeCache schema version'
  );

  text = replaceOnce(
    text,
    `      const r = await runInsightPipeline(fetcher, config);
      if (!isMounted.current) return;`,
    `      const r = repairInsightResult(await runInsightPipeline(fetcher, config));
      if (!isMounted.current) return;`,
    'repair live pipeline result before display'
  );

  return text;
});

write('scripts/test_insight_cache_contract_recovery_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const repair = read('src/insight/src/diagnostics/insightResultRepair.ts');
const repairTest = read('src/insight/src/diagnostics/insightResultRepair.cert.test.ts');
const page = read('src/pages/InsightPage.jsx');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'INSIGHT_OUTPUT_CONTRACT_VERSION', 'repairInsightResult', 'repairInsightStoryAngle',
  'outputContractRepairDiagnostics', 'repairedStoryAngles', 'parentsStillSingleAngle', 'classifyAngle'
]) {
  assert(repair.includes(token), \`insightResultRepair.ts missing token: \${token}\`);
}

for (const token of [
  'Insight result repair certification', 'backfills missing child angles',
  'object-shaped cached storiesById', 'already-current contract results'
]) {
  assert(repairTest.includes(token), \`insightResultRepair.cert.test.ts missing token: \${token}\`);
}

for (const token of [
  'INSIGHT_OUTPUT_CONTRACT_VERSION', 'repairInsightResult', 'CACHE_SCHEMA_VERSION',
  'schemaVersion !== CACHE_SCHEMA_VERSION', 'localStorage.removeItem(CACHE_KEY)',
  'data: repaired', 'repairInsightResult(await runInsightPipeline'
]) {
  assert(page.includes(token), \`InsightPage.jsx missing cache contract token: \${token}\`);
}

assert(packageJson.includes('"test:insight-cache-contract"'), 'package.json must include test:insight-cache-contract');
assert(certGate.includes("['npm', ['run', 'test:insight-cache-contract']]"), 'certification gate must run test:insight-cache-contract');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight cache/output contract recovery slice' }, null, 2));
console.log('PASS: Insight cache contract recovery static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-cache-contract'] = 'node scripts/test_insight_cache_contract_recovery_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-cache-contract']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-cluster-cohesion']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-cluster-cohesion']],",
      "  ['npm', ['run', 'test:insight-cluster-cohesion']],\n  ['npm', ['run', 'test:insight-cache-contract']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-cache-contract']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\nSlice 36 Insight cache/output contract recovery patch complete.');
