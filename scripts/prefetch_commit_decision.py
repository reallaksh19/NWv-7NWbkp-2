"""
Create a content-aware commit decision for news prefetch workflow.

Why:
  Quality reports and fetchedAt timestamps can change even when user-visible news
  content did not. This script separates meaningful data changes from diagnostic
  noise and writes a manifest consumed by GitHub Actions.

Outputs:
  public/newsdata/prefetch_commit_manifest.json
  GITHUB_OUTPUT values when running in Actions:
    should_commit=true/false
    changed_content_files=...
    diagnostic_only=true/false
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

NEWS_DIR = Path("public/newsdata")
MANIFEST_PATH = NEWS_DIR / "prefetch_commit_manifest.json"

CONTENT_FILES = [
    NEWS_DIR / "insight_latest.json",
    NEWS_DIR / "sections_latest.json",
    NEWS_DIR / "source_health.json",
]

DIAGNOSTIC_FILES = [
    NEWS_DIR / "insight_quality_report.json",
    NEWS_DIR / "insight_quality_summary.md",
]


def run_git(args: list[str]) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def stable_json_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def file_sha256(path: Path) -> str:
    if not path.exists():
        return ""

    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()[:16]


def meaningful_payload_from_value_for_test(data: dict[str, Any], filename: str) -> Any:
    path = Path(filename)
    name = path.name

    if name == "insight_latest.json":
        return {
            "schemaVersion": data.get("schemaVersion"),
            "collectorVersion": data.get("collectorVersion"),
            "contentHash": data.get("contentHash"),
            "storyIds": sorted(story.get("id", "") for story in data.get("stories", [])),
            "slotMeta": {
                slot: sorted(meta.get("storyIds", []))
                for slot, meta in (data.get("slotMeta", {}) or {}).items()
            },
            "slotQuality": data.get("slotQuality", {}),
            "sourceDiversity": data.get("sourceDiversity", {}),
        }

    if name == "sections_latest.json":
        return {
            "schemaVersion": data.get("schemaVersion"),
            "contentHash": data.get("contentHash"),
            "sections": data.get("sections", data.get("stories", [])),
        }

    if name == "source_health.json":
        return {"sources": data.get("sources", {})}

    return data


def meaningful_payload(path: Path) -> Any:
    if not path.exists():
        return None

    if path.suffix != ".json":
        return {
            "path": str(path),
            "sha": file_sha256(path),
        }

    data = read_json(path)

    if path.name == "insight_latest.json":
        return {
            "schemaVersion": data.get("schemaVersion"),
            "collectorVersion": data.get("collectorVersion"),
            "contentHash": data.get("contentHash"),
            "storyIds": sorted(story.get("id", "") for story in data.get("stories", [])),
            "slotMeta": {
                slot: sorted(meta.get("storyIds", []))
                for slot, meta in (data.get("slotMeta", {}) or {}).items()
            },
            "slotQuality": data.get("slotQuality", {}),
            "sourceDiversity": data.get("sourceDiversity", {}),
        }

    if path.name == "sections_latest.json":
        return {
            "schemaVersion": data.get("schemaVersion"),
            "contentHash": data.get("contentHash"),
            "sections": data.get("sections", data.get("stories", [])),
        }

    if path.name == "source_health.json":
        return {
            "sources": data.get("sources", {}),
        }

    return data


def content_hashes(paths: list[Path]) -> dict[str, str]:
    return {
        str(path): stable_json_hash(meaningful_payload(path))
        for path in paths
        if path.exists()
    }


def changed_files_from_git() -> list[str]:
    output = run_git(["status", "--porcelain", "--", "public/newsdata"])
    changed = []

    for line in output.splitlines():
        if not line.strip():
            continue
        changed.append(line[3:].strip())

    return sorted(changed)


def has_meaningful_diff(paths: list[Path]) -> bool:
    for path in paths:
        if not path.exists():
            continue

        diff_name_only = run_git(["diff", "--name-only", "--", str(path)])
        staged_name_only = run_git(["diff", "--cached", "--name-only", "--", str(path)])

        if diff_name_only or staged_name_only:
            return True

        # New untracked file
        if str(path) in changed_files_from_git():
            return True

    return False


def write_github_output(values: dict[str, str]) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        return

    with open(output_path, "a", encoding="utf-8") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")


def build_manifest() -> dict[str, Any]:
    changed_files = changed_files_from_git()
    content_hash_map = content_hashes(CONTENT_FILES)
    diagnostic_hash_map = content_hashes(DIAGNOSTIC_FILES)

    changed_content_files = [
        str(path)
        for path in CONTENT_FILES
        if str(path) in changed_files or path.exists() and has_meaningful_diff([path])
    ]

    changed_diagnostic_files = [
        str(path)
        for path in DIAGNOSTIC_FILES
        if str(path) in changed_files or path.exists() and has_meaningful_diff([path])
    ]

    should_commit = bool(changed_content_files)
    diagnostic_only = bool(changed_diagnostic_files) and not should_commit

    return {
        "generatedAt": int(time.time() * 1000),
        "policyVersion": "prefetch-commit-policy-v1",
        "shouldCommit": should_commit,
        "diagnosticOnly": diagnostic_only,
        "changedFiles": changed_files,
        "changedContentFiles": changed_content_files,
        "changedDiagnosticFiles": changed_diagnostic_files,
        "contentHashes": content_hash_map,
        "diagnosticHashes": diagnostic_hash_map,
        "trackedContentFiles": [str(path) for path in CONTENT_FILES],
        "trackedDiagnosticFiles": [str(path) for path in DIAGNOSTIC_FILES],
    }


def main() -> int:
    NEWS_DIR.mkdir(parents=True, exist_ok=True)

    manifest = build_manifest()
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )

    write_github_output({
        "should_commit": "true" if manifest["shouldCommit"] else "false",
        "diagnostic_only": "true" if manifest["diagnosticOnly"] else "false",
        "changed_content_files": ",".join(manifest["changedContentFiles"]),
    })

    print(json.dumps({
        "shouldCommit": manifest["shouldCommit"],
        "diagnosticOnly": manifest["diagnosticOnly"],
        "changedContentFiles": manifest["changedContentFiles"],
        "changedDiagnosticFiles": manifest["changedDiagnosticFiles"],
    }, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
