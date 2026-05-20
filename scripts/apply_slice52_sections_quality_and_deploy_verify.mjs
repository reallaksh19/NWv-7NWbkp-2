import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/'); if (dir) fs.mkdirSync(dir, { recursive: true });
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

write('scripts/validate_sections_prefetch_output.py', `"""
Validate generated section prefetch JSON.

Hard fail only for structural breakage. Thin sections generate warnings and
reports so the app can diagnose why a tab is weak without blocking every run.
"""
from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path
from typing import Any

SECTIONS_PATH = Path("public/newsdata/sections_latest.json")
REPORT_PATH = Path("public/newsdata/sections_quality_report.json")
SUMMARY_PATH = Path("public/newsdata/sections_quality_summary.md")

SUPPORTED_SCHEMAS = {1, 2}
RECOMMENDED_SCHEMA = 2

REQUIRED_SECTIONS = [
    "topStories", "india", "tn", "trichy", "world",
    "business", "technology", "sports", "entertainment",
]

MIN_TOTAL_STORIES = 45
MIN_SECTION_STORIES = 4
MIN_SECTION_SOURCE_GROUPS = 2


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


def story_source_group(story: dict[str, Any]) -> str:
    return str(story.get("sourceGroup") or story.get("source") or "unknown_source").strip().lower() or "unknown_source"


def normalize_sections(snapshot: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    sections = snapshot.get("sections", {})
    if not isinstance(sections, dict):
        return {}

    return {
        key: value if isinstance(value, list) else []
        for key, value in sections.items()
    }


def build_section_health(snapshot: dict[str, Any]) -> dict[str, Any]:
    sections = normalize_sections(snapshot)
    section_quality = snapshot.get("sectionQuality", {}) if isinstance(snapshot.get("sectionQuality", {}), dict) else {}

    health = {}

    for section in REQUIRED_SECTIONS:
        stories = sections.get(section, [])
        source_counts = Counter(story_source_group(story) for story in stories)
        quality = section_quality.get(section, {}) if isinstance(section_quality.get(section, {}), dict) else {}

        story_count = len(stories)
        source_group_count = len(source_counts)

        health[section] = {
            "storyCount": story_count,
            "sourceGroupCount": source_group_count,
            "qualityStoryCount": int(quality.get("storyCount", story_count) or 0),
            "qualitySourceGroupCount": int(quality.get("sourceGroupCount", source_group_count) or 0),
            "thin": story_count < MIN_SECTION_STORIES or source_group_count < MIN_SECTION_SOURCE_GROUPS,
            "topSources": [
                {"sourceGroup": source, "count": count}
                for source, count in source_counts.most_common(8)
            ],
        }

    return health


def validate_sections_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    schema = int(snapshot.get("schemaVersion") or 0)
    sections = normalize_sections(snapshot)

    if schema not in SUPPORTED_SCHEMAS:
        errors.append(f"Unsupported schemaVersion: {schema}")

    if schema < RECOMMENDED_SCHEMA:
        warnings.append("schemaVersion is supported but does not include optimized sectionQuality schema v2")

    if not sections:
        errors.append("sections object is missing or empty")

    if not snapshot.get("contentHash"):
        errors.append("contentHash is missing")

    if not int(snapshot.get("fetchedAt") or 0):
        errors.append("fetchedAt is missing or zero")

    missing_sections = [section for section in REQUIRED_SECTIONS if section not in sections]
    if missing_sections:
        warnings.append(f"Missing configured sections: {', '.join(missing_sections)}")

    health = build_section_health(snapshot)
    total_stories = sum(len(stories) for stories in sections.values())
    all_source_groups = {
        story_source_group(story)
        for stories in sections.values()
        for story in stories
    }

    if total_stories == 0:
        errors.append("all sections are empty")

    if total_stories < MIN_TOTAL_STORIES:
        warnings.append(f"Thin total section pool: {total_stories} stories < recommended {MIN_TOTAL_STORIES}")

    for section, item in health.items():
        if item["storyCount"] == 0:
            warnings.append(f"Section {section} has zero stories")
        elif item["storyCount"] < MIN_SECTION_STORIES:
            warnings.append(f"Section {section} is thin: {item['storyCount']} stories")
        if item["sourceGroupCount"] < MIN_SECTION_SOURCE_GROUPS and item["storyCount"] > 0:
            warnings.append(f"Section {section} has weak source diversity: {item['sourceGroupCount']} source group(s)")

    if schema >= 2 and not snapshot.get("sectionQuality"):
        warnings.append("schema v2 snapshot missing sectionQuality")

    status = "FAIL" if errors else "WARN" if warnings else "PASS"

    return {
        "status": status,
        "generatedAt": int(time.time() * 1000),
        "schemaVersion": schema,
        "contentHash": snapshot.get("contentHash", ""),
        "fetchedAt": snapshot.get("fetchedAt", 0),
        "sectionCount": len(sections),
        "storyCount": total_stories,
        "sourceGroupCount": len(all_source_groups),
        "sectionHealth": health,
        "errors": errors,
        "warnings": warnings,
        "thresholds": {
            "minTotalStories": MIN_TOTAL_STORIES,
            "minSectionStories": MIN_SECTION_STORIES,
            "minSectionSourceGroups": MIN_SECTION_SOURCE_GROUPS,
        },
    }


def write_summary(report: dict[str, Any]) -> None:
    lines = [
        "# Sections Prefetch Quality Report",
        "",
        f"- Status: **{report['status']}**",
        f"- Schema: \`{report['schemaVersion']}\`",
        f"- Content hash: \`{report.get('contentHash') or 'n/a'}\`",
        f"- Sections: \`{report['sectionCount']}\`",
        f"- Stories: \`{report['storyCount']}\`",
        f"- Source groups: \`{report['sourceGroupCount']}\`",
        "",
        "## Section health",
        "",
        "| Section | Stories | Sources | Thin |",
        "|---|---:|---:|---|",
    ]

    for section in REQUIRED_SECTIONS:
        item = report["sectionHealth"].get(section, {})
        lines.append(
            f"| {section} | {item.get('storyCount', 0)} | {item.get('sourceGroupCount', 0)} | {item.get('thin', True)} |"
        )

    if report["errors"]:
        lines += ["", "## Errors", ""]
        lines += [f"- {item}" for item in report["errors"]]

    if report["warnings"]:
        lines += ["", "## Warnings", ""]
        lines += [f"- {item}" for item in report["warnings"]]

    SUMMARY_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    if not SECTIONS_PATH.exists():
        report = {
            "status": "FAIL",
            "generatedAt": int(time.time() * 1000),
            "schemaVersion": 0,
            "contentHash": "",
            "fetchedAt": 0,
            "sectionCount": 0,
            "storyCount": 0,
            "sourceGroupCount": 0,
            "sectionHealth": {},
            "errors": [f"Missing {SECTIONS_PATH}"],
            "warnings": [],
        }
        write_json(REPORT_PATH, report)
        write_summary(report)
        print("Sections validation failed: missing sections_latest.json")
        return 1

    snapshot = read_json(SECTIONS_PATH, {})
    report = validate_sections_snapshot(snapshot)

    write_json(REPORT_PATH, report)
    write_summary(report)

    print(json.dumps({
        "status": report["status"],
        "sectionCount": report["sectionCount"],
        "storyCount": report["storyCount"],
        "sourceGroupCount": report["sourceGroupCount"],
        "errors": report["errors"],
        "warnings": report["warnings"],
    }, indent=2))

    return 1 if report["status"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
`);

