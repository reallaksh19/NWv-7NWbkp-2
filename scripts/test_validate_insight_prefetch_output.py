import json
import tempfile
from pathlib import Path

import validate_insight_prefetch_output as gate


def make_story(index, angle="official_response", source_group="source_a"):
    return {
        "id": f"story-{index}",
        "title": f"Acme Bank outage story {index}",
        "summary": "Officials said investors and users reacted to the outage.",
        "url": f"https://example.com/{index}",
        "publishedAt": gate.int(time.time() * 1000) if False else 1767278400000,
        "source": source_group,
        "sourceGroup": source_group,
        "angleHints": [{"angle": angle, "score": 0.9}],
        "storySignals": {
            "topicTokens": ["acme", "bank", "outage"],
            "numbers": ["4 percent"],
            "angleHints": [{"angle": angle, "score": 0.9}],
        },
    }


def test_validate_snapshot_passes_structural_contract():
    now = 1767282000000
    stories = [
        make_story(i, angle="official_response" if i % 2 == 0 else "market_reaction", source_group=f"source_{i % 6}")
        for i in range(30)
    ]

    snapshot = {
        "schemaVersion": 3,
        "collectorVersion": "insight-collector-json-v3",
        "contentHash": "abc123",
        "fetchedAt": now,
        "slotMeta": {
            "now": {"fetchedAt": now, "storyIds": [s["id"] for s in stories[:10]]},
            "minus4h": {"fetchedAt": now, "storyIds": [s["id"] for s in stories[10:18]]},
            "minus12h": {"fetchedAt": now, "storyIds": [s["id"] for s in stories[18:24]]},
            "minus24h": {"fetchedAt": now, "storyIds": [s["id"] for s in stories[24:30]]},
        },
        "stories": stories,
    }

    report = gate.validate_snapshot(snapshot, now)

    assert report["status"] in ("PASS", "WARN")
    assert report["schemaVersion"] == 3
    assert report["storyCount"] == 30
    assert report["sourceGroupCount"] >= 5
    assert report["angleHintCoverage"] >= 0.35
    assert not report["errors"]


def test_validate_snapshot_fails_missing_core_fields():
    report = gate.validate_snapshot({
        "schemaVersion": 99,
        "stories": [],
        "fetchedAt": 0,
        "contentHash": "",
    }, 1767282000000)

    assert report["status"] == "FAIL"
    assert report["errors"]


def test_write_summary_creates_markdown(tmp_path, monkeypatch):
    report_path = tmp_path / "insight_quality_report.json"
    summary_path = tmp_path / "insight_quality_summary.md"

    monkeypatch.setattr(gate, "REPORT_PATH", report_path)
    monkeypatch.setattr(gate, "SUMMARY_PATH", summary_path)

    report = {
        "status": "WARN",
        "schemaVersion": 3,
        "collectorVersion": "v",
        "contentHash": "h",
        "storyCount": 10,
        "usable24hStoryCount": 8,
        "sourceGroupCount": 3,
        "angleHintCoverage": 0.5,
        "nonBaseAngleStoryCount": 4,
        "slotHealth": {
            "now": {"storyIds": 1, "linkedStories": 1, "sourceGroupCount": 1, "thin": True},
            "minus4h": {"storyIds": 1, "linkedStories": 1, "sourceGroupCount": 1, "thin": True},
            "minus12h": {"storyIds": 1, "linkedStories": 1, "sourceGroupCount": 1, "thin": True},
            "minus24h": {"storyIds": 1, "linkedStories": 1, "sourceGroupCount": 1, "thin": True},
        },
        "errors": [],
        "warnings": ["thin"],
        "topAngles": [{"angle": "official_response", "count": 2}],
    }

    gate.write_json(report_path, report)
    gate.write_summary(report)

    assert report_path.exists()
    assert summary_path.exists()
    assert "Insight Prefetch Quality Report" in summary_path.read_text()
