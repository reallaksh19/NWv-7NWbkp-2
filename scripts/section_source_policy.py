from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path
from typing import Any

SECTION_SOURCE_POLICY_PATH = Path("config/section_sources.json")
SECTION_SOURCE_POLICY_REPORT_PATH = Path("public/newsdata/section_source_policy_report.json")

SECTION_ORDER = [
    "topStories", "india", "tn", "trichy", "world",
    "business", "technology", "sports", "entertainment",
]

DEFAULT_REQUIRED_COVERAGE = {
    "minSections": 9,
    "minFeedsPerSection": 2,
    "minSourceGroups": 10,
    "minTierAFeeds": 8,
}


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")


def normalize_source_group(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in str(value or "unknown_source"))
    cleaned = "_".join(part for part in cleaned.split("_") if part)
    return cleaned or "unknown_source"


def normalize_section_feed(feed: Any) -> dict[str, Any]:
    if isinstance(feed, list):
        url, source, source_group, tier, topic = (feed + ["", "", "", "C", "general"])[:5]
        return {
            "url": str(url).strip(),
            "source": str(source).strip() or normalize_source_group(source_group),
            "sourceGroup": normalize_source_group(source_group or source),
            "tier": str(tier or "C").upper() if str(tier or "C").upper() in {"A", "B", "C"} else "C",
            "topic": str(topic or "general").strip().lower() or "general",
        }

    if isinstance(feed, dict):
        return {
            "url": str(feed.get("url", "")).strip(),
            "source": str(feed.get("source", "")).strip(),
            "sourceGroup": normalize_source_group(feed.get("sourceGroup") or feed.get("source")),
            "tier": str(feed.get("tier", "C")).upper() if str(feed.get("tier", "C")).upper() in {"A", "B", "C"} else "C",
            "topic": str(feed.get("topic", "general")).strip().lower() or "general",
        }

    return {
        "url": "",
        "source": "",
        "sourceGroup": "unknown_source",
        "tier": "C",
        "topic": "general",
    }


def load_section_source_policy(path: Path = SECTION_SOURCE_POLICY_PATH) -> dict[str, Any]:
    policy = read_json(path, {})
    sections = policy.get("sections", {}) if isinstance(policy, dict) else {}

    normalized_sections = {}

    for section in SECTION_ORDER:
        feeds = sections.get(section, [])
        normalized_sections[section] = [
            normalize_section_feed(feed)
            for feed in feeds
            if normalize_section_feed(feed)["url"]
        ]

    return {
        "schemaVersion": int(policy.get("schemaVersion", 1) or 1),
        "policyVersion": policy.get("policyVersion", "section-source-policy-v1"),
        "sections": normalized_sections,
        "requiredCoverage": {
            **DEFAULT_REQUIRED_COVERAGE,
            **(policy.get("requiredCoverage", {}) if isinstance(policy, dict) else {}),
        },
    }


