"""
fetch_insight_stories.py — smart-TTL Insight story scraper.

Smart-TTL merge: a slot is only re-fetched when its TTL has expired.
Old stories are retained for 36 h from publishedAt.

Run via GitHub Actions (news_prefetch.yml):
  python scripts/fetch_insight_stories.py
"""
import glob
import os
import sys
import time

# Allow importing from scripts/ when run from repo root
sys.path.insert(0, os.path.dirname(__file__))

import feedparser
from datetime import datetime
from prefetch_common import (
    H_MS, DAY_MS, now_ms, read_json, write_json,
    normalize_basic_story, is_suppressed, compute_content_hash
)
from insight_source_policy import get_active_slot_feeds_map, get_slot_feeds_map, write_source_policy_report
from insight_json_contract import optimize_insight_snapshot

# ── Paths ─────────────────────────────────────────────────────────────────────
INSIGHT_PATH       = 'public/newsdata/insight_latest.json'
SOURCE_HEALTH_PATH = 'public/newsdata/source_health.json'
SOURCE_POLICY_REPORT_PATH = 'public/newsdata/source_policy_report.json'

# ── Slot config ───────────────────────────────────────────────────────────────
SLOTS = ['now', 'minus4h', 'minus12h', 'minus24h']

SLOT_TTL_HOURS = {
    'now':      1,
    'minus4h':  2,
    'minus12h': 3,  # was 6 — tighter re-fetch keeps older slots fresher
    'minus24h': 4,  # was 12 — prevents 12h stale content in 24–36h bucket
}

INSIGHT_RETAIN_HOURS    = 36
INSIGHT_ARCHIVE_KEEP_DAYS = 7

# ── Source policy / feed registry ─────────────────────────────────────────────
# Feed list is loaded from config/insight_sources.json so source mix can be tuned
# without changing scraper logic.
SLOT_FEEDS = get_slot_feeds_map()

def get_current_source_health() -> dict:
    return read_json(SOURCE_HEALTH_PATH, {'lastChecked': 0, 'sources': {}}).get('sources', {})


def get_active_slot_feeds() -> dict:
    return get_active_slot_feeds_map(get_current_source_health())


DEFAULT_SNAPSHOT = {
    'schemaVersion': 2,
    'fetchedAt': 0,
    'contentHash': '',
    'slotMeta': {s: {'fetchedAt': 0, 'storyIds': []} for s in SLOTS},
    'stories': [],
}


# ── TTL helpers ───────────────────────────────────────────────────────────────
def slot_is_fresh(slot_meta: dict, slot: str, ts: int) -> bool:
    fetched_at = slot_meta.get(slot, {}).get('fetchedAt', 0)
    return bool(fetched_at) and (ts - fetched_at) < SLOT_TTL_HOURS[slot] * H_MS


def keep_recent_stories(stories: list, ts: int) -> list:
    cutoff = ts - INSIGHT_RETAIN_HOURS * H_MS
    return [s for s in stories if int(s.get('publishedAt', 0)) >= cutoff]


# ── Feed fetch ────────────────────────────────────────────────────────────────
def fetch_slot_stories(slot: str) -> tuple[list, dict]:
    results, source_health = [], {}
    active_feeds = get_active_slot_feeds()
    for url, source, source_group in active_feeds[slot]:
        try:
            feed = feedparser.parse(url)
            items = []
            for entry in feed.entries[:20]:
                pub = entry.get('published_parsed')
                pub_ms = int(time.mktime(pub) * 1000) if pub else now_ms()
                raw = {
                    'title':       entry.get('title', ''),
                    'summary':     entry.get('summary', ''),
                    'url':         entry.get('link', ''),
                    'publishedAt': pub_ms,
                }
                items.append(normalize_basic_story(raw, source, source_group))
            source_health[source_group] = {
                'ok':          True,
                'items':       len(items),
                'lastSuccess': now_ms(),
            }
            results.extend(items)
        except Exception as e:
            source_health[source_group] = {
                'ok':    False,
                'error': str(e),
                'items': 0,
            }
    return results, source_health


