"""
Validate generated Insight prefetch JSON.

This is intentionally stricter than a file-exists check and softer than a
production outage gate:
  - FAIL: malformed/unsupported JSON or missing core contract fields.
  - WARN: thin story pool, weak diversity, weak angle-hint coverage.
  - WRITE: JSON + Markdown reports for UI/debug/artifacts.
"""
from __future__ import annotations

import json
import os
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any

INSIGHT_PATH = Path("public/newsdata/insight_latest.json")
REPORT_PATH = Path("public/newsdata/insight_quality_report.json")
SUMMARY_PATH = Path("public/newsdata/insight_quality_summary.md")

SUPPORTED_SCHEMAS = {2, 3}
RECOMMENDED_SCHEMA = 3

SLOT_ORDER = ["now", "minus4h", "minus12h", "minus24h"]

MIN_TOTAL_STORIES = 24
MIN_USABLE_24H_STORIES = 18
MIN_SOURCE_GROUPS = 5
MIN_ANGLE_HINT_COVERAGE = 0.35
MIN_NON_BASE_ANGLE_STORIES = 6


def read_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )


def story_angle_hints(story: dict[str, Any]) -> list[dict[str, Any]]:
    hints = story.get("angleHints")
    if hints is None:
        hints = story.get("storySignals", {}).get("angleHints", [])

    result = []
    for hint in hints or []:
        if isinstance(hint, str):
            result.append({"angle": hint, "score": 0.5})
        elif isinstance(hint, dict) and hint.get("angle"):
            result.append({
                "angle": str(hint.get("angle")),
                "score": float(hint.get("score", 0.5) or 0.5),
            })

    return result


def story_source_group(story: dict[str, Any]) -> str:
    return str(
        story.get("sourceGroup")
        or story.get("source")
        or story.get("storySignals", {}).get("sourceGroup")
        or "unknown_source"
    ).strip().lower() or "unknown_source"


def story_is_usable_24h(story: dict[str, Any], now_ms: int) -> bool:
    published_at = int(story.get("publishedAt") or 0)
    if published_at <= 0:
        return False

    age = now_ms - published_at
    return 0 <= age < 36 * 3_600_000


