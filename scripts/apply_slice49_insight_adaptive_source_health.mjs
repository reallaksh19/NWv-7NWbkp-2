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

patchFile('scripts/insight_source_policy.py', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `DEFAULT_REQUIRED_COVERAGE = {
    "minFeedsPerSlot": 3,
    "minTierAFeeds": 6,
    "minSourceGroups": 8,
    "minTopics": 5,
}
`,
    `
SOURCE_HEALTH_POLICY_VERSION = "insight-source-health-policy-v1"

SOURCE_HEALTH_DEFAULTS = {
    "failedBackoffHours": 6,
    "zeroItemBackoffHours": 3,
    "minItemsForHealthy": 3,
    "maxSuppressedFractionPerSlot": 0.5,
}
`,
    'source health defaults'
  );

  text = insertAfterOnce(
    text,
    `def get_slot_feeds_map(path: Path = SOURCE_POLICY_PATH) -> dict[str, list[tuple[str, str, str]]]:
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


`,
    `def source_health_score(health: dict[str, Any] | None, ts: int | None = None) -> float:
    """Return 0..1 feed health score from previous source_health.json entry."""
    if not health:
        return 0.55

    if health.get("ok") is False:
        return 0.05

    items = int(health.get("items", 0) or 0)
    last_success = int(health.get("lastSuccess", 0) or 0)
    ts = int(ts or time.time() * 1000)

    item_score = min(1.0, items / max(1, SOURCE_HEALTH_DEFAULTS["minItemsForHealthy"]))
    age_hours = max(0.0, (ts - last_success) / 3_600_000) if last_success else 24.0
    recency_score = max(0.0, 1.0 - age_hours / 24.0)

    return round(0.15 + item_score * 0.65 + recency_score * 0.20, 4)


def source_backoff_reason(
    source_group: str,
    health: dict[str, Any] | None,
    ts: int | None = None,
) -> str:
    if not health:
        return ""

    ts = int(ts or time.time() * 1000)
    last_success = int(health.get("lastSuccess", 0) or 0)
    last_checked = int(health.get("lastChecked", health.get("lastFailure", 0)) or 0)

    if health.get("ok") is False:
        age_hours = (ts - last_checked) / 3_600_000 if last_checked else 999
        if age_hours < SOURCE_HEALTH_DEFAULTS["failedBackoffHours"]:
            return f"recent failure backoff for {source_group}"

    if health.get("ok") is True and int(health.get("items", 0) or 0) == 0:
        age_hours = (ts - last_success) / 3_600_000 if last_success else 0
        if age_hours < SOURCE_HEALTH_DEFAULTS["zeroItemBackoffHours"]:
            return f"zero-item backoff for {source_group}"

    return ""


def rank_slot_feeds_by_health(
    feeds: list[dict[str, Any]],
    source_health: dict[str, Any] | None = None,
    ts: int | None = None,
) -> list[dict[str, Any]]:
    source_health = source_health or {}
    ts = int(ts or time.time() * 1000)

    ranked = []
    for index, feed in enumerate(feeds):
        group = feed["sourceGroup"]
        health = source_health.get(group, {})
        score = source_health_score(health, ts)
        backoff = source_backoff_reason(group, health, ts)

        ranked.append({
            **feed,
            "healthScore": score,
            "backoffReason": backoff,
            "originalIndex": index,
        })

    return sorted(
        ranked,
        key=lambda feed: (
            bool(feed["backoffReason"]),
            -float(feed["healthScore"]),
            feed["tier"],
            feed["originalIndex"],
        ),
    )


def get_active_slot_feeds_map(
    source_health: dict[str, Any] | None = None,
    path: Path = SOURCE_POLICY_PATH,
    ts: int | None = None,
) -> dict[str, list[tuple[str, str, str]]]:
    """Return feed tuples ordered by health, with bounded suppression.

    If suppression would remove too much of a slot, original ranked feeds are
    retained so a bad health file never fully disables Insight fetching.
    """
    policy = load_source_policy(path)
    validation = validate_source_policy(policy)

    if validation["errors"]:
        raise RuntimeError("Invalid Insight source policy: " + "; ".join(validation["errors"]))

    source_health = source_health or {}
    ts = int(ts or time.time() * 1000)
    max_suppressed_fraction = float(SOURCE_HEALTH_DEFAULTS["maxSuppressedFractionPerSlot"])

    active: dict[str, list[tuple[str, str, str]]] = {}

    for slot in SLOTS:
        feeds = policy["slots"].get(slot, [])
        ranked = rank_slot_feeds_by_health(feeds, source_health, ts)
        allowed_suppressed_count = int(len(ranked) * max_suppressed_fraction)

        kept = []
        suppressed = []

        for feed in ranked:
            if feed["backoffReason"] and len(suppressed) < allowed_suppressed_count:
                suppressed.append(feed)
            else:
                kept.append(feed)

        if not kept:
            kept = ranked

        active[slot] = [
            (feed["url"], feed["source"], feed["sourceGroup"])
            for feed in kept
        ]

    return active


def build_source_health_policy_report(
    source_health: dict[str, Any] | None = None,
    path: Path = SOURCE_POLICY_PATH,
    ts: int | None = None,
) -> dict[str, Any]:
    policy = load_source_policy(path)
    source_health = source_health or {}
    ts = int(ts or time.time() * 1000)

    slot_reports = {}

    for slot in SLOTS:
        ranked = rank_slot_feeds_by_health(policy["slots"].get(slot, []), source_health, ts)
        slot_reports[slot] = {
            "feedCount": len(ranked),
            "activeCount": len([
                feed for feed in ranked if not feed["backoffReason"]
            ]),
            "suppressedCount": len([
                feed for feed in ranked if feed["backoffReason"]
            ]),
            "feeds": [
                {
                    "source": feed["source"],
                    "sourceGroup": feed["sourceGroup"],
                    "tier": feed["tier"],
                    "topic": feed["topic"],
                    "healthScore": feed["healthScore"],
                    "backoffReason": feed["backoffReason"],
                }
                for feed in ranked
            ],
        }

    return {
        "schemaVersion": 1,
        "policyVersion": SOURCE_HEALTH_POLICY_VERSION,
        "generatedAt": ts,
        "slotReports": slot_reports,
    }


`,
    'adaptive source health functions'
  );

  text = replaceOnce(
    text,
    `    return {
        "schemaVersion": 1,
        "reportVersion": "insight-source-policy-report-v1",
        "generatedAt": int(time.time() * 1000),
        "policyVersion": policy.get("policyVersion"),
        "validation": validation,
        "slotSummary": slot_summary,
        "sourceCount": len(sources),
        "sources": sources,
    }`,
    `    return {
        "schemaVersion": 1,
        "reportVersion": "insight-source-policy-report-v1",
        "generatedAt": int(time.time() * 1000),
        "policyVersion": policy.get("policyVersion"),
        "validation": validation,
        "slotSummary": slot_summary,
        "sourceHealthPolicy": build_source_health_policy_report(source_health),
        "sourceCount": len(sources),
        "sources": sources,
    }`,
    'embed source health policy report'
  );

  return text;
});