# ── Core merge ────────────────────────────────────────────────────────────────
def refresh_insight_snapshot(old_snapshot: dict, ts: int) -> tuple[dict, dict]:
    retained       = keep_recent_stories(old_snapshot.get('stories', []), ts)
    retained_by_id = {s['id']: s for s in retained if s.get('id')}
    old_slot_meta  = old_snapshot.get('slotMeta', {})
    new_slot_meta  = {}
    fresh_items    = []
    all_source_health: dict = {}

    for slot in SLOTS:
        if slot_is_fresh(old_slot_meta, slot, ts):
            # Slot is within TTL — reuse existing storyIds (prune any that aged out)
            valid_ids = [
                sid for sid in old_slot_meta.get(slot, {}).get('storyIds', [])
                if sid in retained_by_id
            ]
            new_slot_meta[slot] = {
                'fetchedAt': old_slot_meta[slot]['fetchedAt'],
                'storyIds':  valid_ids,
            }
            print(f'  [{slot}] fresh (skipped) — {len(valid_ids)} retained IDs')
        else:
            # Slot TTL expired — re-fetch
            raw_items, health = fetch_slot_stories(slot)
            all_source_health.update(health)
            normalized = []
            for item in raw_items:
                if is_suppressed(item, 'any'):
                    continue
                item.setdefault('fetchedForSlots', [])
                if slot not in item['fetchedForSlots']:
                    item['fetchedForSlots'].append(slot)
                normalized.append(item)
            fresh_items.extend(normalized)
            new_slot_meta[slot] = {
                'fetchedAt': ts,
                'storyIds':  [x['id'] for x in normalized],
            }
            print(f'  [{slot}] re-fetched — {len(normalized)} stories')

    # Merge retained + fresh by ID (fresh wins on fetchedForSlots union)
    all_by_id = {**retained_by_id}
    for item in fresh_items:
        sid = item.get('id')
        if not sid:
            continue
        if sid in all_by_id:
            existing = set(all_by_id[sid].get('fetchedForSlots', []))
            new      = set(item.get('fetchedForSlots', []))
            all_by_id[sid]['fetchedForSlots'] = sorted(existing | new)
        else:
            all_by_id[sid] = item

    all_stories = list(all_by_id.values())
    valid_ids   = set(all_by_id.keys())

    # Clean stale IDs from slotMeta
    for slot in SLOTS:
        new_slot_meta[slot]['storyIds'] = [
            sid for sid in new_slot_meta[slot]['storyIds'] if sid in valid_ids
        ]

    snapshot = {
        'schemaVersion': 2,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(all_stories),
        'slotMeta':      new_slot_meta,
        'stories':       all_stories,
    }

    optimized_snapshot = optimize_insight_snapshot(snapshot, ts)
    return optimized_snapshot, all_source_health


# ── Source health ─────────────────────────────────────────────────────────────
def update_source_health(new_health: dict) -> None:
    existing = read_json(SOURCE_HEALTH_PATH, {'lastChecked': 0, 'sources': {}})
    existing['sources'].update(new_health)
    existing['lastChecked'] = now_ms()
    write_json(SOURCE_HEALTH_PATH, existing)


# ── Archive management ────────────────────────────────────────────────────────
def prune_old_archives() -> None:
    cutoff_ms = now_ms() - INSIGHT_ARCHIVE_KEEP_DAYS * DAY_MS
    for path in glob.glob('public/newsdata/insight_20*.json'):
        try:
            date_str = os.path.basename(path).replace('insight_', '').replace('.json', '')
            file_dt  = datetime.strptime(date_str, '%Y-%m-%d')
            file_ms  = int(file_dt.timestamp() * 1000)
            if file_ms < cutoff_ms:
                os.remove(path)
                print(f'  pruned archive: {path}')
        except Exception:
            pass


# ── Entry point ───────────────────────────────────────────────────────────────
def main() -> None:
    ts      = now_ms()
    old     = read_json(INSIGHT_PATH, DEFAULT_SNAPSHOT)
    old_hash = old.get('contentHash', '')
    print(f'Refreshing insight snapshot (ts={ts})…')
    new_snap, health = refresh_insight_snapshot(old, ts)

    write_json(INSIGHT_PATH, new_snap)
    if old_hash == new_snap.get('contentHash'):
        print('  contentHash unchanged — story content stable')

    archive_path = f"public/newsdata/insight_{datetime.now().strftime('%Y-%m-%d')}.json"
    write_json(archive_path, new_snap)

    update_source_health(health)
    write_source_policy_report(get_active_slot_feeds(), health)
    prune_old_archives()

    print(
        f'Done. stories={len(new_snap["stories"])}, '
        f'contentHash={new_snap["contentHash"]}'
    )


if __name__ == '__main__':
    main()
