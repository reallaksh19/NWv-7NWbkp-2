import time

from insight_source_policy import (
    build_source_health_policy_report,
    get_active_slot_feeds_map,
    load_source_policy,
    rank_slot_feeds_by_health,
    source_backoff_reason,
    source_health_score,
)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def test_source_health_score_prefers_successful_item_yield():
    ts = int(time.time() * 1000)

    good = source_health_score({"ok": True, "items": 12, "lastSuccess": ts}, ts)
    empty = source_health_score({"ok": True, "items": 0, "lastSuccess": ts}, ts)
    failed = source_health_score({"ok": False, "items": 0, "lastChecked": ts}, ts)

    assert_true(good > empty, "good source should score higher than empty source")
    assert_true(empty > failed, "empty source should score higher than failed source")


def test_source_backoff_reason_for_recent_failure():
    ts = int(time.time() * 1000)
    reason = source_backoff_reason("bad_source", {
        "ok": False,
        "items": 0,
        "lastChecked": ts,
        "error": "timeout",
    }, ts)

    assert_true("recent failure backoff" in reason, "recent failed source should back off")


def test_rank_slot_feeds_by_health_orders_healthy_first():
    feeds = [
        {"url": "https://bad.example/rss", "source": "Bad", "sourceGroup": "bad", "tier": "A", "topic": "news"},
        {"url": "https://good.example/rss", "source": "Good", "sourceGroup": "good", "tier": "B", "topic": "news"},
    ]

    ts = int(time.time() * 1000)
    ranked = rank_slot_feeds_by_health(feeds, {
        "bad": {"ok": False, "items": 0, "lastChecked": ts},
        "good": {"ok": True, "items": 12, "lastSuccess": ts},
    }, ts)

    assert_true(ranked[0]["sourceGroup"] == "good", "healthy feed should rank first")
    assert_true(ranked[1]["backoffReason"], "failed feed should have backoff reason")


def test_active_slot_feeds_never_fully_empty():
    ts = int(time.time() * 1000)
    policy = load_source_policy()

    health = {}
    for slot, feeds in policy["slots"].items():
        for feed in feeds:
            health[feed["sourceGroup"]] = {
                "ok": False,
                "items": 0,
                "lastChecked": ts,
                "error": "forced failure",
            }

    active = get_active_slot_feeds_map(health, ts=ts)

    assert_true(all(active[slot] for slot in ["now", "minus4h", "minus12h", "minus24h"]), "active feeds must never be empty")


def test_source_health_policy_report_shape():
    ts = int(time.time() * 1000)
    report = build_source_health_policy_report({
        "the_hindu": {"ok": True, "items": 10, "lastSuccess": ts},
        "bbc": {"ok": False, "items": 0, "lastChecked": ts},
    }, ts=ts)

    assert_true(report["policyVersion"] == "insight-source-health-policy-v1", "policy version missing")
    assert_true("now" in report["slotReports"], "slot report missing")
    assert_true(report["slotReports"]["now"]["feedCount"] >= 1, "feed count missing")


if __name__ == "__main__":
    test_source_health_score_prefers_successful_item_yield()
    test_source_backoff_reason_for_recent_failure()
    test_rank_slot_feeds_by_health_orders_healthy_first()
    test_active_slot_feeds_never_fully_empty()
    test_source_health_policy_report_shape()
    print("PASS: Insight adaptive source health Python tests")
