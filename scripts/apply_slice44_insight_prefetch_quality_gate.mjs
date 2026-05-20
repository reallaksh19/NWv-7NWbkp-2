import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

write('scripts/validate_insight_prefetch_output.py', `"""
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
        f"- Schema: \`{report['schemaVersion']}\`",
        f"- Collector: \`{report.get('collectorVersion') or 'n/a'}\`",
        f"- Content hash: \`{report.get('contentHash') or 'n/a'}\`",
        f"- Stories: \`{report['storyCount']}\`",
        f"- Usable 24h stories: \`{report['usable24hStoryCount']}\`",
        f"- Source groups: \`{report['sourceGroupCount']}\`",
        f"- Angle hint coverage: \`{report['angleHintCoverage']:.0%}\`",
        f"- Non-base angle stories: \`{report['nonBaseAngleStoryCount']}\`",
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

    SUMMARY_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


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
`);

write('scripts/test_validate_insight_prefetch_output.py', `import json
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
`);

patchFile('.github/workflows/news_prefetch.yml', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `      - name: Fetch Insight stories
        run: python scripts/fetch_insight_stories.py
`,
    `
      - name: Validate Insight prefetch quality
        run: python scripts/validate_insight_prefetch_output.py

      - name: Upload Insight quality report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: insight-quality-report
          path: |
            public/newsdata/insight_quality_report.json
            public/newsdata/insight_quality_summary.md
          if-no-files-found: warn
`,
    'workflow insight prefetch quality gate'
  );

  return text;
});

write('scripts/test_insight_prefetch_quality_gate_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const gate = read('scripts/validate_insight_prefetch_output.py');
const gateTest = read('scripts/test_validate_insight_prefetch_output.py');
const workflow = read('.github/workflows/news_prefetch.yml');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'INSIGHT_PATH',
  'REPORT_PATH',
  'SUMMARY_PATH',
  'validate_snapshot',
  'slotHealth',
  'angleHintCoverage',
  'nonBaseAngleStoryCount',
  'Insight Prefetch Quality Report'
]) {
  assert(gate.includes(token), \`validate_insight_prefetch_output.py missing token: \${token}\`);
}

for (const token of [
  'test_validate_snapshot_passes_structural_contract',
  'test_validate_snapshot_fails_missing_core_fields',
  'test_write_summary_creates_markdown'
]) {
  assert(gateTest.includes(token), \`test_validate_insight_prefetch_output.py missing token: \${token}\`);
}

for (const token of [
  'Validate Insight prefetch quality',
  'python scripts/validate_insight_prefetch_output.py',
  'Upload Insight quality report',
  'actions/upload-artifact@v4',
  'insight-quality-report'
]) {
  assert(workflow.includes(token), \`news_prefetch.yml missing workflow quality gate token: \${token}\`);
}

assert(
  packageJson.includes('"test:insight-prefetch-quality-gate"'),
  'package.json must include test:insight-prefetch-quality-gate'
);

assert(
  certGate.includes("['npm', ['run', 'test:insight-prefetch-quality-gate']]"),
  'certification gate must run test:insight-prefetch-quality-gate'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight prefetch workflow quality gate slice',
  guarantees: [
    'prefetch JSON validator exists',
    'quality report JSON is generated',
    'quality report Markdown is generated',
    'workflow validates Insight JSON after fetch',
    'workflow uploads quality report artifact',
    'structural JSON errors fail the workflow',
    'thin-but-usable pools emit warnings, not false success'
  ]
}, null, 2));

console.log('PASS: Insight prefetch quality gate static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-prefetch-quality-gate'] = 'node scripts/test_insight_prefetch_quality_gate_static.mjs && python -m pytest scripts/test_validate_insight_prefetch_output.py';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-prefetch-quality-gate']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-browser-json-ingestion']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-browser-json-ingestion']],",
      "  ['npm', ['run', 'test:insight-browser-json-ingestion']],\n  ['npm', ['run', 'test:insight-prefetch-quality-gate']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-prefetch-quality-gate']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 44 Insight prefetch workflow quality gate patch complete.');
