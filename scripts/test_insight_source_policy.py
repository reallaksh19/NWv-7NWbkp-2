from pathlib import Path
import json
import tempfile

from insight_source_policy import (
    build_source_policy_report,
    get_slot_feeds_map,
    load_source_policy,
    normalize_feed,
    validate_source_policy,
)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def test_normalize_feed():
    feed = normalize_feed({
        "url": "https://example.com/rss",
        "source": "Example News",
        "sourceGroup": "Example News",
        "tier": "A",
        "topic": "Markets",
    })

    assert_true(feed["sourceGroup"] == "example_news", "source group should normalize")
    assert_true(feed["tier"] == "A", "tier should preserve A")
    assert_true(feed["topic"] == "markets", "topic should lowercase")


def test_policy_load_and_validate():
    policy = load_source_policy()
    validation = validate_source_policy(policy)

    assert_true(validation["status"] in {"PASS", "WARN"}, "policy should not fail")
    assert_true(validation["feedCount"] >= 12, "policy should include enough feeds")
    assert_true(validation["sourceGroupCount"] >= 8, "policy should include source diversity")


def test_slot_feed_map_shape():
    feeds = get_slot_feeds_map()

    assert_true(set(feeds.keys()) == {"now", "minus4h", "minus12h", "minus24h"}, "all slots required")
    assert_true(all(isinstance(item, tuple) and len(item) == 3 for slot in feeds.values() for item in slot), "feeds must be tuple triples")


def test_source_policy_report():
    feeds = get_slot_feeds_map()
    report = build_source_policy_report(feeds, {
        "the_hindu": {"ok": True, "items": 12, "lastSuccess": 123},
        "bbc": {"ok": False, "items": 0, "error": "timeout"},
    })

    assert_true(report["reportVersion"] == "insight-source-policy-report-v1", "report version missing")
    assert_true(report["sourceCount"] >= 2, "source count missing")
    assert_true("now" in report["slotSummary"], "slot summary missing")
    assert_true(any(source["sourceGroup"] == "the_hindu" for source in report["sources"]), "health source missing")


if __name__ == "__main__":
    test_normalize_feed()
    test_policy_load_and_validate()
    test_slot_feed_map_shape()
    test_source_policy_report()
    print("PASS: Insight source policy Python tests")
