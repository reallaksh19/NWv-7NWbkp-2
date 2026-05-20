import {
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
  const text = `${candidate.story.title || ""} ${candidate.story.summary || ""}`.toLowerCase();
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
    reasons.push(`new visible angle: ${angle}`);
  } else {
    score -= 2;
    reasons.push(`angle already visible: ${angle}`);
  }

  if (!selectedSourceGroups.has(candidate.story.sourceGroup)) {
    score += 1.25;
    reasons.push(`new source group: ${candidate.story.sourceGroup}`);
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
