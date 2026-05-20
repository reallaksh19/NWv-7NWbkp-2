import json
import time

from insight_json_contract import (
    COLLECTOR_VERSION,
    compute_snapshot_content_hash,
    infer_angle_hints,
    optimize_insight_snapshot,
)


def sample_story(idx, title, summary, source_group="source_a"):
    return {
        "id": f"story-{idx}",
        "title": title,
        "summary": summary,
        "url": f"https://example.com/{idx}",
        "publishedAt": int(time.time() * 1000) - idx * 1000,
        "source": source_group,
        "sourceGroup": source_group,
        "fetchedForSlots": ["now"],
    }


def test_angle_hints_detect_official_market_and_public():
    official = infer_angle_hints(sample_story(
        1,
        "Finance Ministry says Acme Bank outage is under review",
        "Officials said the regulator asked for a statement",
    ))

    market = infer_angle_hints(sample_story(
        2,
        "Acme Bank shares fell as investors reacted",
        "Market trading fell 4 percent",
    ))

    public = infer_angle_hints(sample_story(
        3,
        "Customers criticise Acme Bank after outage goes viral",
        "Users and residents reacted online",
    ))

    assert official[0]["angle"] == "official_response"
    assert market[0]["angle"] == "market_reaction"
    assert public[0]["angle"] == "reaction_public"


def test_optimized_snapshot_has_schema_v3_quality_and_stable_hash():
    ts = int(time.time() * 1000)
    snapshot = {
        "schemaVersion": 2,
        "fetchedAt": ts,
        "slotMeta": {
            "now": {"fetchedAt": ts, "storyIds": ["story-1", "story-2"]},
            "minus4h": {"fetchedAt": ts, "storyIds": []},
            "minus12h": {"fetchedAt": ts, "storyIds": []},
            "minus24h": {"fetchedAt": ts, "storyIds": []},
        },
        "stories": [
            sample_story(1, "Finance Ministry says Acme Bank outage is under review", "Officials said regulator asked for statement", "gov"),
            sample_story(2, "Acme Bank shares fell as investors reacted", "Shares fell 4 percent", "market"),
        ],
    }

    optimized = optimize_insight_snapshot(snapshot, ts)
    hash_a = compute_snapshot_content_hash(optimized["stories"])
    hash_b = compute_snapshot_content_hash(json.loads(json.dumps(optimized["stories"])))

    assert optimized["schemaVersion"] == 3
    assert optimized["collectorVersion"] == COLLECTOR_VERSION
    assert optimized["slotQuality"]["now"]["storyCount"] == 2
    assert optimized["sourceDiversity"]["sourceGroupCount"] == 2
    assert optimized["contentHash"] == hash_a
    assert hash_a == hash_b
