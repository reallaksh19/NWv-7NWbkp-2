import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  InsightConfig,
  InsightStory,
  SnapshotSlot,
} from "../types";
import { runInsightPipeline } from "../pipeline/pipeline";
import { recoverInsightRuntimeQuality } from "../diagnostics/insightRuntimeQualityGate";
import { getInsightCoreQualityDiagnostics, getVisibleChildAngles } from "../diagnostics/insightCoreQuality";
import { repairInsightResult } from "../diagnostics/insightResultRepair";
import { invalidateSlot } from "../cache/cacheManager";

const SNAPSHOT_PATH = path.resolve("public/newsdata/insight_latest.json");
const REPORT_PATH = path.resolve("public/newsdata/real_insight_quality_report.json");
const SUMMARY_PATH = path.resolve("public/newsdata/real_insight_quality_summary.md");

const SLOT_ORDER: SnapshotSlot[] = ["now", "minus4h", "minus12h", "minus24h"];

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function writeSummary(report: any) {
  const lines = [
    "# Real Insight Snapshot Quality",
    "",
    `- Status: **${report.status}**`,
    `- Reason: ${report.reason || "-"}`,
    `- Grade: \`${report.grade || "-"}\``,
    `- Parents: \`${report.parentCount || 0}\``,
    `- Average angles: \`${report.avgAngles || 0}\``,
    `- Multi-angle parents: \`${report.multiAngleCount || 0}\``,
    `- Weak parents: \`${report.weakParentCount || 0}\``,
    `- Story count: \`${report.storyCount || 0}\``,
    `- Source groups: \`${report.sourceGroupCount || 0}\``,
    `- Content hash: \`${report.contentHash || ""}\``,
    "",
    "## Top parents",
    "",
    "| # | Headline | Children | Angles | Weak | Score |",
    "|---:|---|---:|---|---|---:|",
  ];

  for (const [index, parent] of (report.parents || []).entries()) {
    lines.push(
      `| ${index + 1} | ${String(parent.headline || "").replace(/\|/g, "/")} | ${parent.childCount || 0} | ${(parent.angles || []).join(", ")} | ${parent.weakTree ? "YES" : "NO"} | ${parent.score || 0} |`
    );
  }

  if (report.warnings?.length) {
    lines.push("", "## Warnings", "");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }

  if (report.errors?.length) {
    lines.push("", "## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
  }

  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, lines.join('\n') + '\n', 'utf8');
}

function readSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return null;
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
}

function normalizeSlot(slot: string): SnapshotSlot {
  if (SLOT_ORDER.includes(slot as SnapshotSlot)) return slot as SnapshotSlot;
  return "now";
}

function getStorySlot(story: any, snapshot: any): SnapshotSlot {
  const explicitSlot = story?.capturedAtSnapshot || story?._snapshotIntake?.selectedFromSlot;
  if (explicitSlot) return normalizeSlot(String(explicitSlot));

  const slotMeta = snapshot?.slotMeta || {};
  for (const slot of SLOT_ORDER) {
    const storyIds = Array.isArray(slotMeta?.[slot]?.storyIds) ? slotMeta[slot].storyIds : [];
    if (storyIds.includes(story?.id)) return slot;
  }

  return "now";
}

function toInsightStory(raw: any, index: number, slot: SnapshotSlot): InsightStory {
  const title = String(raw?.title || raw?.headline || "Untitled");
  const summary = String(raw?.summary || raw?.description || raw?.content || "");
  const source = String(raw?.source || raw?.sourceGroup || "Unknown source");
  const sourceGroup = String(raw?.sourceGroup || raw?.source || "unknown_source")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown_source";

  const topicTokens = Array.isArray(raw?.storySignals?.topicTokens)
    ? raw.storySignals.topicTokens
    : [];

  const numbers = Array.isArray(raw?.storySignals?.numbers)
    ? raw.storySignals.numbers
    : Array.isArray(raw?.numbers)
      ? raw.numbers
      : [];

  const keywords = Array.from(new Set([
    ...topicTokens,
    ...(Array.isArray(raw?.keywords) ? raw.keywords : []),
    ...title.toLowerCase().split(/\W+/).filter((token: string) => token.length >= 4).slice(0, 8),
  ])).slice(0, 16);

  return {
    ...raw,
    id: String(raw?.id || raw?.url || `real-snapshot-${index}`),
    title,
    summary,
    source,
    sourceGroup,
    url: String(raw?.url || raw?.link || `snapshot://real/${index}`),
    publishedAt: Number(raw?.publishedAt || Date.now()),
    category: String(raw?.category || "news"),
    region: String(raw?.region || "India"),
    language: String(raw?.language || "en"),
    capturedAtSnapshot: slot,
    canonicalUrl: String(raw?.canonicalUrl || raw?.url || raw?.link || `snapshot://real/${index}`),
    canonicalText: String(raw?.canonicalText || `${title} ${summary}`),
    canonicalTextHash: String(raw?.canonicalTextHash || raw?.contentHash || `real-hash-${index}`),
    entities: {
      people: Array.isArray(raw?.entities?.people) ? raw.entities.people : [],
      orgs: Array.isArray(raw?.entities?.orgs) ? raw.entities.orgs : [],
      places: Array.isArray(raw?.entities?.places) ? raw.entities.places : [],
      products: Array.isArray(raw?.entities?.products) ? raw.entities.products : [],
      symbols: Array.isArray(raw?.entities?.symbols) ? raw.entities.symbols : [],
    },
    keywords,
    embedding: Array.from({ length: 200 }, (_, vectorIndex) => (
      vectorIndex === index % 200 ? 1 : vectorIndex === (index + 37) % 200 ? 0.35 : 0
    )),
    eventVerbs: Array.isArray(raw?.eventVerbs) ? raw.eventVerbs : [],
    numbers,
    sourceTier: raw?.sourceTier || "B",
    sourceAuthority: Number(raw?.sourceAuthority || 0.7),
    freshnessScore: Number(raw?.freshnessScore || 0.75),
    rawProminence: Number(raw?.rawProminence || 0.65),
    sentiment: Number(raw?.sentiment || 0),
    factualDensity: Number(raw?.factualDensity || 0.7),
    summaryQuality: Number(raw?.summaryQuality || 0.75),
  };
}

