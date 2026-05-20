"""
Insight source policy helpers.

This externalizes the RSS registry from fetch_insight_stories.py and writes a
diagnostic report so weak source diversity can be debugged without reading logs.
"""
from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path
from typing import Any

SLOTS = ["now", "minus4h", "minus12h", "minus24h"]
SOURCE_POLICY_PATH = Path("config/insight_sources.json")
SOURCE_POLICY_REPORT_PATH = Path("public/newsdata/source_policy_report.json")

DEFAULT_REQUIRED_COVERAGE = {
    "minFeedsPerSlot": 3,
    "minTierAFeeds": 6,
    "minSourceGroups": 8,
    "minTopics": 5,
}

SOURCE_HEALTH_POLICY_VERSION = "insight-source-health-policy-v1"

SOURCE_HEALTH_DEFAULTS = {
    "failedBackoffHours": 6,
    "zeroItemBackoffHours": 3,
    "minItemsForHealthy": 3,
    "maxSuppressedFractionPerSlot": 0.5,
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


def normalize_feed(feed: dict[str, Any]) -> dict[str, Any]:
    url = str(feed.get("url", "")).strip()
    source = str(feed.get("source", "")).strip()
    source_group = normalize_source_group(feed.get("sourceGroup") or source)
    tier = str(feed.get("tier", "C")).strip().upper()
    topic = str(feed.get("topic", "general")).strip().lower() or "general"

    return {
        "url": url,
        "source": source or source_group,
        "sourceGroup": source_group,
        "tier": tier if tier in {"A", "B", "C"} else "C",
        "topic": topic,
    }


def load_source_policy(path: Path = SOURCE_POLICY_PATH) -> dict[str, Any]:
    policy = read_json(path, {})
    slots = policy.get("slots", {}) if isinstance(policy, dict) else {}

    normalized_slots = {}

    for slot in SLOTS:
        feeds = slots.get(slot, [])
        normalized_slots[slot] = [
            normalize_feed(feed)
            for feed in feeds
            if isinstance(feed, dict) and str(feed.get("url", "")).strip()
        ]

    return {
        "schemaVersion": int(policy.get("schemaVersion", 1) or 1),
        "policyVersion": policy.get("policyVersion", "insight-source-policy-v1"),
        "slots": normalized_slots,
        "requiredCoverage": {
            **DEFAULT_REQUIRED_COVERAGE,
            **(policy.get("requiredCoverage", {}) if isinstance(policy, dict) else {}),
        },
    }


def validate_source_policy(policy: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    slots = policy.get("slots", {})
    required = policy.get("requiredCoverage", DEFAULT_REQUIRED_COVERAGE)

    all_feeds = [feed for slot in SLOTS for feed in slots.get(slot, [])]
    source_groups = {feed["sourceGroup"] for feed in all_feeds}
    tier_a_count = sum(1 for feed in all_feeds if feed.get("tier") == "A")
    topics = {feed.get("topic", "general") for feed in all_feeds}

    for slot in SLOTS:
        count = len(slots.get(slot, []))
        if count == 0:
            errors.append(f"Slot {slot} has no feeds")
        elif count < int(required.get("minFeedsPerSlot", 3)):
            warnings.append(f"Slot {slot} has only {count} feeds")

    if tier_a_count < int(required.get("minTierAFeeds", 6)):
        warnings.append(f"Tier-A feed count is weak: {tier_a_count}")

    if len(source_groups) < int(required.get("minSourceGroups", 8)):
        warnings.append(f"Source-group diversity is weak: {len(source_groups)}")

    if len(topics) < int(required.get("minTopics", 5)):
        warnings.append(f"Topic coverage is weak: {len(topics)}")

    return {
        "status": "FAIL" if errors else "WARN" if warnings else "PASS",
        "errors": errors,
        "warnings": warnings,
        "feedCount": len(all_feeds),
        "sourceGroupCount": len(source_groups),
        "tierACount": tier_a_count,
        "topicCount": len(topics),
    }


def get_slot_feeds_map(path: Path = SOURCE_POLICY_PATH) -> dict[str, list[tuple[str, str, str]]]:
    policy = load_source_policy(path)
    validation = validate_source_policy(policy)

    if validation["errors"]:
        raise RuntimeError("Invalid Insight source policy: " + "; ".join(validation["errors"]))

    return {
        slot: [
            (feed["url"], feed["source"], feed["sourceGroup"])
            for feed in policy["slots"].get(slot, [])
        ]
        for slot in SLOTS
    }


def source_health_score(health: dict[str, Any] | None, ts: int | None = None) -> float:
    """Return 0..1 feed health score from previous source_health.json entry."""
    if not health:
        return 0.55

    if health.get("ok") is False:
        return 0.05

    items = int(health.get("items", 0) or 0)
    last_success = int(health.get("lastSuccess", 0) or 0)
    ts = int(ts or time.time() * 1000)

    item_score = min(1.0, items / max(1, SOURCE_HEALTH_DEFAULTS["minItemsForHealthy"]))
    age_hours = max(0.0, (ts - last_success) / 3_600_000) if last_success else 24.0
    recency_score = max(0.0, 1.0 - age_hours / 24.0)

    return round(0.15 + item_score * 0.65 + recency_score * 0.20, 4)


def source_backoff_reason(
    source_group: str,
    health: dict[str, Any] | None,
    ts: int | None = None,
) -> str:
    if not health:
        return ""

    ts = int(ts or time.time() * 1000)
    last_success = int(health.get("lastSuccess", 0) or 0)
    last_checked = int(health.get("lastChecked", health.get("lastFailure", 0)) or 0)

    if health.get("ok") is False:
        age_hours = (ts - last_checked) / 3_600_000 if last_checked else 999
        if age_hours < SOURCE_HEALTH_DEFAULTS["failedBackoffHours"]:
            return f"recent failure backoff for {source_group}"

    if health.get("ok") is True and int(health.get("items", 0) or 0) == 0:
        age_hours = (ts - last_success) / 3_600_000 if last_success else 0
        if age_hours < SOURCE_HEALTH_DEFAULTS["zeroItemBackoffHours"]:
            return f"zero-item backoff for {source_group}"

    return ""


def rank_slot_feeds_by_health(
    feeds: list[dict[str, Any]],
    source_health: dict[str, Any] | None = None,
    ts: int | None = None,
) -> list[dict[str, Any]]:
    source_health = source_health or {}
    ts = int(ts or time.time() * 1000)

    ranked = []
    for index, feed in enumerate(feeds):
        group = feed["sourceGroup"]
        health = source_health.get(group, {})
        score = source_health_score(health, ts)
        backoff = source_backoff_reason(group, health, ts)

        ranked.append({
            **feed,
            "healthScore": score,
            "backoffReason": backoff,
            "originalIndex": index,
        })

    return sorted(
        ranked,
        key=lambda feed: (
            bool(feed["backoffReason"]),
            -float(feed["healthScore"]),
            feed["tier"],
            feed["originalIndex"],
        ),
    )


def get_active_slot_feeds_map(
    source_health: dict[str, Any] | None = None,
    path: Path = SOURCE_POLICY_PATH,
    ts: int | None = None,
) -> dict[str, list[tuple[str, str, str]]]:
    """Return feed tuples ordered by health, with bounded suppression.

    If suppression would remove too much of a slot, original ranked feeds are
    retained so a bad health file never fully disables Insight fetching.
    """
    policy = load_source_policy(path)
    validation = validate_source_policy(policy)

    if validation["errors"]:
        raise RuntimeError("Invalid Insight source policy: " + "; ".join(validation["errors"]))

    source_health = source_health or {}
    ts = int(ts or time.time() * 1000)
    max_suppressed_fraction = float(SOURCE_HEALTH_DEFAULTS["maxSuppressedFractionPerSlot"])

    active: dict[str, list[tuple[str, str, str]]] = {}

    for slot in SLOTS:
        feeds = policy["slots"].get(slot, [])
        ranked = rank_slot_feeds_by_health(feeds, source_health, ts)
        allowed_suppressed_count = int(len(ranked) * max_suppressed_fraction)

        kept = []
        suppressed = []

        for feed in ranked:
            if feed["backoffReason"] and len(suppressed) < allowed_suppressed_count:
                suppressed.append(feed)
            else:
                kept.append(feed)

        if not kept:
            kept = ranked

        active[slot] = [
            (feed["url"], feed["source"], feed["sourceGroup"])
            for feed in kept
        ]

    return active


def build_source_health_policy_report(
    source_health: dict[str, Any] | None = None,
    path: Path = SOURCE_POLICY_PATH,
    ts: int | None = None,
) -> dict[str, Any]:
    policy = load_source_policy(path)
    source_health = source_health or {}
    ts = int(ts or time.time() * 1000)

    slot_reports = {}

    for slot in SLOTS:
        ranked = rank_slot_feeds_by_health(policy["slots"].get(slot, []), source_health, ts)
        slot_reports[slot] = {
            "feedCount": len(ranked),
            "activeCount": len([
                feed for feed in ranked if not feed["backoffReason"]
            ]),
            "suppressedCount": len([
                feed for feed in ranked if feed["backoffReason"]
            ]),
            "feeds": [
                {
                    "source": feed["source"],
                    "sourceGroup": feed["sourceGroup"],
                    "tier": feed["tier"],
                    "topic": feed["topic"],
                    "healthScore": feed["healthScore"],
                    "backoffReason": feed["backoffReason"],
                }
                for feed in ranked
            ],
        }

    return {
        "schemaVersion": 1,
        "policyVersion": SOURCE_HEALTH_POLICY_VERSION,
        "generatedAt": ts,
        "slotReports": slot_reports,
    }


def build_source_policy_report(
    slot_feeds: dict[str, list[tuple[str, str, str]]],
    source_health: dict[str, Any] | None = None,
    path: Path = SOURCE_POLICY_PATH,
) -> dict[str, Any]:
    policy = load_source_policy(path)
    validation = validate_source_policy(policy)
    source_health = source_health or {}

    feeds_by_group = {}
    for slot in SLOTS:
        for feed in policy["slots"].get(slot, []):
            group = feed["sourceGroup"]
            feeds_by_group.setdefault(group, {
                "sourceGroup": group,
                "source": feed["source"],
                "tier": feed["tier"],
                "topics": set(),
                "slots": set(),
                "configuredFeeds": 0,
                "health": {},
            })
            feeds_by_group[group]["topics"].add(feed["topic"])
            feeds_by_group[group]["slots"].add(slot)
            feeds_by_group[group]["configuredFeeds"] += 1

    for group, health in source_health.items():
        normalized_group = normalize_source_group(group)
        feeds_by_group.setdefault(normalized_group, {
            "sourceGroup": normalized_group,
            "source": normalized_group,
            "tier": "C",
            "topics": set(),
            "slots": set(),
            "configuredFeeds": 0,
            "health": {},
        })
        feeds_by_group[normalized_group]["health"] = health

    slot_summary = {}
    for slot in SLOTS:
        feeds = policy["slots"].get(slot, [])
        tier_counts = Counter(feed["tier"] for feed in feeds)
        topic_counts = Counter(feed["topic"] for feed in feeds)
        slot_summary[slot] = {
            "feedCount": len(feeds),
            "sourceGroups": sorted({feed["sourceGroup"] for feed in feeds}),
            "tierCounts": dict(tier_counts),
            "topicCounts": dict(topic_counts),
        }

    sources = []
    for value in feeds_by_group.values():
        sources.append({
            **value,
            "topics": sorted(value["topics"]),
            "slots": sorted(value["slots"]),
        })

    sources.sort(key=lambda item: (item["tier"], item["sourceGroup"]))

    return {
        "schemaVersion": 1,
        "reportVersion": "insight-source-policy-report-v1",
        "generatedAt": int(time.time() * 1000),
        "policyVersion": policy.get("policyVersion"),
        "validation": validation,
        "slotSummary": slot_summary,
        "sourceHealthPolicy": build_source_health_policy_report(source_health),
        "sourceCount": len(sources),
        "sources": sources,
    }


def write_source_policy_report(
    slot_feeds: dict[str, list[tuple[str, str, str]]],
    source_health: dict[str, Any] | None = None,
    report_path: Path = SOURCE_POLICY_REPORT_PATH,
) -> dict[str, Any]:
    report = build_source_policy_report(slot_feeds, source_health)
    write_json(report_path, report)
    return report