def build_slot_health(snapshot: dict[str, Any], stories: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {story.get("id"): story for story in stories if story.get("id")}
    slot_meta = snapshot.get("slotMeta", {}) or {}
    slot_quality = snapshot.get("slotQuality", {}) or {}

    result = {}

    for slot in SLOT_ORDER:
        ids = slot_meta.get(slot, {}).get("storyIds", []) or []
        linked_stories = [by_id[sid] for sid in ids if sid in by_id]
        slot_q = slot_quality.get(slot, {}) or {}

        result[slot] = {
            "storyIds": len(ids),
            "linkedStories": len(linked_stories),
            "qualityStoryCount": int(slot_q.get("storyCount", len(linked_stories)) or 0),
            "sourceGroupCount": int(slot_q.get("sourceGroupCount", len({story_source_group(s) for s in linked_stories})) or 0),
            "thin": bool(slot_q.get("thin", len(linked_stories) < 8)),
            "fetchedAt": int(slot_meta.get(slot, {}).get("fetchedAt", slot_q.get("fetchedAt", 0)) or 0),
        }

    return result


def validate_snapshot(snapshot: dict[str, Any], now_ms: int) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    schema = int(snapshot.get("schemaVersion") or 0)
    stories = snapshot.get("stories") if isinstance(snapshot.get("stories"), list) else []

    if schema not in SUPPORTED_SCHEMAS:
        errors.append(f"Unsupported schemaVersion: {schema}")

    if not stories:
        errors.append("stories[] is missing or empty")

    if schema < RECOMMENDED_SCHEMA:
        warnings.append("schemaVersion is supported but not optimized schema v3")

    if not snapshot.get("contentHash"):
        errors.append("contentHash is missing")

    if not int(snapshot.get("fetchedAt") or 0):
        errors.append("fetchedAt is missing or zero")

    total_stories = len(stories)
    source_groups = Counter(story_source_group(story) for story in stories)
    usable_24h = [story for story in stories if story_is_usable_24h(story, now_ms)]

    stories_with_hints = [story for story in stories if story_angle_hints(story)]
    non_base_angle_stories = [
        story
        for story in stories
        if any(hint.get("angle") not in ("base_report", "unknown") for hint in story_angle_hints(story))
    ]

    angle_counter = Counter()
    for story in stories:
        hints = story_angle_hints(story)
        if hints:
            angle_counter[hints[0]["angle"]] += 1
        else:
            angle_counter["missing"] += 1

    angle_hint_coverage = len(stories_with_hints) / max(1, total_stories)

    if total_stories < MIN_TOTAL_STORIES:
        warnings.append(f"Thin story pool: {total_stories} stories < recommended {MIN_TOTAL_STORIES}")

    if len(usable_24h) < MIN_USABLE_24H_STORIES:
        warnings.append(
            f"Thin usable 24h pool: {len(usable_24h)} stories < recommended {MIN_USABLE_24H_STORIES}"
        )

    if len(source_groups) < MIN_SOURCE_GROUPS:
        warnings.append(
            f"Weak source diversity: {len(source_groups)} source groups < recommended {MIN_SOURCE_GROUPS}"
        )

    if angle_hint_coverage < MIN_ANGLE_HINT_COVERAGE:
        warnings.append(
            f"Weak angle hint coverage: {angle_hint_coverage:.0%} < recommended {MIN_ANGLE_HINT_COVERAGE:.0%}"
        )

    if len(non_base_angle_stories) < MIN_NON_BASE_ANGLE_STORIES:
        warnings.append(
            f"Weak non-base angle coverage: {len(non_base_angle_stories)} stories < recommended {MIN_NON_BASE_ANGLE_STORIES}"
        )

    slot_health = build_slot_health(snapshot, stories)

    for slot, health in slot_health.items():
        if health["linkedStories"] == 0:
            warnings.append(f"Slot {slot} has zero linked stories")

    status = "FAIL" if errors else "WARN" if warnings else "PASS"

    return {
        "status": status,
        "generatedAt": now_ms,
        "schemaVersion": schema,
        "collectorVersion": snapshot.get("collectorVersion", ""),
        "contentHash": snapshot.get("contentHash", ""),
        "fetchedAt": snapshot.get("fetchedAt", 0),
        "storyCount": total_stories,
        "usable24hStoryCount": len(usable_24h),
        "sourceGroupCount": len(source_groups),
        "topSources": [
            {"sourceGroup": source, "count": count}
            for source, count in source_groups.most_common(12)
        ],
        "angleHintCoverage": round(angle_hint_coverage, 4),
        "nonBaseAngleStoryCount": len(non_base_angle_stories),
        "topAngles": [
            {"angle": angle, "count": count}
            for angle, count in angle_counter.most_common(12)
        ],
        "slotHealth": slot_health,
        "errors": errors,
        "warnings": warnings,
        "thresholds": {
            "minTotalStories": MIN_TOTAL_STORIES,
            "minUsable24hStories": MIN_USABLE_24H_STORIES,
            "minSourceGroups": MIN_SOURCE_GROUPS,
            "minAngleHintCoverage": MIN_ANGLE_HINT_COVERAGE,
            "minNonBaseAngleStories": MIN_NON_BASE_ANGLE_STORIES,
        },
    }


def write_summary(report: dict[str, Any]) -> None:
    lines = [
        "# Insight Prefetch Quality Report",
        "",
        f"- Status: **{report['status']}**",
        f"- Schema: `{report['schemaVersion']}`",
        f"- Collector: `{report.get('collectorVersion') or 'n/a'}`",
        f"- Content hash: `{report.get('contentHash') or 'n/a'}`",
        f"- Stories: `{report['storyCount']}`",
        f"- Usable 24h stories: `{report['usable24hStoryCount']}`",
        f"- Source groups: `{report['sourceGroupCount']}`",
        f"- Angle hint coverage: `{report['angleHintCoverage']:.0%}`",
        f"- Non-base angle stories: `{report['nonBaseAngleStoryCount']}`",
        "",
        "## Slot health",
        "",
        "| Slot | Story IDs | Linked | Sources | Thin |",
        "|---|---:|---:|---:|---|",
    ]

    for slot in SLOT_ORDER:
        health = report["slotHealth"].get(slot, {})
        lines.append(
            f"| {slot} | {health.get('storyIds', 0)} | {health.get('linkedStories', 0)} | "
            f"{health.get('sourceGroupCount', 0)} | {health.get('thin', False)} |"
        )

    if report["errors"]:
        lines += ["", "## Errors", ""]
        lines += [f"- {item}" for item in report["errors"]]

    if report["warnings"]:
        lines += ["", "## Warnings", ""]
        lines += [f"- {item}" for item in report["warnings"]]

    lines += ["", "## Top angles", ""]
    lines += [f"- {item['angle']}: {item['count']}" for item in report["topAngles"]]

    SUMMARY_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> int:
    now_ms = int(time.time() * 1000)

    if not INSIGHT_PATH.exists():
        report = {
            "status": "FAIL",
            "generatedAt": now_ms,
            "errors": [f"Missing {INSIGHT_PATH}"],
            "warnings": [],
        }
        write_json(REPORT_PATH, report)
        write_summary({
            **report,
            "schemaVersion": 0,
            "collectorVersion": "",
            "contentHash": "",
            "storyCount": 0,
            "usable24hStoryCount": 0,
            "sourceGroupCount": 0,
            "angleHintCoverage": 0,
            "nonBaseAngleStoryCount": 0,
            "slotHealth": {},
            "topAngles": [],
        })
        print("Insight prefetch validation failed: missing insight_latest.json")
        return 1

    snapshot = read_json(INSIGHT_PATH, {})
    report = validate_snapshot(snapshot, now_ms)

    write_json(REPORT_PATH, report)
    write_summary(report)

    print(json.dumps({
        "status": report["status"],
        "storyCount": report["storyCount"],
        "usable24hStoryCount": report["usable24hStoryCount"],
        "sourceGroupCount": report["sourceGroupCount"],
        "angleHintCoverage": report["angleHintCoverage"],
        "errors": report["errors"],
        "warnings": report["warnings"],
    }, indent=2))

    return 1 if report["status"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