write('scripts/test_validate_sections_prefetch_output.py', `import validate_sections_prefetch_output as gate


def make_story(index, section, source_group):
    return {
        "id": f"{section}-{index}",
        "title": f"{section} story {index}",
        "summary": "Summary",
        "url": f"https://example.com/{section}/{index}",
        "publishedAt": 1767278400000,
        "source": source_group,
        "sourceGroup": source_group,
    }


def test_validate_sections_snapshot_warns_not_fails_for_thin_pool():
    snapshot = {
        "schemaVersion": 2,
        "contentHash": "abc",
        "fetchedAt": 1767282000000,
        "sectionQuality": {
            "topStories": {"storyCount": 2, "sourceGroupCount": 2},
        },
        "sections": {
            "topStories": [
                make_story(1, "topStories", "a"),
                make_story(2, "topStories", "b"),
            ],
        },
    }

    report = gate.validate_sections_snapshot(snapshot)

    assert report["status"] == "WARN"
    assert report["storyCount"] == 2
    assert report["sectionHealth"]["topStories"]["sourceGroupCount"] == 2
    assert not report["errors"]


def test_validate_sections_snapshot_fails_structural_errors():
    report = gate.validate_sections_snapshot({
        "schemaVersion": 99,
        "contentHash": "",
        "fetchedAt": 0,
        "sections": {},
    })

    assert report["status"] == "FAIL"
    assert report["errors"]


def test_validate_sections_snapshot_passes_healthy_shape():
    sections = {}

    for section in gate.REQUIRED_SECTIONS:
        sections[section] = [
            make_story(i, section, f"source_{i % 3}")
            for i in range(6)
        ]

    snapshot = {
        "schemaVersion": 2,
        "contentHash": "hash",
        "fetchedAt": 1767282000000,
        "sectionQuality": {
            section: {"storyCount": 6, "sourceGroupCount": 3}
            for section in gate.REQUIRED_SECTIONS
        },
        "sections": sections,
    }

    report = gate.validate_sections_snapshot(snapshot)

    assert report["status"] in ("PASS", "WARN")
    assert report["sectionCount"] == len(gate.REQUIRED_SECTIONS)
    assert report["storyCount"] >= 45
    assert report["sourceGroupCount"] >= 3
    assert not report["errors"]


def test_write_summary_creates_markdown(tmp_path, monkeypatch):
    report_path = tmp_path / "sections_quality_report.json"
    summary_path = tmp_path / "sections_quality_summary.md"

    monkeypatch.setattr(gate, "REPORT_PATH", report_path)
    monkeypatch.setattr(gate, "SUMMARY_PATH", summary_path)

    report = gate.validate_sections_snapshot({
        "schemaVersion": 2,
        "contentHash": "abc",
        "fetchedAt": 1767282000000,
        "sectionQuality": {},
        "sections": {
            "topStories": [make_story(1, "topStories", "a")],
        },
    })

    gate.write_json(report_path, report)
    gate.write_summary(report)

    assert report_path.exists()
    assert summary_path.exists()
    assert "Sections Prefetch Quality Report" in summary_path.read_text()
`);

