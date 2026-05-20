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

function replaceSectionFeedBlock(source) {
  const startMarker = '# ── Section feeds';
  const endMarker = 'MAX_STORIES_PER_SECTION = 30';

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  if (start < 0 || end < 0) {
    if (source.includes('SECTION_FEEDS = get_section_feeds_map()')) return source;
    throw new Error('Could not locate SECTION_FEEDS block');
  }

  const replacement = `# ── Section source policy / feed registry ─────────────────────────────────────
# Section feeds are loaded from config/section_sources.json so source mix can be
# tuned without changing fetcher code.
SECTION_FEEDS = get_section_feeds_map()

`;

  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

write('config/section_sources.json', JSON.stringify({
  schemaVersion: 1,
  policyVersion: 'section-source-policy-v1',
  sections: {
    topStories: [
      ['https://www.thehindu.com/news/feeder/default.rss', 'The Hindu', 'the_hindu', 'A', 'top'],
      ['https://feeds.feedburner.com/ndtvnews-top-stories', 'NDTV', 'ndtv', 'B', 'top'],
      ['https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', 'Hindustan Times', 'hindustan_times', 'B', 'india'],
      ['https://economictimes.indiatimes.com/rssfeeds/1977021501.cms', 'Economic Times', 'economic_times', 'A', 'business'],
      ['https://news.google.com/rss/headlines/section/topic/TOP_STORIES?hl=en-IN&gl=IN&ceid=IN:en', 'Google News Top', 'google_news', 'B', 'top']
    ],
    india: [
      ['https://www.thehindu.com/news/national/feeder/default.rss', 'The Hindu National', 'the_hindu', 'A', 'india'],
      ['https://feeds.feedburner.com/ndtvnews-india-news', 'NDTV India', 'ndtv', 'B', 'india'],
      ['https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', 'Times of India', 'times_of_india', 'B', 'india'],
      ['https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', 'Hindustan Times India', 'hindustan_times', 'B', 'india']
    ],
    tn: [
      ['https://www.thehindu.com/news/cities/chennai/feeder/default.rss', 'The Hindu Chennai', 'the_hindu', 'A', 'tamil_nadu'],
      ['https://www.dtnext.in/rss', 'DT Next', 'dtnext', 'B', 'tamil_nadu'],
      ['https://news.google.com/rss/search?q=Tamil+Nadu+news+today&hl=en-IN&gl=IN&ceid=IN:en', 'Google News TN', 'google_news', 'B', 'tamil_nadu']
    ],
    trichy: [
      ['https://www.thehindu.com/news/cities/Tiruchirapalli/feeder/default.rss', 'The Hindu Trichy', 'the_hindu', 'A', 'trichy'],
      ['https://news.google.com/rss/search?q=Trichy+Tiruchirappalli+news+today&hl=en-IN&gl=IN&ceid=IN:en', 'Google News Trichy', 'google_news', 'B', 'trichy']
    ],
    world: [
      ['https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC World', 'bbc', 'A', 'world'],
      ['https://feeds.bbci.co.uk/news/rss.xml', 'BBC', 'bbc', 'A', 'world'],
      ['https://www.thehindu.com/news/international/feeder/default.rss', 'The Hindu International', 'the_hindu', 'A', 'international'],
      ['https://news.google.com/rss/headlines/section/topic/WORLD_NEWS?hl=en-IN&gl=IN&ceid=IN:en', 'Google News World', 'google_news', 'B', 'world']
    ],
    business: [
      ['https://economictimes.indiatimes.com/rssfeeds/1977021501.cms', 'Economic Times', 'economic_times', 'A', 'business'],
      ['https://www.moneycontrol.com/rss/latestnews.xml', 'Moneycontrol', 'moneycontrol', 'B', 'markets'],
      ['https://www.thehindubusinessline.com/news/feeder/default.rss', 'Business Line', 'business_line', 'A', 'business'],
      ['https://www.financialexpress.com/feed/', 'Financial Express', 'financial_express', 'A', 'business'],
      ['https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en', 'Google News Business', 'google_news', 'B', 'business']
    ],
    technology: [
      ['https://feeds.feedburner.com/gadgets360-latest', 'Gadgets360', 'gadgets360', 'B', 'technology'],
      ['https://www.thehindu.com/sci-tech/technology/feeder/default.rss', 'The Hindu Tech', 'the_hindu', 'A', 'technology'],
      ['https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en', 'Google News Tech', 'google_news', 'B', 'technology']
    ],
    sports: [
      ['https://sports.ndtv.com/rss/all', 'NDTV Sports', 'ndtv', 'B', 'sports'],
      ['https://www.thehindu.com/sport/feeder/default.rss', 'The Hindu Sport', 'the_hindu', 'A', 'sports'],
      ['https://feeds.bbci.co.uk/sport/rss.xml', 'BBC Sport', 'bbc', 'A', 'sports'],
      ['https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en', 'Google News Sports', 'google_news', 'B', 'sports']
    ],
    entertainment: [
      ['https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml', 'Hindustan Times Entertainment', 'hindustan_times', 'B', 'entertainment'],
      ['https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml', 'Hindustan Times Tamil Cinema', 'hindustan_times', 'B', 'entertainment'],
      ['https://feeds.feedburner.com/ndtvnews-movies', 'NDTV Movies', 'ndtv', 'B', 'entertainment'],
      ['https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-IN&gl=IN&ceid=IN:en', 'Google News Entertainment', 'google_news', 'B', 'entertainment']
    ]
  },
  requiredCoverage: {
    minSections: 9,
    minFeedsPerSection: 2,
    minSourceGroups: 10,
    minTierAFeeds: 8
  }
}, null, 2) + '\n');

write('scripts/section_source_policy.py', `from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path
from typing import Any

SECTION_SOURCE_POLICY_PATH = Path("config/section_sources.json")
SECTION_SOURCE_POLICY_REPORT_PATH = Path("public/newsdata/section_source_policy_report.json")

SECTION_ORDER = [
    "topStories", "india", "tn", "trichy", "world",
    "business", "technology", "sports", "entertainment",
]

DEFAULT_REQUIRED_COVERAGE = {
    "minSections": 9,
    "minFeedsPerSection": 2,
    "minSourceGroups": 10,
    "minTierAFeeds": 8,
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


def normalize_section_feed(feed: Any) -> dict[str, Any]:
    if isinstance(feed, list):
        url, source, source_group, tier, topic = (feed + ["", "", "", "C", "general"])[:5]
        return {
            "url": str(url).strip(),
            "source": str(source).strip() or normalize_source_group(source_group),
            "sourceGroup": normalize_source_group(source_group or source),
            "tier": str(tier or "C").upper() if str(tier or "C").upper() in {"A", "B", "C"} else "C",
            "topic": str(topic or "general").strip().lower() or "general",
        }

    if isinstance(feed, dict):
        return {
            "url": str(feed.get("url", "")).strip(),
            "source": str(feed.get("source", "")).strip(),
            "sourceGroup": normalize_source_group(feed.get("sourceGroup") or feed.get("source")),
            "tier": str(feed.get("tier", "C")).upper() if str(feed.get("tier", "C")).upper() in {"A", "B", "C"} else "C",
            "topic": str(feed.get("topic", "general")).strip().lower() or "general",
        }

    return {
        "url": "",
        "source": "",
        "sourceGroup": "unknown_source",
        "tier": "C",
        "topic": "general",
    }


def load_section_source_policy(path: Path = SECTION_SOURCE_POLICY_PATH) -> dict[str, Any]:
    policy = read_json(path, {})
    sections = policy.get("sections", {}) if isinstance(policy, dict) else {}

    normalized_sections = {}

    for section in SECTION_ORDER:
        feeds = sections.get(section, [])
        normalized_sections[section] = [
            normalize_section_feed(feed)
            for feed in feeds
            if normalize_section_feed(feed)["url"]
        ]

    return {
        "schemaVersion": int(policy.get("schemaVersion", 1) or 1),
        "policyVersion": policy.get("policyVersion", "section-source-policy-v1"),
        "sections": normalized_sections,
        "requiredCoverage": {
            **DEFAULT_REQUIRED_COVERAGE,
            **(policy.get("requiredCoverage", {}) if isinstance(policy, dict) else {}),
        },
    }


def validate_section_source_policy(policy: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    required = policy.get("requiredCoverage", DEFAULT_REQUIRED_COVERAGE)
    sections = policy.get("sections", {})

    missing_sections = [section for section in SECTION_ORDER if section not in sections]
    if missing_sections:
        errors.append(f"Missing sections: {', '.join(missing_sections)}")

    all_feeds = [feed for section in SECTION_ORDER for feed in sections.get(section, [])]
    source_groups = {feed["sourceGroup"] for feed in all_feeds}
    tier_a_count = sum(1 for feed in all_feeds if feed.get("tier") == "A")

    for section in SECTION_ORDER:
        count = len(sections.get(section, []))
        if count == 0:
            errors.append(f"Section {section} has no feeds")
        elif count < int(required.get("minFeedsPerSection", 2)):
            warnings.append(f"Section {section} has only {count} feed(s)")

    if len(source_groups) < int(required.get("minSourceGroups", 10)):
        warnings.append(f"Section source diversity is weak: {len(source_groups)}")

    if tier_a_count < int(required.get("minTierAFeeds", 8)):
        warnings.append(f"Section Tier-A coverage is weak: {tier_a_count}")

    return {
        "status": "FAIL" if errors else "WARN" if warnings else "PASS",
        "errors": errors,
        "warnings": warnings,
        "sectionCount": len(sections),
        "feedCount": len(all_feeds),
        "sourceGroupCount": len(source_groups),
        "tierACount": tier_a_count,
    }


def get_section_feeds_map(path: Path = SECTION_SOURCE_POLICY_PATH) -> dict[str, list[tuple[str, str, str]]]:
    policy = load_section_source_policy(path)
    validation = validate_section_source_policy(policy)

    if validation["errors"]:
        raise RuntimeError("Invalid section source policy: " + "; ".join(validation["errors"]))

    return {
        section: [
            (feed["url"], feed["source"], feed["sourceGroup"])
            for feed in policy["sections"].get(section, [])
        ]
        for section in SECTION_ORDER
    }


def build_section_quality(sections: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    result = {}

    for section in SECTION_ORDER:
        stories = sections.get(section, [])
        source_groups = Counter(story.get("sourceGroup") or story.get("source") or "unknown" for story in stories)
        categories = Counter(story.get("category") or section for story in stories)

        result[section] = {
            "storyCount": len(stories),
            "sourceGroupCount": len(source_groups),
            "topSources": [
                {"sourceGroup": source, "count": count}
                for source, count in source_groups.most_common(8)
            ],
            "topCategories": [
                {"category": category, "count": count}
                for category, count in categories.most_common(8)
            ],
            "thin": len(stories) < 8 or len(source_groups) < 2,
        }

    return result


def build_section_source_policy_report(
    sections: dict[str, list[dict[str, Any]]] | None = None,
    source_health: dict[str, Any] | None = None,
    path: Path = SECTION_SOURCE_POLICY_PATH,
) -> dict[str, Any]:
    policy = load_section_source_policy(path)
    validation = validate_section_source_policy(policy)
    source_health = source_health or {}
    sections = sections or {}

    slot_summary = {}
    for section in SECTION_ORDER:
        feeds = policy["sections"].get(section, [])
        slot_summary[section] = {
            "feedCount": len(feeds),
            "sourceGroups": sorted({feed["sourceGroup"] for feed in feeds}),
            "tierCounts": dict(Counter(feed["tier"] for feed in feeds)),
            "topicCounts": dict(Counter(feed["topic"] for feed in feeds)),
        }

    source_rows = {}
    for section in SECTION_ORDER:
        for feed in policy["sections"].get(section, []):
            row = source_rows.setdefault(feed["sourceGroup"], {
                "sourceGroup": feed["sourceGroup"],
                "source": feed["source"],
                "tier": feed["tier"],
                "topics": set(),
                "sections": set(),
                "configuredFeeds": 0,
                "health": {},
            })
            row["topics"].add(feed["topic"])
            row["sections"].add(section)
            row["configuredFeeds"] += 1

    for group, health in source_health.items():
        normalized = normalize_source_group(group)
        source_rows.setdefault(normalized, {
            "sourceGroup": normalized,
            "source": normalized,
            "tier": "C",
            "topics": set(),
            "sections": set(),
            "configuredFeeds": 0,
            "health": {},
        })
        source_rows[normalized]["health"] = health

    sources = []
    for row in source_rows.values():
        sources.append({
            **row,
            "topics": sorted(row["topics"]),
            "sections": sorted(row["sections"]),
        })

    sources.sort(key=lambda item: (item["tier"], item["sourceGroup"]))

    return {
        "schemaVersion": 1,
        "reportVersion": "section-source-policy-report-v1",
        "generatedAt": int(time.time() * 1000),
        "policyVersion": policy.get("policyVersion"),
        "validation": validation,
        "sectionQuality": build_section_quality(sections),
        "sectionSummary": slot_summary,
        "sourceCount": len(sources),
        "sources": sources,
    }


def write_section_source_policy_report(
    sections: dict[str, list[dict[str, Any]]],
    source_health: dict[str, Any],
    report_path: Path = SECTION_SOURCE_POLICY_REPORT_PATH,
) -> dict[str, Any]:
    report = build_section_source_policy_report(sections, source_health)
    write_json(report_path, report)
    return report
`);

patchFile('scripts/fetch_sections_stories.py', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `from prefetch_common import (
    H_MS, DAY_MS, now_ms, read_json, write_json,
    normalize_basic_story, is_suppressed, compute_content_hash
)
`,
    `from section_source_policy import get_section_feeds_map, build_section_quality, write_section_source_policy_report
`,
    'section source policy import'
  );

  text = insertAfterOnce(
    text,
    `SOURCE_HEALTH_PATH = 'public/newsdata/source_health.json'
`,
    `SECTION_SOURCE_POLICY_REPORT_PATH = 'public/newsdata/section_source_policy_report.json'
`,
    'section source policy report path'
  );

  text = replaceSectionFeedBlock(text);

  text = replaceOnce(
    text,
    `def fetch_section(section: str, feeds: list, ts: int) -> tuple[list, dict]:
    results, source_health = [], {}
    for url, source, source_group in feeds:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:20]:
                pub = entry.get('published_parsed')
                pub_ms = int(time.mktime(pub) * 1000) if pub else ts
                raw = {
                    'title':       entry.get('title', ''),
                    'summary':     entry.get('summary', ''),
                    'url':         entry.get('link', ''),
                    'publishedAt': pub_ms,
                    'category':    section,
                    'region':      'in',
                }
                item = normalize_basic_story(raw, source, source_group)
                if not is_suppressed(item, 'any'):
                    results.append(item)

            source_health[source_group] = {'ok': True, 'items': len(results), 'lastSuccess': ts}
        except Exception as e:
            source_health[source_group] = {'ok': False, 'error': str(e), 'items': 0}

    return results, source_health`,
    `def fetch_section(section: str, feeds: list, ts: int) -> tuple[list, dict]:
    results, source_health = [], {}
    for url, source, source_group in feeds:
        try:
            feed = feedparser.parse(url)
            feed_items = []
            for entry in feed.entries[:20]:
                pub = entry.get('published_parsed')
                pub_ms = int(time.mktime(pub) * 1000) if pub else ts
                raw = {
                    'title':       entry.get('title', ''),
                    'summary':     entry.get('summary', ''),
                    'url':         entry.get('link', ''),
                    'publishedAt': pub_ms,
                    'category':    section,
                    'region':      'in',
                }
                item = normalize_basic_story(raw, source, source_group)
                if not is_suppressed(item, 'any'):
                    feed_items.append(item)

            results.extend(feed_items)
            source_health[source_group] = {
                'ok': True,
                'items': len(feed_items),
                'lastSuccess': ts,
                'section': section,
            }
        except Exception as e:
            source_health[source_group] = {
                'ok': False,
                'error': str(e),
                'items': 0,
                'section': section,
            }

    return results, source_health`,
    'accurate per-feed section health'
  );

  text = replaceOnce(
    text,
    `    snapshot = {
        'schemaVersion': 1,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(all_stories_flat),
        'sections':      new_sections,
    }`,
    `    section_quality = build_section_quality(new_sections)

    snapshot = {
        'schemaVersion': 2,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(all_stories_flat),
        'sectionQuality': section_quality,
        'sections':      new_sections,
    }`,
    'section quality in snapshot'
  );

  text = insertAfterOnce(
    text,
    `    write_json(SOURCE_HEALTH_PATH, existing_health)
`,
    `    write_section_source_policy_report(new_sections, all_health)
`,
    'write section source policy report'
  );

  return text;
});

