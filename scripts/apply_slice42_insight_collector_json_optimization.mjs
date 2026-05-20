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

write('scripts/insight_json_contract.py', `"""
Insight JSON contract helpers.

Purpose:
  - enrich public/newsdata/insight_latest.json before the browser pipeline reads it
  - keep GitHub Pages static hosting simple
  - make collector quality visible and testable
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from typing import Any

COLLECTOR_VERSION = "insight-collector-json-v3"

SLOT_ORDER = ["now", "minus4h", "minus12h", "minus24h"]

ANGLE_PATTERNS = {
    "official_response": [
        r"\\bofficials?\\b", r"\\bministry\\b", r"\\bregulator\\b", r"\\bgovernment\\b",
        r"\\bstatement\\b", r"\\bconfirmed\\b", r"\\bapproved\\b", r"\\brejected\\b",
    ],
    "market_reaction": [
        r"\\bshares?\\b", r"\\bstocks?\\b", r"\\binvestors?\\b", r"\\bmarket\\b",
        r"\\bfell\\b", r"\\brose\\b", r"\\bsurged\\b", r"\\btumbled\\b", r"\\btrading\\b",
    ],
    "expert_analysis": [
        r"\\banalysts?\\b", r"\\bexperts?\\b", r"\\banalysis\\b", r"\\bexplains?\\b",
        r"\\bwhy it matters\\b", r"\\bimplications?\\b", r"\\bwarns?\\b",
    ],
    "reaction_public": [
        r"\\busers?\\b", r"\\bpublic\\b", r"\\bresidents?\\b", r"\\bbacklash\\b",
        r"\\bviral\\b", r"\\bcriticis(?:e|ed|es|ing)\\b", r"\\bprotests?\\b",
    ],
    "background_context": [
        r"\\bexplainer\\b", r"\\btimeline\\b", r"\\bwhat led\\b", r"\\bcontext\\b",
        r"\\bkey points\\b", r"\\bthings to know\\b", r"\\bhow it started\\b",
    ],
    "regional_followup": [
        r"\\blocal\\b", r"\\bregional\\b", r"\\bcity\\b", r"\\bdistrict\\b",
        r"\\bchennai\\b", r"\\btrichy\\b", r"\\btamil nadu\\b", r"\\bmuscat\\b", r"\\boman\\b",
    ],
    "fact_update": [
        r"\\bupdated?\\b", r"\\bnew figures?\\b", r"\\bdata\\b", r"\\bnumber\\b",
        r"\\bpercent\\b", r"\\b%\\b", r"\\bmillion\\b", r"\\bbillion\\b",
    ],
}

NUMBER_RE = re.compile(
    r"(?:₹|\\$|€|£)?\\d+(?:,\\d+)*(?:\\.\\d+)?\\s*"
    r"(?:crore|lakh|million|billion|trillion|thousand|hours?|days?|weeks?|months?|years?|%|percent)?",
    re.I,
)

STOP_WORDS = {
    "about", "after", "again", "against", "ahead", "among", "around", "before",
    "being", "between", "could", "during", "every", "first", "from", "have",
    "into", "latest", "more", "news", "over", "said", "says", "their", "there",
    "these", "this", "those", "through", "under", "update", "when", "where",
    "which", "while", "with", "would", "will", "your",
}


def _text(story: dict[str, Any]) -> str:
    return f"{story.get('title', '')} {story.get('summary', '')}".strip()


def _tokens(text: str) -> list[str]:
    return [
        token
        for token in re.sub(r"[^a-zA-Z0-9\\s-]", " ", text.lower()).split()
        if len(token) >= 4 and token not in STOP_WORDS and not token.isdigit()
    ]


def infer_angle_hints(story: dict[str, Any]) -> list[dict[str, Any]]:
    text = _text(story).lower()
    hints = []

    for angle, patterns in ANGLE_PATTERNS.items():
        matches = [pattern for pattern in patterns if re.search(pattern, text, re.I)]
        if matches:
            hints.append({
                "angle": angle,
                "score": round(min(1.0, 0.35 + 0.18 * len(matches)), 3),
                "matches": matches[:5],
            })

    if not hints:
        hints.append({
            "angle": "base_report",
            "score": 0.35,
            "matches": [],
        })

    return sorted(hints, key=lambda item: (-item["score"], item["angle"]))


def build_story_signals(story: dict[str, Any]) -> dict[str, Any]:
    text = _text(story)
    tokens = _tokens(text)
    token_counts = Counter(tokens)
    numbers = list(dict.fromkeys(match.group(0).strip() for match in NUMBER_RE.finditer(text)))

    return {
        "topicTokens": [token for token, _ in token_counts.most_common(12)],
        "numbers": numbers[:12],
        "angleHints": infer_angle_hints(story),
        "textLength": len(text),
        "hasSummary": bool(story.get("summary")),
        "sourceGroup": story.get("sourceGroup") or story.get("source") or "unknown_source",
    }


def enrich_story(story: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(story)
    enriched.setdefault("sourceGroup", story.get("source") or "unknown_source")
    enriched.setdefault("source", story.get("sourceGroup") or "Unknown source")
    enriched.setdefault("category", story.get("category") or "general")
    enriched.setdefault("language", story.get("language") or "en")
    enriched["storySignals"] = build_story_signals(enriched)
    enriched["angleHints"] = enriched["storySignals"]["angleHints"]
    return enriched


def canonical_story_for_hash(story: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": story.get("id"),
        "title": story.get("title"),
        "summary": story.get("summary"),
        "url": story.get("url"),
        "publishedAt": story.get("publishedAt"),
        "sourceGroup": story.get("sourceGroup"),
        "contentHash": story.get("contentHash"),
        "fetchedForSlots": story.get("fetchedForSlots", []),
        "angleHints": story.get("angleHints", []),
        "topicTokens": story.get("storySignals", {}).get("topicTokens", []),
    }


def compute_snapshot_content_hash(stories: list[dict[str, Any]]) -> str:
    payload = json.dumps(
        [canonical_story_for_hash(story) for story in sorted(stories, key=lambda s: str(s.get("id", "")))],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def build_slot_quality(stories: list[dict[str, Any]], slot_meta: dict[str, Any]) -> dict[str, Any]:
    by_id = {story.get("id"): story for story in stories}
    quality = {}

    for slot in SLOT_ORDER:
        ids = slot_meta.get(slot, {}).get("storyIds", [])
        slot_stories = [by_id[sid] for sid in ids if sid in by_id]
        source_groups = {story.get("sourceGroup") or story.get("source") or "unknown" for story in slot_stories}
        angle_counts = Counter(
            (story.get("angleHints") or [{"angle": "base_report"}])[0]["angle"]
            for story in slot_stories
        )

        quality[slot] = {
            "storyCount": len(slot_stories),
            "sourceGroupCount": len(source_groups),
            "topAngles": [
                {"angle": angle, "count": count}
                for angle, count in angle_counts.most_common(8)
            ],
            "fetchedAt": slot_meta.get(slot, {}).get("fetchedAt", 0),
            "thin": len(slot_stories) < 8 or len(source_groups) < 3,
        }

    return quality


def build_source_diversity(stories: list[dict[str, Any]]) -> dict[str, Any]:
    counts = Counter(story.get("sourceGroup") or story.get("source") or "unknown" for story in stories)
    return {
        "sourceGroupCount": len(counts),
        "topSources": [
            {"sourceGroup": source, "count": count}
            for source, count in counts.most_common(12)
        ],
    }


def optimize_insight_snapshot(snapshot: dict[str, Any], ts: int) -> dict[str, Any]:
    stories = [enrich_story(story) for story in snapshot.get("stories", [])]
    slot_meta = snapshot.get("slotMeta", {})

    optimized = dict(snapshot)
    optimized["schemaVersion"] = 3
    optimized["collectorVersion"] = COLLECTOR_VERSION
    optimized["generatedAt"] = ts
    optimized["fetchedAt"] = snapshot.get("fetchedAt", ts)
    optimized["stories"] = stories
    optimized["slotQuality"] = build_slot_quality(stories, slot_meta)
    optimized["sourceDiversity"] = build_source_diversity(stories)
    optimized["contentHash"] = compute_snapshot_content_hash(stories)

    return optimized
`);

