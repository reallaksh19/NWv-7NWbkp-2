import json
import tempfile
from pathlib import Path

import prefetch_commit_decision as policy


def test_stable_hash_ignores_insight_fetched_at_noise():
    a = {
        "schemaVersion": 3,
        "collectorVersion": "v3",
        "contentHash": "abc",
        "fetchedAt": 100,
        "generatedAt": 100,
        "stories": [{"id": "a"}, {"id": "b"}],
        "slotMeta": {"now": {"storyIds": ["a", "b"]}},
        "slotQuality": {"now": {"storyCount": 2}},
        "sourceDiversity": {"sourceGroupCount": 2},
    }

    b = {
        **a,
        "fetchedAt": 200,
        "generatedAt": 200,
    }

    assert policy.stable_json_hash(policy.meaningful_payload_from_value_for_test(a, "insight_latest.json")) == policy.stable_json_hash(policy.meaningful_payload_from_value_for_test(b, "insight_latest.json"))


def test_manifest_marks_content_change():
    manifest = {
        "shouldCommit": True,
        "diagnosticOnly": False,
        "changedContentFiles": ["public/newsdata/insight_latest.json"],
        "changedDiagnosticFiles": ["public/newsdata/insight_quality_report.json"],
    }

    assert manifest["shouldCommit"] is True
    assert manifest["diagnosticOnly"] is False


def test_manifest_marks_diagnostic_only():
    manifest = {
        "shouldCommit": False,
        "diagnosticOnly": True,
        "changedContentFiles": [],
        "changedDiagnosticFiles": ["public/newsdata/insight_quality_report.json"],
    }

    assert manifest["shouldCommit"] is False
    assert manifest["diagnosticOnly"] is True
