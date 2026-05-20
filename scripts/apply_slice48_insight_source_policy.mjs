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

function replaceFeedBlock(source) {
  const startMarker = '# ── Tier A/B RSS feeds per slot';
  const endMarker = 'DEFAULT_SNAPSHOT = {';

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  if (start < 0 || end < 0) {
    if (source.includes('SLOT_FEEDS = get_slot_feeds_map()')) return source;
    throw new Error('Could not locate SLOT_FEEDS block');
  }

  const replacement = `# ── Source policy / feed registry ─────────────────────────────────────────────
# Feed list is loaded from config/insight_sources.json so source mix can be tuned
# without changing scraper logic.
SLOT_FEEDS = get_slot_feeds_map()

`;

  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

write('config/insight_sources.json', JSON.stringify({
  schemaVersion: 1,
  policyVersion: 'insight-source-policy-v1',
  slots: {
    now: [
      {
        url: 'https://www.thehindu.com/news/national/feeder/default.rss',
        source: 'The Hindu',
        sourceGroup: 'the_hindu',
        tier: 'A',
        topic: 'national'
      },
      {
        url: 'https://economictimes.indiatimes.com/rssfeeds/1977021501.cms',
        source: 'Economic Times',
        sourceGroup: 'economic_times',
        tier: 'A',
        topic: 'business'
      },
      {
        url: 'https://feeds.feedburner.com/ndtvnews-top-stories',
        source: 'NDTV',
        sourceGroup: 'ndtv',
        tier: 'B',
        topic: 'top'
      },
      {
        url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',
        source: 'Hindustan Times',
        sourceGroup: 'hindustan_times',
        tier: 'B',
        topic: 'national'
      },
      {
        url: 'https://news.google.com/rss/search?q=India+breaking+news&hl=en-IN&gl=IN&ceid=IN:en',
        source: 'Google News',
        sourceGroup: 'google_news',
        tier: 'B',
        topic: 'breaking'
      }
    ],
    minus4h: [
      {
        url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
        source: 'Times of India',
        sourceGroup: 'times_of_india',
        tier: 'B',
        topic: 'national'
      },
      {
        url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',
        source: 'Hindustan Times',
        sourceGroup: 'hindustan_times',
        tier: 'B',
        topic: 'national'
      },
      {
        url: 'https://feeds.feedburner.com/ndtvnews-india-news',
        source: 'NDTV India',
        sourceGroup: 'ndtv',
        tier: 'B',
        topic: 'india'
      },
      {
        url: 'https://www.thehindu.com/news/national/feeder/default.rss',
        source: 'The Hindu',
        sourceGroup: 'the_hindu',
        tier: 'A',
        topic: 'national'
      }
    ],
    minus12h: [
      {
        url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
        source: 'BBC World',
        sourceGroup: 'bbc',
        tier: 'A',
        topic: 'world'
      },
      {
        url: 'https://feeds.bbci.co.uk/news/india/rss.xml',
        source: 'BBC India',
        sourceGroup: 'bbc',
        tier: 'A',
        topic: 'india'
      },
      {
        url: 'https://www.thehindu.com/news/international/feeder/default.rss',
        source: 'The Hindu Intl',
        sourceGroup: 'the_hindu',
        tier: 'A',
        topic: 'international'
      },
      {
        url: 'https://rss.app/feeds/v1.1/_Bg5JB2jvVd0zOhwA.json',
        source: 'Reuters India',
        sourceGroup: 'reuters',
        tier: 'A',
        topic: 'india'
      }
    ],
    minus24h: [
      {
        url: 'https://economictimes.indiatimes.com/rssfeeds/1368519714.cms',
        source: 'ET Markets',
        sourceGroup: 'economic_times',
        tier: 'A',
        topic: 'markets'
      },
      {
        url: 'https://www.moneycontrol.com/rss/latestnews.xml',
        source: 'Moneycontrol',
        sourceGroup: 'moneycontrol',
        tier: 'B',
        topic: 'markets'
      },
      {
        url: 'https://www.thehindubusinessline.com/news/feeder/default.rss',
        source: 'Business Line',
        sourceGroup: 'business_line',
        tier: 'A',
        topic: 'business'
      },
      {
        url: 'https://www.financialexpress.com/feed/',
        source: 'Financial Express',
        sourceGroup: 'financial_express',
        tier: 'A',
        topic: 'business'
      }
    ]
  },
  requiredCoverage: {
    minFeedsPerSlot: 3,
    minTierAFeeds: 6,
    minSourceGroups: 8,
    minTopics: 5
  }
}, null, 2) + '\n');

write('scripts/insight_source_policy.py', `"""
Insight source policy helpers.

This externalizes the RSS registry from fetch_insight_stories.py and writes a
diagnostic report so weak source diversity can be debugged without reading logs.
"""
from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path
from typing import Any

SLOTS = ["now", "minus4h", "minus12h", "minus24h"]
SOURCE_POLICY_PATH = Path("config/insight_sources.json")
SOURCE_POLICY_REPORT_PATH = Path("public/newsdata/source_policy_report.json")

DEFAULT_REQUIRED_COVERAGE = {
    "minFeedsPerSlot": 3,
    "minTierAFeeds": 6,
    "minSourceGroups": 8,
    "minTopics": 5,
}


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")


def normalize_source_group(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in str(value or "unknown_source"))
    cleaned = "_".join(part for part in cleaned.split("_") if part)
    return cleaned or "unknown_source"


def normalize_feed(feed: dict[str, Any]) -> dict[str, Any]:
    url = str(feed.get("url", "")).strip()
    source = str(feed.get("source", "")).strip()
    source_group = normalize_source_group(feed.get("sourceGroup") or source)
    tier = str(feed.get("tier", "C")).strip().upper()
    topic = str(feed.get("topic", "general")).strip().lower() or "general"

    return {
        "url": url,
        "source": source or source_group,
        "sourceGroup": source_group,
        "tier": tier if tier in {"A", "B", "C"} else "C",
        "topic": topic,
    }


def load_source_policy(path: Path = SOURCE_POLICY_PATH) -> dict[str, Any]:
    policy = read_json(path, {})
    slots = policy.get("slots", {}) if isinstance(policy, dict) else {}

    normalized_slots = {}

    for slot in SLOTS:
        feeds = slots.get(slot, [])
        normalized_slots[slot] = [
            normalize_feed(feed)
            for feed in feeds
            if isinstance(feed, dict) and str(feed.get("url", "")).strip()
        ]

    return {
        "schemaVersion": int(policy.get("schemaVersion", 1) or 1),
        "policyVersion": policy.get("policyVersion", "insight-source-policy-v1"),
        "slots": normalized_slots,
        "requiredCoverage": {
            **DEFAULT_REQUIRED_COVERAGE,
            **(policy.get("requiredCoverage", {}) if isinstance(policy, dict) else {}),
        },
    }


def validate_source_policy(policy: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    slots = policy.get("slots", {})
    required = policy.get("requiredCoverage", DEFAULT_REQUIRED_COVERAGE)

    all_feeds = [feed for slot in SLOTS for feed in slots.get(slot, [])]
    source_groups = {feed["sourceGroup"] for feed in all_feeds}
    tier_a_count = sum(1 for feed in all_feeds if feed.get("tier") == "A")
    topics = {feed.get("topic", "general") for feed in all_feeds}

    for slot in SLOTS:
        count = len(slots.get(slot, []))
        if count == 0:
            errors.append(f"Slot {slot} has no feeds")
        elif count < int(required.get("minFeedsPerSlot", 3)):
            warnings.append(f"Slot {slot} has only {count} feeds")

    if tier_a_count < int(required.get("minTierAFeeds", 6)):
        warnings.append(f"Tier-A feed count is weak: {tier_a_count}")

    if len(source_groups) < int(required.get("minSourceGroups", 8)):
        warnings.append(f"Source-group diversity is weak: {len(source_groups)}")

    if len(topics) < int(required.get("minTopics", 5)):
        warnings.append(f"Topic coverage is weak: {len(topics)}")

    return {
        "status": "FAIL" if errors else "WARN" if warnings else "PASS",
        "errors": errors,
        "warnings": warnings,
        "feedCount": len(all_feeds),
        "sourceGroupCount": len(source_groups),
        "tierACount": tier_a_count,
        "topicCount": len(topics),
    }


def get_slot_feeds_map(path: Path = SOURCE_POLICY_PATH) -> dict[str, list[tuple[str, str, str]]]:
    policy = load_source_policy(path)
    validation = validate_source_policy(policy)

    if validation["errors"]:
        raise RuntimeError("Invalid Insight source policy: " + "; ".join(validation["errors"]))

    return {
        slot: [
            (feed["url"], feed["source"], feed["sourceGroup"])
            for feed in policy["slots"].get(slot, [])
        ]
        for slot in SLOTS
    }


def build_source_policy_report(
    slot_feeds: dict[str, list[tuple[str, str, str]]],
    source_health: dict[str, Any] | None = None,
    path: Path = SOURCE_POLICY_PATH,
) -> dict[str, Any]:
    policy = load_source_policy(path)
    validation = validate_source_policy(policy)
    source_health = source_health or {}

    feeds_by_group = {}
    for slot in SLOTS:
        for feed in policy["slots"].get(slot, []):
            group = feed["sourceGroup"]
            feeds_by_group.setdefault(group, {
                "sourceGroup": group,
                "source": feed["source"],
                "tier": feed["tier"],
                "topics": set(),
                "slots": set(),
                "configuredFeeds": 0,
                "health": {},
            })
            feeds_by_group[group]["topics"].add(feed["topic"])
            feeds_by_group[group]["slots"].add(slot)
            feeds_by_group[group]["configuredFeeds"] += 1

    for group, health in source_health.items():
        normalized_group = normalize_source_group(group)
        feeds_by_group.setdefault(normalized_group, {
            "sourceGroup": normalized_group,
            "source": normalized_group,
            "tier": "C",
            "topics": set(),
            "slots": set(),
            "configuredFeeds": 0,
            "health": {},
        })
        feeds_by_group[normalized_group]["health"] = health

    slot_summary = {}
    for slot in SLOTS:
        feeds = policy["slots"].get(slot, [])
        tier_counts = Counter(feed["tier"] for feed in feeds)
        topic_counts = Counter(feed["topic"] for feed in feeds)
        slot_summary[slot] = {
            "feedCount": len(feeds),
            "sourceGroups": sorted({feed["sourceGroup"] for feed in feeds}),
            "tierCounts": dict(tier_counts),
            "topicCounts": dict(topic_counts),
        }

    sources = []
    for value in feeds_by_group.values():
        sources.append({
            **value,
            "topics": sorted(value["topics"]),
            "slots": sorted(value["slots"]),
        })

    sources.sort(key=lambda item: (item["tier"], item["sourceGroup"]))

    return {
        "schemaVersion": 1,
        "reportVersion": "insight-source-policy-report-v1",
        "generatedAt": int(time.time() * 1000),
        "policyVersion": policy.get("policyVersion"),
        "validation": validation,
        "slotSummary": slot_summary,
        "sourceCount": len(sources),
        "sources": sources,
    }


def write_source_policy_report(
    slot_feeds: dict[str, list[tuple[str, str, str]]],
    source_health: dict[str, Any] | None = None,
    report_path: Path = SOURCE_POLICY_REPORT_PATH,
) -> dict[str, Any]:
    report = build_source_policy_report(slot_feeds, source_health)
    write_json(report_path, report)
    return report
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
    `from insight_source_policy import get_slot_feeds_map, write_source_policy_report
`,
    'source policy import'
  );

  text = insertAfterOnce(
    text,
    `SOURCE_HEALTH_PATH = 'public/newsdata/source_health.json'
`,
    `SOURCE_POLICY_REPORT_PATH = 'public/newsdata/source_policy_report.json'
`,
    'source policy report path'
  );

  text = replaceFeedBlock(text);

  text = insertAfterOnce(
    text,
    `    update_source_health(health)
`,
    `    write_source_policy_report(SLOT_FEEDS, health)
`,
    'write source policy report'
  );

  return text;
});

write('scripts/test_insight_source_policy.py', `from pathlib import Path
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
`);

write('scripts/test_insight_source_policy_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const config = read('config/insight_sources.json');
const policy = read('scripts/insight_source_policy.py');
const fetcher = read('scripts/fetch_insight_stories.py');
const pyTest = read('scripts/test_insight_source_policy.py');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  '"policyVersion": "insight-source-policy-v1"',
  '"now"',
  '"minus4h"',
  '"minus12h"',
  '"minus24h"',
  '"tier"',
  '"topic"',
  '"sourceGroup"'
]) {
  assert(config.includes(token), \`insight_sources.json missing token: \${token}\`);
}

for (const token of [
  'load_source_policy',
  'validate_source_policy',
  'get_slot_feeds_map',
  'build_source_policy_report',
  'write_source_policy_report',
  'insight-source-policy-report-v1'
]) {
  assert(policy.includes(token), \`insight_source_policy.py missing token: \${token}\`);
}

for (const token of [
  'get_slot_feeds_map',
  'write_source_policy_report',
  'SOURCE_POLICY_REPORT_PATH',
  'SLOT_FEEDS = get_slot_feeds_map()'
]) {
  assert(fetcher.includes(token), \`fetch_insight_stories.py missing source policy token: \${token}\`);
}

assert(
  !fetcher.includes('https://www.thehindu.com/news/national/feeder/default.rss\',                \'The Hindu\''),
  'fetch_insight_stories.py must not keep old hardcoded SLOT_FEEDS block'
);

for (const token of [
  'test_normalize_feed',
  'test_policy_load_and_validate',
  'test_slot_feed_map_shape',
  'test_source_policy_report'
]) {
  assert(pyTest.includes(token), \`test_insight_source_policy.py missing token: \${token}\`);
}

assert(
  packageJson.includes('"test:insight-source-policy"'),
  'package.json must include test:insight-source-policy'
);

assert(
  certGate.includes("['npm', ['run', 'test:insight-source-policy']]"),
  'certification gate must run test:insight-source-policy'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight source policy slice',
  guarantees: [
    'feed registry is externalized to config/insight_sources.json',
    'source policy validator exists',
    'fetch_insight_stories loads SLOT_FEEDS from policy',
    'source policy report is generated after fetch',
    'source diversity and topic coverage are inspectable',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Insight source policy static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-source-policy'] = 'node scripts/test_insight_source_policy_static.mjs && python scripts/test_insight_source_policy.py';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-source-policy']]")) return source;

  if (source.includes("['npm', ['run', 'test:pages-newsdata-verification']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:pages-newsdata-verification']],",
      "  ['npm', ['run', 'test:pages-newsdata-verification']],\n  ['npm', ['run', 'test:insight-source-policy']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-source-policy']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 48 Insight source policy patch complete.');
