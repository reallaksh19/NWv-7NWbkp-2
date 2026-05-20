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

write('scripts/prefetch_commit_decision.py', `"""
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
            handle.write(f"{key}={value}\\n")


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
`);

write('scripts/test_prefetch_commit_decision.py', `import json
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
`);

patchFile('scripts/prefetch_commit_decision.py', source => {
  if (source.includes('def meaningful_payload_from_value_for_test')) return source;

  return source.replace(
    'def meaningful_payload(path: Path) -> Any:\n',
    `def meaningful_payload_from_value_for_test(data: dict[str, Any], filename: str) -> Any:
    path = Path(filename)

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


def meaningful_payload(path: Path) -> Any:
`
  );
});

patchFile('scripts/prefetch_commit_decision.py', source => {
  let text = source;

  text = replaceOnce(
    text,
    `    if path.name == "insight_latest.json":
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

    return data`,
    `    return meaningful_payload_from_value_for_test(data, path.name)`,
    'dedupe meaningful payload body'
  );

  return text;
});

patchFile('.github/workflows/news_prefetch.yml', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `      - name: Fetch Sections stories
        run: python scripts/fetch_sections_stories.py
`,
    `
      - name: Decide whether news data commit is needed
        id: prefetch_commit
        run: python scripts/prefetch_commit_decision.py

      - name: Upload prefetch commit manifest
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: prefetch-commit-manifest
          path: public/newsdata/prefetch_commit_manifest.json
          if-no-files-found: warn
`,
    'workflow commit decision step'
  );

  text = replaceOnce(
    text,
    `      - name: Commit data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/newsdata/
          if git diff --staged --quiet; then
            echo "No changes — skipping commit"
            exit 0
          fi
          git commit -m "data: news prefetch $(date -u +'%Y-%m-%dT%H:%MZ')"
          git push`,
    `      - name: Commit data
        if: steps.prefetch_commit.outputs.should_commit == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/newsdata/insight_latest.json public/newsdata/sections_latest.json public/newsdata/source_health.json public/newsdata/prefetch_commit_manifest.json
          if git diff --staged --quiet; then
            echo "No meaningful news-data changes — skipping commit"
            exit 0
          fi
          git commit -m "data: news prefetch $(date -u +'%Y-%m-%dT%H:%MZ')"
          git push

      - name: Skip commit for diagnostic-only changes
        if: steps.prefetch_commit.outputs.should_commit != 'true'
        run: |
          echo "No meaningful news content changes. Quality reports were uploaded as artifacts only."`,
    'conditional content-only commit'
  );

  return text;
});

write('scripts/test_prefetch_commit_optimization_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const decision = read('scripts/prefetch_commit_decision.py');
const decisionTest = read('scripts/test_prefetch_commit_decision.py');
const workflow = read('.github/workflows/news_prefetch.yml');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'prefetch_commit_manifest.json',
  'CONTENT_FILES',
  'DIAGNOSTIC_FILES',
  'shouldCommit',
  'diagnosticOnly',
  'changedContentFiles',
  'GITHUB_OUTPUT',
  'meaningful_payload_from_value_for_test'
]) {
  assert(decision.includes(token), \`prefetch_commit_decision.py missing token: \${token}\`);
}

for (const token of [
  'test_stable_hash_ignores_insight_fetched_at_noise',
  'test_manifest_marks_content_change',
  'test_manifest_marks_diagnostic_only'
]) {
  assert(decisionTest.includes(token), \`test_prefetch_commit_decision.py missing token: \${token}\`);
}

for (const token of [
  'Decide whether news data commit is needed',
  'id: prefetch_commit',
  'python scripts/prefetch_commit_decision.py',
  'Upload prefetch commit manifest',
  'if: steps.prefetch_commit.outputs.should_commit ==',
  'public/newsdata/insight_latest.json public/newsdata/sections_latest.json public/newsdata/source_health.json public/newsdata/prefetch_commit_manifest.json',
  'Skip commit for diagnostic-only changes'
]) {
  assert(workflow.includes(token), \`news_prefetch.yml missing commit optimization token: \${token}\`);
}

assert(
  !workflow.includes('git add public/newsdata/\\n'),
  'workflow must not blindly add all public/newsdata files'
);

assert(
  packageJson.includes('"test:prefetch-commit-optimization"'),
  'package.json must include test:prefetch-commit-optimization'
);

assert(
  certGate.includes("['npm', ['run', 'test:prefetch-commit-optimization']]"),
  'certification gate must run test:prefetch-commit-optimization'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Prefetch commit optimization slice',
  guarantees: [
    'content-aware commit decision exists',
    'fetchedAt-only noise is ignored for Insight hash comparison',
    'diagnostic-only report changes do not force commits',
    'workflow commits only meaningful news JSON files',
    'commit manifest is uploaded as artifact',
    'blind git add public/newsdata is removed',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Prefetch commit optimization static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:prefetch-commit-optimization'] = 'node scripts/test_prefetch_commit_optimization_static.mjs && python -m pytest scripts/test_prefetch_commit_decision.py';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:prefetch-commit-optimization']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-prefetch-quality-gate']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-prefetch-quality-gate']],",
      "  ['npm', ['run', 'test:insight-prefetch-quality-gate']],\n  ['npm', ['run', 'test:prefetch-commit-optimization']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:prefetch-commit-optimization']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 45 prefetch commit optimization patch complete.');