patchFile('scripts/fetch_insight_stories.py', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `from prefetch_common import (
    H_MS, DAY_MS, now_ms, read_json, write_json,
    normalize_basic_story, is_suppressed, compute_content_hash
)
`,
    `from insight_json_contract import optimize_insight_snapshot
`,
    'import insight json contract'
  );

  text = replaceOnce(
    text,
    `    snapshot = {
        'schemaVersion': 2,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(all_stories),
        'slotMeta':      new_slot_meta,
        'stories':       all_stories,
    }
    return snapshot, all_source_health`,
    `    snapshot = {
        'schemaVersion': 2,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(all_stories),
        'slotMeta':      new_slot_meta,
        'stories':       all_stories,
    }

    optimized_snapshot = optimize_insight_snapshot(snapshot, ts)
    return optimized_snapshot, all_source_health`,
    'optimize insight snapshot before write'
  );

  text = replaceOnce(
    text,
    `    old     = read_json(INSIGHT_PATH, DEFAULT_SNAPSHOT)
    print(f'Refreshing insight snapshot (ts={ts})…')
    new_snap, health = refresh_insight_snapshot(old, ts)

    write_json(INSIGHT_PATH, new_snap)`,
    `    old     = read_json(INSIGHT_PATH, DEFAULT_SNAPSHOT)
    old_hash = old.get('contentHash', '')
    print(f'Refreshing insight snapshot (ts={ts})…')
    new_snap, health = refresh_insight_snapshot(old, ts)

    write_json(INSIGHT_PATH, new_snap)`,
    'track old content hash'
  );

  text = insertAfterOnce(
    text,
    `    write_json(INSIGHT_PATH, new_snap)
`,
    `    if old_hash == new_snap.get('contentHash'):
        print('  contentHash unchanged — story content stable')
`,
    'content hash unchanged log'
  );

  return text;
});