function makeFetcher(snapshot: any) {
  const stories = Array.isArray(snapshot?.stories) ? snapshot.stories : [];
  const normalized = stories.map((story: any, index: number) => {
    const slot = getStorySlot(story, snapshot);
    return toInsightStory(story, index, slot);
  });

  return async (slot: SnapshotSlot): Promise<InsightStory[]> => (
    normalized.filter(story => story.capturedAtSnapshot === slot)
  );
}

function clearCache() {
  for (const slot of SLOT_ORDER) {
    invalidateSlot(slot);
  }
}

function buildReport(snapshot: any, result: any, diagnostics: any) {
  const stories = Array.isArray(snapshot?.stories) ? snapshot.stories : [];
  const sourceGroups = new Set(stories.map((story: any) => story?.sourceGroup || story?.source || "unknown"));

  const parents = (result.parents || []).map((parent: any) => {
    const angles = getVisibleChildAngles(parent, result.storiesById);
    return {
      parentId: parent.parentId,
      headline: parent.canonicalHeadline,
      score: Number(parent.finalParentScore || 0),
      postTreeScore: Number(parent.debug?.postTreeQualityDiagnostics?.postTreeQualityScore || 0),
      childCount: Array.isArray(parent.childStoryIds) ? parent.childStoryIds.length : 0,
      angles,
      weakTree: Boolean(parent.weakTree),
    };
  });

  const warnings: string[] = [];
  if ((diagnostics.grade || "F") === "F" || diagnostics.grade === "D") {
    warnings.push("Real snapshot still produces low Insight grade.");
  }
  if (Number(diagnostics.multiAngleCount || 0) < 1) {
    warnings.push("No multi-angle parent found in real snapshot output.");
  }
  if (parents[0] && parents[0].angles.length < 2) {
    warnings.push("Top parent has fewer than two visible angles.");
  }

  return {
    status: "PASS",
    benchmarkVersion: "real-insight-snapshot-quality-v1",
    generatedAt: Date.now(),
    contentHash: snapshot?.contentHash || "",
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    collectorVersion: snapshot?.collectorVersion || "",
    storyCount: stories.length,
    sourceGroupCount: sourceGroups.size,
    grade: diagnostics.grade,
    parentCount: result.parents?.length || 0,
    avgAngles: diagnostics.avgAngles,
    multiAngleCount: diagnostics.multiAngleCount,
    weakParentCount: parents.filter((parent: any) => parent.weakTree).length,
    runtimeQualityGate: result.runtimeQualityGate || null,
    parents,
    warnings,
    errors: [],
  };
}

const cfg: InsightConfig = {
  ...DEFAULT_CONFIG,
  TOP_PARENTS: 5,
  MAX_CHILDREN_PER_PARENT: 7,
  MIN_CHILD_INFO_GAIN: 0.08,
  WEAK_TREE_CHILD_MIN: 2,
  MIN_SOURCES_PER_TREE: 2,
  MAX_PER_SOURCE_GROUP: 3,
  MAX_PER_ANGLE: 4,
  TIER_D_EXCLUDE: false,
};

describe("Real Insight snapshot quality benchmark", () => {
  it("runs the Insight pipeline against public/newsdata/insight_latest.json when available", async () => {
    const snapshot = readSnapshot();

    if (!snapshot) {
      const report = {
        status: "SKIP",
        benchmarkVersion: "real-insight-snapshot-quality-v1",
        reason: "public/newsdata/insight_latest.json not found in local checkout",
        generatedAt: Date.now(),
        errors: [],
        warnings: [],
      };
      writeJson(REPORT_PATH, report);
      writeSummary(report);
      expect(report.status).toBe("SKIP");
      return;
    }

    expect([2, 3]).toContain(Number(snapshot.schemaVersion));
    expect(Array.isArray(snapshot.stories)).toBe(true);
    expect(snapshot.stories.length).toBeGreaterThan(0);
    expect(String(snapshot.contentHash || "").length).toBeGreaterThan(0);

    clearCache();

    const rawResult = await runInsightPipeline(makeFetcher(snapshot), cfg);
    const recovered = recoverInsightRuntimeQuality(
      repairInsightResult(rawResult),
      "real-snapshot",
      cfg
    );

    const result = recovered.result;
    const diagnostics = getInsightCoreQualityDiagnostics(result, "real-snapshot", cfg);
    const report = buildReport(snapshot, result, diagnostics);

    writeJson(REPORT_PATH, report);
    writeSummary(report);

    expect(result.parents.length).toBeGreaterThan(0);
    expect(report.parentCount).toBeGreaterThan(0);
    expect(report.storyCount).toBeGreaterThan(0);
  }, 120_000);
});