patchFile('scripts/fetch_insight_stories.py', source => {
  let text = source;

  text = replaceOnce(
    text,
    `from insight_source_policy import get_slot_feeds_map, write_source_policy_report`,
    `from insight_source_policy import get_active_slot_feeds_map, get_slot_feeds_map, write_source_policy_report`,
    'import active source policy'
  );

  text = insertAfterOnce(
    text,
    `SLOT_FEEDS = get_slot_feeds_map()

`,
    `def get_current_source_health() -> dict:
    return read_json(SOURCE_HEALTH_PATH, {'lastChecked': 0, 'sources': {}}).get('sources', {})


def get_active_slot_feeds() -> dict:
    return get_active_slot_feeds_map(get_current_source_health())


`,
    'active slot feed helpers'
  );

  text = replaceOnce(
    text,
    `    for url, source, source_group in SLOT_FEEDS[slot]:`,
    `    active_feeds = get_active_slot_feeds()
    for url, source, source_group in active_feeds[slot]:`,
    'use active health-ranked feeds'
  );

  text = replaceOnce(
    text,
    `    write_source_policy_report(SLOT_FEEDS, health)`,
    `    write_source_policy_report(get_active_slot_feeds(), health)`,
    'source policy report uses active feeds'
  );

  return text;
});