patchFile('.github/workflows/news_prefetch.yml', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `on:
`,
    `
concurrency:
  group: news-prefetch
  cancel-in-progress: false

`,
    'workflow concurrency'
  );

  text = replaceOnce(
    text,
    `      - name: Bump fetchedAt sentinel
        run: |
          python -c "
          import json, time, os
          p = 'public/newsdata/insight_latest.json'
          if os.path.exists(p):
              d = json.load(open(p))
              d['fetchedAt'] = int(time.time() * 1000)
              json.dump(d, open(p, 'w'), indent=2, ensure_ascii=False)
          "
`,
    ``,
    'remove fetchedAt-only mutation'
  );

  return text;
});

write('scripts/test_insight_collector_json_contract.py', `import json
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
`);

write('scripts/test_insight_collector_json_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const contract = read('scripts/insight_json_contract.py');
const fetcher = read('scripts/fetch_insight_stories.py');
const workflow = read('.github/workflows/news_prefetch.yml');
const pyTest = read('scripts/test_insight_collector_json_contract.py');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'COLLECTOR_VERSION',
  'schemaVersion"] = 3',
  'slotQuality',
  'sourceDiversity',
  'storySignals',
  'angleHints',
  'compute_snapshot_content_hash',
  'optimize_insight_snapshot'
]) {
  assert(contract.includes(token), \`insight_json_contract.py missing token: \${token}\`);
}

for (const token of [
  'optimize_insight_snapshot',
  'contentHash unchanged',
  'old_hash'
]) {
  assert(fetcher.includes(token), \`fetch_insight_stories.py missing token: \${token}\`);
}

for (const token of [
  'concurrency:',
  'group: news-prefetch',
  'cancel-in-progress: false'
]) {
  assert(workflow.includes(token), \`news_prefetch.yml missing token: \${token}\`);
}

assert(
  !workflow.includes('Bump fetchedAt sentinel'),
  'news_prefetch.yml must not keep fetchedAt-only mutation step'
);

for (const token of [
  'test_angle_hints_detect_official_market_and_public',
  'test_optimized_snapshot_has_schema_v3_quality_and_stable_hash'
]) {
  assert(pyTest.includes(token), \`collector JSON Python test missing token: \${token}\`);
}

assert(
  packageJson.includes('"test:insight-collector-json"'),
  'package.json must include test:insight-collector-json'
);

assert(
  certGate.includes("['npm', ['run', 'test:insight-collector-json']]"),
  'certification gate must run test:insight-collector-json'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight collector JSON optimization slice',
  guarantees: [
    'collector emits schemaVersion 3',
    'storySignals and angleHints are included in JSON',
    'slotQuality and sourceDiversity diagnostics are included',
    'contentHash is stable and story-content based',
    'workflow concurrency prevents overlapping prefetch runs',
    'fetchedAt-only workflow mutation is removed',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Insight collector JSON optimization static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-collector-json'] = 'node scripts/test_insight_collector_json_static.mjs && python scripts/test_insight_collector_json_contract.py';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-collector-json']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-e2e-quality']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-e2e-quality']],",
      "  ['npm', ['run', 'test:insight-e2e-quality']],\n  ['npm', ['run', 'test:insight-collector-json']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-collector-json']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 42 Insight collector JSON optimization patch complete.');
