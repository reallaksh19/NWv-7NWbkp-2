"""
Validate generated section prefetch JSON.

Hard fail only for structural breakage. Thin sections generate warnings and
reports so the app can diagnose why a tab is weak without blocking every run.
"""
from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path
from typing import Any

SECTIONS_PATH = Path("public/newsdata/sections_latest.json")
REPORT_PATH = Path("public/newsdata/sections_quality_report.json")
SUMMARY_PATH = Path("public/newsdata/sections_quality_summary.md")

SUPPORTED_SCHEMAS = {1, 2}
RECOMMENDED_SCHEMA = 2

REQUIRED_SECTIONS = [
    "topStories", "india", "tn", "trichy", "world",
    "business", "technology", "sports", "entertainment",
]

MIN_TOTAL_STORIES = 45
MIN_SECTION_STORIES = 4
MIN_SECTION_SOURCE_GROUPS = 2


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


def story_source_group(story: dict[str, Any]) -> str:
    return str(story.get("sourceGroup") or story.get("source") or "unknown_source").strip().lower() or "unknown_source"


def normalize_sections(snapshot: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    sections = snapshot.get("sections", {})
    if not isinstance(sections, dict):
        return {}

    return {
        key: value if isinstance(value, list) else []
        for key, value in sections.items()
    }


def build_section_health(snapshot: dict[str, Any]) -> dict[str, Any]:
    sections = normalize_sections(snapshot)
    section_quality = snapshot.get("sectionQuality", {}) if isinstance(snapshot.get("sectionQuality", {}), dict) else {}

    health = {}

    for section in REQUIRED_SECTIONS:
        stories = sections.get(section, [])
        source_counts = Counter(story_source_group(story) for story in stories)
        quality = section_quality.get(section, {}) if isinstance(section_quality.get(section, {}), dict) else {}

        story_count = len(stories)
        source_group_count = len(source_counts)

        health[section] = {
            "storyCount": story_count,
            "sourceGroupCount": source_group_count,
            "qualityStoryCount": int(quality.get("storyCount", story_count) or 0),
            "qualitySourceGroupCount": int(quality.get("sourceGroupCount", source_group_count) or 0),
            "thin": story_count < MIN_SECTION_STORIES or source_group_count < MIN_SECTION_SOURCE_GROUPS,
            "topSources": [
                {"sourceGroup": source, "count": count}
                for source, count in source_counts.most_common(8)
            ],
        }

    return health


def validate_sections_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    schema = int(snapshot.get("schemaVersion") or 0)
    sections = normalize_sections(snapshot)

    if schema not in SUPPORTED_SCHEMAS:
        errors.append(f"Unsupported schemaVersion: {schema}")

    if schema < RECOMMENDED_SCHEMA:
        warnings.append("schemaVersion is supported but does not include optimized sectionQuality schema v2")

    if not sections:
        errors.append("sections object is missing or empty")

    if not snapshot.get("contentHash"):
        errors.append("contentHash is missing")

    if not int(snapshot.get("fetchedAt") or 0):
        errors.append("fetchedAt is missing or zero")

    missing_sections = [section for section in REQUIRED_SECTIONS if section not in sections]
    if missing_sections:
        warnings.append(f"Missing configured sections: {', '.join(missing_sections)}")

    health = build_section_health(snapshot)
    total_stories = sum(len(stories) for stories in sections.values())
    all_source_groups = {
        story_source_group(story)
        for stories in sections.values()
        for story in stories
    }

    if total_stories == 0:
        errors.append("all sections are empty")

    if total_stories < MIN_TOTAL_STORIES:
        warnings.append(f"Thin total section pool: {total_stories} stories < recommended {MIN_TOTAL_STORIES}")

    for section, item in health.items():
        if item["storyCount"] == 0:
            warnings.append(f"Section {section} has zero stories")
        elif item["storyCount"] < MIN_SECTION_STORIES:
            warnings.append(f"Section {section} is thin: {item['storyCount']} stories")
        if item["sourceGroupCount"] < MIN_SECTION_SOURCE_GROUPS and item["storyCount"] > 0:
            warnings.append(f"Section {section} has weak source diversity: {item['sourceGroupCount']} source group(s)")

    if schema >= 2 and not snapshot.get("sectionQuality"):
        warnings.append("schema v2 snapshot missing sectionQuality")

    status = "FAIL" if errors else "WARN" if warnings else "PASS"

    return {
        "status": status,
        "generatedAt": int(time.time() * 1000),
        "schemaVersion": schema,
        "contentHash": snapshot.get("contentHash", ""),
        "fetchedAt": snapshot.get("fetchedAt", 0),
        "sectionCount": len(sections),
        "storyCount": total_stories,
        "sourceGroupCount": len(all_source_groups),
        "sectionHealth": health,
        "errors": errors,
        "warnings": warnings,
        "thresholds": {
            "minTotalStories": MIN_TOTAL_STORIES,
            "minSectionStories": MIN_SECTION_STORIES,
            "minSectionSourceGroups": MIN_SECTION_SOURCE_GROUPS,
        },
    }


def write_summary(report: dict[str, Any]) -> None:
    lines = [
        "# Sections Prefetch Quality Report",
        "",
        f"- Status: **{report['status']}**",
        f"- Schema: `{report['schemaVersion']}`",
        f"- Content hash: `{report.get('contentHash') or 'n/a'}`",
        f"- Sections: `{report['sectionCount']}`",
        f"- Stories: `{report['storyCount']}`",
        f"- Source groups: `{report['sourceGroupCount']}`",
        "",
        "## Section health",
        "",
        "| Section | Stories | Sources | Thin |",
        "|---|---:|---:|---|",
    ]

    for section in REQUIRED_SECTIONS:
        item = report["sectionHealth"].get(section, {})
        lines.append(
            f"| {section} | {item.get('storyCount', 0)} | {item.get('sourceGroupCount', 0)} | {item.get('thin', True)} |"
        )

    if report["errors"]:
        lines += ["", "## Errors", ""]
        lines += [f"- {item}" for item in report["errors"]]

    if report["warnings"]:
        lines += ["", "## Warnings", ""]
        lines += [f"- {item}" for item in report["warnings"]]

    SUMMARY_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> int:
    if not SECTIONS_PATH.exists():
        report = {
            "status": "FAIL",
            "generatedAt": int(time.time() * 1000),
            "schemaVersion": 0,
            "contentHash": "",
            "fetchedAt": 0,
            "sectionCount": 0,
            "storyCount": 0,
            "sourceGroupCount": 0,
            "sectionHealth": {},
            "errors": [f"Missing {SECTIONS_PATH}"],
            "warnings": [],
        }
        write_json(REPORT_PATH, report)
        write_summary(report)
        print("Sections validation failed: missing sections_latest.json")
        return 1

    snapshot = read_json(SECTIONS_PATH, {})
    report = validate_sections_snapshot(snapshot)

    write_json(REPORT_PATH, report)
    write_summary(report)

    print(json.dumps({
        "status": report["status"],
        "sectionCount": report["sectionCount"],
        "storyCount": report["storyCount"],
        "sourceGroupCount": report["sourceGroupCount"],
        "errors": report["errors"],
        "warnings": report["warnings"],
    }, indent=2))

    return 1 if report["status"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