patchFile('scripts/verify_pages_newsdata.mjs', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `function summarizeInsightSnapshot(snapshot) {
  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    collectorVersion: snapshot?.collectorVersion || '',
    contentHash: snapshot?.contentHash || '',
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    storyCount: Array.isArray(snapshot?.stories) ? snapshot.stories.length : 0,
    sourceGroupCount: Number(snapshot?.sourceDiversity?.sourceGroupCount || 0),
    hasSlotQuality: Boolean(snapshot?.slotQuality),
    hasAngleHints: Array.isArray(snapshot?.stories) &&
      snapshot.stories.some(story => Array.isArray(story?.angleHints) && story.angleHints.length > 0),
  };
}

`,
    `function summarizeSectionsSnapshot(snapshot) {
  const sections = snapshot?.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};

  const sectionCounts = Object.fromEntries(
    Object.entries(sections).map(([section, stories]) => [
      section,
      Array.isArray(stories) ? stories.length : 0,
    ])
  );

  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    contentHash: snapshot?.contentHash || '',
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    sectionCount: Object.keys(sections).length,
    storyCount: Object.values(sectionCounts).reduce((sum, count) => sum + count, 0),
    sectionCounts,
    hasSectionQuality: Boolean(snapshot?.sectionQuality),
  };
}

`,
    'sections summary helper'
  );

  text = replaceOnce(
    text,
    `  const expectedRaw = readJson(args.expectedPath, null);`,
    `  const expectedRaw = readJson(args.expectedPath, null);
  const expectedSectionsRaw = readJson('public/newsdata/sections_latest.json', null);`,
    'read expected sections'
  );

  text = replaceOnce(
    text,
    `  const expected = summarizeInsightSnapshot(expectedRaw);
  const errors = [];
  let deployed = null;
  let attempts = 0;`,
    `  const expected = summarizeInsightSnapshot(expectedRaw);
  const expectedSections = expectedSectionsRaw ? summarizeSectionsSnapshot(expectedSectionsRaw) : null;
  const errors = [];
  let deployed = null;
  let deployedSections = null;
  let attempts = 0;`,
    'expected sections summary'
  );

  text = replaceOnce(
    text,
    `  const url = \`\${baseUrl}/newsdata/insight_latest.json?verify=\${Date.now()}\`;`,
    `  const url = \`\${baseUrl}/newsdata/insight_latest.json?verify=\${Date.now()}\`;
  const sectionsUrl = \`\${baseUrl}/newsdata/sections_latest.json?verify=\${Date.now()}\`;`,
    'sections url'
  );

  text = replaceOnce(
    text,
    `      const deployedRaw = await fetchJson(url);
      deployed = summarizeInsightSnapshot(deployedRaw);

      if (
        deployed.schemaVersion === expected.schemaVersion &&
        deployed.contentHash === expected.contentHash &&
        deployed.storyCount === expected.storyCount
      ) {
        break;
      }

      errors.push(
        \`Attempt \${attempt}: deployed data not synced yet: expected \${expected.contentHash}/\${expected.storyCount}, got \${deployed.contentHash}/\${deployed.storyCount}\`
      );`,
    `      const deployedRaw = await fetchJson(url);
      const deployedSectionsRaw = expectedSections ? await fetchJson(sectionsUrl) : null;

      deployed = summarizeInsightSnapshot(deployedRaw);
      deployedSections = deployedSectionsRaw ? summarizeSectionsSnapshot(deployedSectionsRaw) : null;

      const insightOk =
        deployed.schemaVersion === expected.schemaVersion &&
        deployed.contentHash === expected.contentHash &&
        deployed.storyCount === expected.storyCount;

      const sectionsOk = !expectedSections || (
        deployedSections &&
        deployedSections.schemaVersion === expectedSections.schemaVersion &&
        deployedSections.contentHash === expectedSections.contentHash &&
        deployedSections.storyCount === expectedSections.storyCount
      );

      if (insightOk && sectionsOk) {
        break;
      }

      errors.push(
        \`Attempt \${attempt}: deployed data not synced yet: insight expected \${expected.contentHash}/\${expected.storyCount}, got \${deployed.contentHash}/\${deployed.storyCount}; sections expected \${expectedSections?.contentHash || 'n/a'}/\${expectedSections?.storyCount || 0}, got \${deployedSections?.contentHash || 'n/a'}/\${deployedSections?.storyCount || 0}\`
      );`,
    'fetch and compare sections'
  );

  text = replaceOnce(
    text,
    `  const pass = Boolean(
    deployed &&
    deployed.schemaVersion === expected.schemaVersion &&
    deployed.contentHash === expected.contentHash &&
    deployed.storyCount === expected.storyCount
  );`,
    `  const insightPass = Boolean(
    deployed &&
    deployed.schemaVersion === expected.schemaVersion &&
    deployed.contentHash === expected.contentHash &&
    deployed.storyCount === expected.storyCount
  );

  const sectionsPass = Boolean(
    !expectedSections ||
    (
      deployedSections &&
      deployedSections.schemaVersion === expectedSections.schemaVersion &&
      deployedSections.contentHash === expectedSections.contentHash &&
      deployedSections.storyCount === expectedSections.storyCount
    )
  );

  const pass = insightPass && sectionsPass;`,
    'pass includes sections'
  );

  text = replaceOnce(
    text,
    `    expected,
    deployed,
    attempts,`,
    `    expected,
    expectedSections,
    deployed,
    deployedSections,
    attempts,`,
    'report sections objects'
  );

  text = replaceOnce(
    text,
    `    expectedContentHash: expected.contentHash,
    deployedContentHash: deployed?.contentHash || '',
    expectedStoryCount: expected.storyCount,
    deployedStoryCount: deployed?.storyCount || 0,`,
    `    expectedContentHash: expected.contentHash,
    deployedContentHash: deployed?.contentHash || '',
    expectedStoryCount: expected.storyCount,
    deployedStoryCount: deployed?.storyCount || 0,
    expectedSectionsContentHash: expectedSections?.contentHash || '',
    deployedSectionsContentHash: deployedSections?.contentHash || '',
    expectedSectionsStoryCount: expectedSections?.storyCount || 0,
    deployedSectionsStoryCount: deployedSections?.storyCount || 0,`,
    'console sections fields'
  );

  return text;
});