write('scripts/test_insight_adaptive_source_health.py', `import time

from insight_source_policy import (
    build_source_health_policy_report,
    get_active_slot_feeds_map,
    load_source_policy,
    rank_slot_feeds_by_health,
    source_backoff_reason,
    source_health_score,
)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def test_source_health_score_prefers_successful_item_yield():
    ts = int(time.time() * 1000)

    good = source_health_score({"ok": True, "items": 12, "lastSuccess": ts}, ts)
    empty = source_health_score({"ok": True, "items": 0, "lastSuccess": ts}, ts)
    failed = source_health_score({"ok": False, "items": 0, "lastChecked": ts}, ts)

    assert_true(good > empty, "good source should score higher than empty source")
    assert_true(empty > failed, "empty source should score higher than failed source")


def test_source_backoff_reason_for_recent_failure():
    ts = int(time.time() * 1000)
    reason = source_backoff_reason("bad_source", {
        "ok": False,
        "items": 0,
        "lastChecked": ts,
        "error": "timeout",
    }, ts)

    assert_true("recent failure backoff" in reason, "recent failed source should back off")


def test_rank_slot_feeds_by_health_orders_healthy_first():
    feeds = [
        {"url": "https://bad.example/rss", "source": "Bad", "sourceGroup": "bad", "tier": "A", "topic": "news"},
        {"url": "https://good.example/rss", "source": "Good", "sourceGroup": "good", "tier": "B", "topic": "news"},
    ]

    ts = int(time.time() * 1000)
    ranked = rank_slot_feeds_by_health(feeds, {
        "bad": {"ok": False, "items": 0, "lastChecked": ts},
        "good": {"ok": True, "items": 12, "lastSuccess": ts},
    }, ts)

    assert_true(ranked[0]["sourceGroup"] == "good", "healthy feed should rank first")
    assert_true(ranked[1]["backoffReason"], "failed feed should have backoff reason")


def test_active_slot_feeds_never_fully_empty():
    ts = int(time.time() * 1000)
    policy = load_source_policy()

    health = {}
    for slot, feeds in policy["slots"].items():
        for feed in feeds:
            health[feed["sourceGroup"]] = {
                "ok": False,
                "items": 0,
                "lastChecked": ts,
                "error": "forced failure",
            }

    active = get_active_slot_feeds_map(health, ts=ts)

    assert_true(all(active[slot] for slot in ["now", "minus4h", "minus12h", "minus24h"]), "active feeds must never be empty")


def test_source_health_policy_report_shape():
    ts = int(time.time() * 1000)
    report = build_source_health_policy_report({
        "the_hindu": {"ok": True, "items": 10, "lastSuccess": ts},
        "bbc": {"ok": False, "items": 0, "lastChecked": ts},
    }, ts=ts)

    assert_true(report["policyVersion"] == "insight-source-health-policy-v1", "policy version missing")
    assert_true("now" in report["slotReports"], "slot report missing")
    assert_true(report["slotReports"]["now"]["feedCount"] >= 1, "feed count missing")


if __name__ == "__main__":
    test_source_health_score_prefers_successful_item_yield()
    test_source_backoff_reason_for_recent_failure()
    test_rank_slot_feeds_by_health_orders_healthy_first()
    test_active_slot_feeds_never_fully_empty()
    test_source_health_policy_report_shape()
    print("PASS: Insight adaptive source health Python tests")
`);

write('scripts/test_insight_adaptive_source_health_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const policy = read('scripts/insight_source_policy.py');
const fetcher = read('scripts/fetch_insight_stories.py');
const pyTest = read('scripts/test_insight_adaptive_source_health.py');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'SOURCE_HEALTH_POLICY_VERSION',
  'SOURCE_HEALTH_DEFAULTS',
  'source_health_score',
  'source_backoff_reason',
  'rank_slot_feeds_by_health',
  'get_active_slot_feeds_map',
  'build_source_health_policy_report'
]) {
  assert(policy.includes(token), \`insight_source_policy.py missing adaptive health token: \${token}\`);
}

for (const token of [
  'get_active_slot_feeds_map',
  'get_current_source_health',
  'get_active_slot_feeds',
  'active_feeds = get_active_slot_feeds()',
  'write_source_policy_report(get_active_slot_feeds(), health)'
]) {
  assert(fetcher.includes(token), \`fetch_insight_stories.py missing adaptive feed token: \${token}\`);
}

for (const token of [
  'test_source_health_score_prefers_successful_item_yield',
  'test_source_backoff_reason_for_recent_failure',
  'test_rank_slot_feeds_by_health_orders_healthy_first',
  'test_active_slot_feeds_never_fully_empty',
  'test_source_health_policy_report_shape'
]) {
  assert(pyTest.includes(token), \`test_insight_adaptive_source_health.py missing token: \${token}\`);
}

assert(
  packageJson.includes('"test:insight-adaptive-source-health"'),
  'package.json must include test:insight-adaptive-source-health'
);

assert(
  certGate.includes("['npm', ['run', 'test:insight-adaptive-source-health']]"),
  'certification gate must run test:insight-adaptive-source-health'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight adaptive source-health feed policy slice',
  guarantees: [
    'source health scores are computed',
    'recent failed feeds receive temporary backoff',
    'healthy feeds are ranked first',
    'active feed list never becomes empty',
    'fetcher uses active health-ranked feeds',
    'source policy report includes health-policy diagnostics',
    'static and Python certification are included'
  ]
}, null, 2));

console.log('PASS: Insight adaptive source health static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-adaptive-source-health'] = 'node scripts/test_insight_adaptive_source_health_static.mjs && python scripts/test_insight_adaptive_source_health.py';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-adaptive-source-health']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-source-policy']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-source-policy']],",
      "  ['npm', ['run', 'test:insight-source-policy']],\n  ['npm', ['run', 'test:insight-adaptive-source-health']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-adaptive-source-health']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 49 Insight adaptive source health patch complete.');
