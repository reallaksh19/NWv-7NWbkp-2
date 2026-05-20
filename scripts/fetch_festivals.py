"""
fetch_festivals.py — weekly festivals / public holidays pre-fetch.

Runs once per week (Sunday 3am IST = Saturday 21:30 UTC) via upahead_refresh.yml.
Writes into the same public/data/up_ahead.json, merging with existing items.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import feedparser
from datetime import datetime, timezone, timedelta
from prefetch_common import (
    H_MS, DAY_MS, now_ms, read_json, write_json,
    make_story_id, title_fingerprint, compute_content_hash, is_suppressed
)
from fetch_upahead_events import (
    extract_event_date, derive_expiry, is_planner_eligible,
    estimate_actionability, keep_upahead_item, LOCATION_LOCALITY
)

# ── Paths ─────────────────────────────────────────────────────────────────────
UP_AHEAD_PATH      = 'public/data/up_ahead.json'
SOURCE_HEALTH_PATH = 'public/newsdata/source_health.json'

# ── Festival feeds ────────────────────────────────────────────────────────────
FESTIVAL_FEEDS = [
    # India
    ('https://www.timeanddate.com/holidays/india/feed',
     'Time and Date India', 'timeanddate', 'India'),
    ('https://news.google.com/rss/search?q=India+public+holiday+OR+Pongal+OR+Diwali+OR+Republic+Day+2025&hl=en-IN&gl=IN&ceid=IN:en',
     'Google News India Festivals', 'google_news', 'India'),
    # Oman / Muscat
    ('https://news.google.com/rss/search?q=Oman+public+holiday+OR+Eid+OR+National+Day+2025&hl=en-US&gl=US&ceid=US:en',
     'Google News Oman Festivals', 'google_news', 'Oman'),
    # Tamil Nadu specific
    ('https://news.google.com/rss/search?q=Tamil+Nadu+festival+OR+state+holiday+2025+date&hl=en-IN&gl=IN&ceid=IN:en',
     'Google News TN Festivals', 'google_news', 'India'),
]


def fetch_festival_items(ts: int) -> tuple[list, dict]:
    results, source_health = [], {}

    for url, source, source_group, location in FESTIVAL_FEEDS:
        locality_meta = LOCATION_LOCALITY.get(location, {'city': None, 'region': None, 'localityScore': 0.5})
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:30]:
                pub = entry.get('published_parsed')
                pub_ms  = int(time.mktime(pub) * 1000) if pub else ts
                title   = entry.get('title', '').strip()
                summary = entry.get('summary', '').strip()
                link    = entry.get('link', '').strip()

                raw_text = f"{title} {summary}"
                event_start_ms, date_conf = extract_event_date(raw_text, pub_ms)

                # For festivals without explicit date, skip (too noisy)
                if not event_start_ms:
                    continue

                event_end_ms = None
                expiry_ms    = derive_expiry(event_start_ms, event_end_ms, pub_ms, 'festivals')

                item = {
                    'title':        title,
                    'summary':      summary,
                    'url':          link,
                    'source':       source,
                    'sourceGroup':  source_group,
                    'category':     'festivals',
                    'publishedAt':  pub_ms,
                    'eventStartAt': event_start_ms,
                    'eventEndAt':   event_end_ms,
                    'expiryAt':     expiry_ms,
                    'dateConfidence': date_conf,
                    'dateSource':   'title',
                    'city':         locality_meta['city'],
                    'region':       locality_meta['region'],
                    'localityScore': locality_meta['localityScore'],
                    'language':     'en',
                }
                item['id'] = make_story_id(item)
                is_suppressed(item, 'events')  # sets suppressionReason
                item['actionabilityScore'] = estimate_actionability(item)
                item['plannerEligible']    = is_planner_eligible(item, ts)

                results.append(item)

            source_health[source_group] = {'ok': True, 'items': len(results), 'lastSuccess': ts}
        except Exception as e:
            source_health[source_group] = {'ok': False, 'error': str(e), 'items': 0}

    return results, source_health


def main():
    ts       = now_ms()
    existing = read_json(UP_AHEAD_PATH, {'schemaVersion': 1, 'fetchedAt': 0, 'contentHash': '', 'items': []})
    old_items = existing.get('items', [])

    # Keep all non-festival items as-is; re-fetch all festivals
    non_festival = [i for i in old_items if i.get('category') != 'festivals']
    retained_non = {i['id']: i for i in non_festival if i.get('id')}

    new_festivals, health = fetch_festival_items(ts)
    festivals_by_id = {i['id']: i for i in new_festivals if i.get('id')}

    merged_by_id = {**retained_non, **festivals_by_id}
    all_items = list(merged_by_id.values())

    # Dedup by title fingerprint within festivals category
    fp_seen: dict[str, dict] = {}
    final = []
    for item in sorted(all_items, key=lambda x: x.get('publishedAt', 0), reverse=True):
        if item.get('category') != 'festivals':
            final.append(item)
            continue
        fp  = title_fingerprint(item.get('title', ''))
        key = f"festivals::{fp}"
        if key not in fp_seen:
            fp_seen[key] = item
            final.append(item)

    snapshot = {
        'schemaVersion': 1,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(final),
        'items':         final,
    }
    write_json(UP_AHEAD_PATH, snapshot)

    existing_health = read_json(SOURCE_HEALTH_PATH, {'lastChecked': 0, 'sources': {}})
    existing_health['sources'].update(health)
    existing_health['lastChecked'] = ts
    write_json(SOURCE_HEALTH_PATH, existing_health)

    print(
        f'Done. total={len(final)}, festivals={len(festivals_by_id)}, '
        f'contentHash={snapshot["contentHash"]}'
    )


if __name__ == '__main__':
    main()