write('scripts/test_section_source_policy.py', `from section_source_policy import (
    build_section_quality,
    build_section_source_policy_report,
    get_section_feeds_map,
    load_section_source_policy,
    normalize_section_feed,
    validate_section_source_policy,
)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def test_normalize_section_feed_list_shape():
    feed = normalize_section_feed([
        "https://example.com/rss",
        "Example News",
        "Example News",
        "A",
        "Markets",
    ])

    assert_true(feed["sourceGroup"] == "example_news", "source group should normalize")
    assert_true(feed["tier"] == "A", "tier should preserve A")
    assert_true(feed["topic"] == "markets", "topic should lowercase")


def test_section_policy_load_and_validate():
    policy = load_section_source_policy()
    validation = validate_section_source_policy(policy)

    assert_true(validation["status"] in {"PASS", "WARN"}, "policy should not fail")
    assert_true(validation["sectionCount"] >= 9, "all sections required")
    assert_true(validation["feedCount"] >= 25, "feed count should be healthy")


def test_section_feeds_map_shape():
    feeds = get_section_feeds_map()

    assert_true("topStories" in feeds, "topStories required")
    assert_true("trichy" in feeds, "trichy required")
    assert_true(all(isinstance(item, tuple) and len(item) == 3 for section in feeds.values() for item in section), "feed tuples required")


def test_build_section_quality():
    sections = {
        "topStories": [
            {"id": "a", "sourceGroup": "the_hindu", "category": "topStories"},
            {"id": "b", "sourceGroup": "ndtv", "category": "topStories"},
        ],
        "india": [],
        "tn": [],
        "trichy": [],
        "world": [],
        "business": [],
        "technology": [],
        "sports": [],
        "entertainment": [],
    }

    quality = build_section_quality(sections)

    assert_true(quality["topStories"]["storyCount"] == 2, "story count wrong")
    assert_true(quality["topStories"]["sourceGroupCount"] == 2, "source diversity wrong")
    assert_true(quality["india"]["thin"] is True, "empty section should be thin")


def test_section_source_policy_report():
    report = build_section_source_policy_report({
        "topStories": [{"id": "a", "sourceGroup": "the_hindu"}],
    }, {
        "the_hindu": {"ok": True, "items": 12, "lastSuccess": 123},
    })

    assert_true(report["reportVersion"] == "section-source-policy-report-v1", "report version missing")
    assert_true("sectionQuality" in report, "section quality missing")
    assert_true("topStories" in report["sectionSummary"], "section summary missing")


if __name__ == "__main__":
    test_normalize_section_feed_list_shape()
    test_section_policy_load_and_validate()
    test_section_feeds_map_shape()
    test_build_section_quality()
    test_section_source_policy_report()
    print("PASS: Section source policy Python tests")
`);