def validate_section_source_policy(policy: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    required = policy.get("requiredCoverage", DEFAULT_REQUIRED_COVERAGE)
    sections = policy.get("sections", {})

    missing_sections = [section for section in SECTION_ORDER if section not in sections]
    if missing_sections:
        errors.append(f"Missing sections: {', '.join(missing_sections)}")

    all_feeds = [feed for section in SECTION_ORDER for feed in sections.get(section, [])]
    source_groups = {feed["sourceGroup"] for feed in all_feeds}
    tier_a_count = sum(1 for feed in all_feeds if feed.get("tier") == "A")

    for section in SECTION_ORDER:
        count = len(sections.get(section, []))
        if count == 0:
            errors.append(f"Section {section} has no feeds")
        elif count < int(required.get("minFeedsPerSection", 2)):
            warnings.append(f"Section {section} has only {count} feed(s)")

    if len(source_groups) < int(required.get("minSourceGroups", 10)):
        warnings.append(f"Section source diversity is weak: {len(source_groups)}")

    if tier_a_count < int(required.get("minTierAFeeds", 8)):
        warnings.append(f"Section Tier-A coverage is weak: {tier_a_count}")

    return {
        "status": "FAIL" if errors else "WARN" if warnings else "PASS",
        "errors": errors,
        "warnings": warnings,
        "sectionCount": len(sections),
        "feedCount": len(all_feeds),
        "sourceGroupCount": len(source_groups),
        "tierACount": tier_a_count,
    }


def get_section_feeds_map(path: Path = SECTION_SOURCE_POLICY_PATH) -> dict[str, list[tuple[str, str, str]]]:
    policy = load_section_source_policy(path)
    validation = validate_section_source_policy(policy)

    if validation["errors"]:
        raise RuntimeError("Invalid section source policy: " + "; ".join(validation["errors"]))

    return {
        section: [
            (feed["url"], feed["source"], feed["sourceGroup"])
            for feed in policy["sections"].get(section, [])
        ]
        for section in SECTION_ORDER
    }


def build_section_quality(sections: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    result = {}

    for section in SECTION_ORDER:
        stories = sections.get(section, [])
        source_groups = Counter(story.get("sourceGroup") or story.get("source") or "unknown" for story in stories)
        categories = Counter(story.get("category") or section for story in stories)

        result[section] = {
            "storyCount": len(stories),
            "sourceGroupCount": len(source_groups),
            "topSources": [
                {"sourceGroup": source, "count": count}
                for source, count in source_groups.most_common(8)
            ],
            "topCategories": [
                {"category": category, "count": count}
                for category, count in categories.most_common(8)
            ],
            "thin": len(stories) < 8 or len(source_groups) < 2,
        }

    return result


def build_section_source_policy_report(
    sections: dict[str, list[dict[str, Any]]] | None = None,
    source_health: dict[str, Any] | None = None,
    path: Path = SECTION_SOURCE_POLICY_PATH,
) -> dict[str, Any]:
    policy = load_section_source_policy(path)
    validation = validate_section_source_policy(policy)
    source_health = source_health or {}
    sections = sections or {}

    slot_summary = {}
    for section in SECTION_ORDER:
        feeds = policy["sections"].get(section, [])
        slot_summary[section] = {
            "feedCount": len(feeds),
            "sourceGroups": sorted({feed["sourceGroup"] for feed in feeds}),
            "tierCounts": dict(Counter(feed["tier"] for feed in feeds)),
            "topicCounts": dict(Counter(feed["topic"] for feed in feeds)),
        }

    source_rows = {}
    for section in SECTION_ORDER:
        for feed in policy["sections"].get(section, []):
            row = source_rows.setdefault(feed["sourceGroup"], {
                "sourceGroup": feed["sourceGroup"],
                "source": feed["source"],
                "tier": feed["tier"],
                "topics": set(),
                "sections": set(),
                "configuredFeeds": 0,
                "health": {},
            })
            row["topics"].add(feed["topic"])
            row["sections"].add(section)
            row["configuredFeeds"] += 1

    for group, health in source_health.items():
        normalized = normalize_source_group(group)
        source_rows.setdefault(normalized, {
            "sourceGroup": normalized,
            "source": normalized,
            "tier": "C",
            "topics": set(),
            "sections": set(),
            "configuredFeeds": 0,
            "health": {},
        })
        source_rows[normalized]["health"] = health

    sources = []
    for row in source_rows.values():
        sources.append({
            **row,
            "topics": sorted(row["topics"]),
            "sections": sorted(row["sections"]),
        })

    sources.sort(key=lambda item: (item["tier"], item["sourceGroup"]))

    return {
        "schemaVersion": 1,
        "reportVersion": "section-source-policy-report-v1",
        "generatedAt": int(time.time() * 1000),
        "policyVersion": policy.get("policyVersion"),
        "validation": validation,
        "sectionQuality": build_section_quality(sections),
        "sectionSummary": slot_summary,
        "sourceCount": len(sources),
        "sources": sources,
    }


def write_section_source_policy_report(
    sections: dict[str, list[dict[str, Any]]],
    source_health: dict[str, Any],
    report_path: Path = SECTION_SOURCE_POLICY_REPORT_PATH,
) -> dict[str, Any]:
    report = build_section_source_policy_report(sections, source_health)
    write_json(report_path, report)
    return report