write('scripts/test_sections_quality_and_deploy_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const validator = read('scripts/validate_sections_prefetch_output.py');
const validatorTest = read('scripts/test_validate_sections_prefetch_output.py');
const verifier = read('scripts/verify_pages_newsdata.mjs');
const workflow = read('.github/workflows/news_prefetch.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'SECTIONS_PATH',
  'sections_quality_report.json',
  'sections_quality_summary.md',
  'validate_sections_snapshot',
  'build_section_health',
  'Sections Prefetch Quality Report',
  'sectionHealth'
]) {
  assert(validator.includes(token), \`validate_sections_prefetch_output.py missing token: \${token}\`);
}

for (const token of [
  'test_validate_sections_snapshot_warns_not_fails_for_thin_pool',
  'test_validate_sections_snapshot_fails_structural_errors',
  'test_validate_sections_snapshot_passes_healthy_shape',
  'test_write_summary_creates_markdown'
]) {
  assert(validatorTest.includes(token), \`test_validate_sections_prefetch_output.py missing token: \${token}\`);
}

for (const token of [
  'Validate Sections prefetch quality',
  'python scripts/validate_sections_prefetch_output.py',
  'Upload Sections quality report',
  'sections-quality-report'
]) {
  assert(workflow.includes(token), \`news_prefetch.yml missing sections quality workflow token: \${token}\`);
}

for (const token of [
  'summarizeSectionsSnapshot',
  'sections_latest.json',
  'expectedSections',
  'deployedSections',
  'sectionsPass',
  'expectedSectionsContentHash',
  'deployedSectionsContentHash'
]) {
  assert(verifier.includes(token), \`verify_pages_newsdata.mjs missing sections verification token: \${token}\`);
}

assert(
  packageJson.includes('"test:sections-quality-deploy"'),
  'package.json must include test:sections-quality-deploy'
);

assert(
  certGate.includes("['npm', ['run', 'test:sections-quality-deploy']]"),
  'certification gate must run test:sections-quality-deploy'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Sections quality and deployed verification slice',
  guarantees: [
    'sections prefetch quality validator exists',
    'sections quality JSON and Markdown reports are generated',
    'workflow validates sections_latest after fetch',
    'workflow uploads sections quality report artifact',
    'deployed Pages verifier compares sections_latest contentHash/storyCount',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Sections quality and deploy verification static slice');
`);

patchFile('.github/workflows/news_prefetch.yml', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `      - name: Fetch Sections stories
        run: python scripts/fetch_sections_stories.py
`,
    `
      - name: Validate Sections prefetch quality
        run: python scripts/validate_sections_prefetch_output.py

      - name: Upload Sections quality report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: sections-quality-report
          path: |
            public/newsdata/sections_quality_report.json
            public/newsdata/sections_quality_summary.md
          if-no-files-found: warn
`,
    'workflow sections quality gate'
  );

  return text;
});

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:sections-quality-deploy'] = 'node scripts/test_sections_quality_and_deploy_static.mjs && python -m pytest scripts/test_validate_sections_prefetch_output.py';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:sections-quality-deploy']]")) return source;

  if (source.includes("['npm', ['run', 'test:sections-browser-ingestion']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:sections-browser-ingestion']],",
      "  ['npm', ['run', 'test:sections-browser-ingestion']],\n  ['npm', ['run', 'test:sections-quality-deploy']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:sections-quality-deploy']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 52 Sections quality and deployed verification patch complete.');