write('scripts/test_sections_source_policy_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const config = read('config/section_sources.json');
const policy = read('scripts/section_source_policy.py');
const fetcher = read('scripts/fetch_sections_stories.py');
const pyTest = read('scripts/test_section_source_policy.py');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  '"policyVersion": "section-source-policy-v1"',
  '"topStories"',
  '"india"',
  '"tn"',
  '"trichy"',
  '"business"',
  '"technology"',
  '"sourceGroup"',
  '"tier"',
  '"topic"'
]) {
  assert(config.includes(token), \`section_sources.json missing token: \${token}\`);
}

for (const token of [
  'load_section_source_policy',
  'validate_section_source_policy',
  'get_section_feeds_map',
  'build_section_quality',
  'build_section_source_policy_report',
  'write_section_source_policy_report',
  'section-source-policy-report-v1'
]) {
  assert(policy.includes(token), \`section_source_policy.py missing token: \${token}\`);
}

for (const token of [
  'get_section_feeds_map',
  'build_section_quality',
  'write_section_source_policy_report',
  'SECTION_FEEDS = get_section_feeds_map()',
  "'sectionQuality': section_quality",
  "'schemaVersion': 2",
  "'items': len(feed_items)"
]) {
  assert(fetcher.includes(token), \`fetch_sections_stories.py missing section policy token: \${token}\`);
}

assert(
  !fetcher.includes('https://www.thehindu.com/news/feeder/default.rss'),
  'fetch_sections_stories.py must not keep old hardcoded SECTION_FEEDS block'
);

for (const token of [
  'test_normalize_section_feed_list_shape',
  'test_section_policy_load_and_validate',
  'test_section_feeds_map_shape',
  'test_build_section_quality',
  'test_section_source_policy_report'
]) {
  assert(pyTest.includes(token), \`test_section_source_policy.py missing token: \${token}\`);
}

assert(
  packageJson.includes('"test:sections-source-policy"'),
  'package.json must include test:sections-source-policy'
);

assert(
  certGate.includes("['npm', ['run', 'test:sections-source-policy']]"),
  'certification gate must run test:sections-source-policy'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Sections source policy slice',
  guarantees: [
    'section feed registry is externalized',
    'fetch_sections_stories loads SECTION_FEEDS from policy',
    'per-feed source health counts are accurate',
    'sections_latest.json includes sectionQuality',
    'section source policy report is generated',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Sections source policy static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:sections-source-policy'] = 'node scripts/test_sections_source_policy_static.mjs && python scripts/test_section_source_policy.py';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:sections-source-policy']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-adaptive-source-health']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-adaptive-source-health']],",
      "  ['npm', ['run', 'test:insight-adaptive-source-health']],\n  ['npm', ['run', 'test:sections-source-policy']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:sections-source-policy']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 50 Sections source policy patch complete.');
