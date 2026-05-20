"""
fetch_upahead_events.py — UpAhead events / offers / alerts pre-fetch.

Runs 5× per day (IST 4am, 10am, 2pm, 6pm, 8pm) via upahead_refresh.yml.
Festivals / holidays are handled by a separate weekly script (fetch_festivals.py).

Every item in the output MUST have:
  publishedAt, eventStartAt, eventEndAt, expiryAt,
  dateConfidence, dateSource, city, region, localityScore,
  plannerEligible, suppressionReason, actionabilityScore

Retention policy:
  - Items with expiryAt in the future are always kept.
  - Items with eventStartAt are kept if within [now-1day, now+7days].
  - shopping  → kept 48 h from publishedAt
  - alerts / weather_alerts → kept 24 h from publishedAt
  - All others without eventStartAt are dropped.

Eligibility gate (is_planner_eligible):
  - suppressionReason must be None
  - expiryAt (if set) must be in the future
  - eventStartAt (if set) must be within [-6h, +7 days]
  - localityScore >= 0.30
  - dateConfidence != 'unknown' unless category is 'alerts' or 'shopping'
"""
import os
import re
import sys
import time
import hashlib
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))

import feedparser
from prefetch_common import (
    H_MS, DAY_MS, now_ms, read_json, write_json,
    canonical_url, title_fingerprint, make_story_id,
    compute_content_hash, is_suppressed, normalize_basic_story
)

# ── Paths ─────────────────────────────────────────────────────────────────────
UP_AHEAD_PATH      = 'public/data/up_ahead.json'
SOURCE_HEALTH_PATH = 'public/newsdata/source_health.json'

# ── Category feeds ────────────────────────────────────────────────────────────
# Structure: category → location_key → [(url, source_name, source_group)]
# Tier A direct feeds are preferred; Google News search fills gaps.
CATEGORY_FEEDS = {
    'movies': {
        'India': [
            ('https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml',
             'Hindustan Times Tamil', 'hindustan_times'),
            ('https://www.hindustantimes.com/feeds/rss/entertainment/bollywood/rssfeed.xml',
             'Hindustan Times Bollywood', 'hindustan_times'),
            ('https://news.google.com/rss/search?q=upcoming+Tamil+movie+release+date+2025&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News', 'google_news'),
            ('https://news.google.com/rss/search?q=upcoming+Hindi+movie+release+OTT+2025&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News', 'google_news'),
        ],
    },
    'events': {
        'Chennai': [
            ('https://news.google.com/rss/search?q=Chennai+upcoming+events+concert+exhibition+workshop+this+week&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Chennai', 'google_news'),
        ],
        'Muscat': [
            ('https://news.google.com/rss/search?q=Muscat+upcoming+events+concert+exhibition+this+month&hl=en-US&gl=US&ceid=US:en',
             'Google News Muscat', 'google_news'),
        ],
        'Trichy': [
            ('https://news.google.com/rss/search?q=Trichy+events+exhibition+cultural+event+this+week&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Trichy', 'google_news'),
        ],
    },
    'alerts': {
        'Chennai': [
            ('https://www.thehindu.com/news/cities/chennai/feeder/default.rss',
             'The Hindu Chennai', 'the_hindu'),
            ('https://www.dtnext.in/rss',
             'DT Next', 'dtnext'),
            ('https://news.google.com/rss/search?q=Chennai+power+cut+OR+water+supply+OR+TANGEDCO+OR+metro+water&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Chennai Alerts', 'google_news'),
        ],
        'Muscat': [
            ('https://www.omanobserver.om/rss',
             'Oman Observer', 'oman_observer'),
            ('https://timesofoman.com/rss',
             'Times of Oman', 'times_of_oman'),
            ('https://news.google.com/rss/search?q=Muscat+road+closure+OR+advisory+OR+announcement&hl=en-US&gl=US&ceid=US:en',
             'Google News Muscat Alerts', 'google_news'),
        ],
        'Trichy': [
            ('https://www.thehindu.com/news/cities/Tiruchirapalli/feeder/default.rss',
             'The Hindu Trichy', 'the_hindu'),
            ('https://news.google.com/rss/search?q=Trichy+power+cut+OR+water+supply+OR+civic+alert&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Trichy Alerts', 'google_news'),
        ],
    },
    'weather_alerts': {
        'Chennai': [
            ('https://news.google.com/rss/search?q=IMD+Chennai+weather+warning+OR+cyclone+OR+heavy+rain+alert&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Chennai Weather', 'google_news'),
        ],
        'Muscat': [
            ('https://news.google.com/rss/search?q=Oman+Met+weather+warning+OR+thunderstorm+OR+flood+alert+Muscat&hl=en-US&gl=US&ceid=US:en',
             'Google News Muscat Weather', 'google_news'),
        ],
        'Trichy': [
            ('https://news.google.com/rss/search?q=Trichy+weather+warning+OR+Tamil+Nadu+rain+alert+OR+IMD&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Trichy Weather', 'google_news'),
        ],
    },
    'shopping': {
        'online': [
            ('https://news.google.com/rss/search?q=Amazon+sale+OR+Flipkart+sale+OR+Myntra+sale+2025&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Shopping', 'google_news'),
            ('https://news.google.com/rss/search?q=online+shopping+sale+discount+coupon+India+2025&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Deals', 'google_news'),
        ],
        'Chennai': [
            ('https://news.google.com/rss/search?q=Chennai+sale+T+Nagar+shopping+OR+Saravana+Stores+offer&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Chennai Shopping', 'google_news'),
        ],
        'Muscat': [
            ('https://news.google.com/rss/search?q=Muscat+Lulu+sale+OR+Oman+shopping+offer+discount&hl=en-US&gl=US&ceid=US:en',
             'Google News Muscat Shopping', 'google_news'),
        ],
    },
    'airlines': {
        'global': [
            ('https://news.google.com/rss/search?q=IndiGo+OR+Air+India+OR+Oman+Air+OR+SalamAir+fare+sale+booking+2025&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Airlines', 'google_news'),
        ],
    },
    'civic': {
        'Chennai': [
            ('https://news.google.com/rss/search?q=Chennai+metro+water+OR+TANGEDCO+OR+corporation+notice+OR+civic+body&hl=en-IN&gl=IN&ceid=IN:en',
             'Google News Chennai Civic', 'google_news'),
        ],
        'Muscat': [
            ('https://news.google.com/rss/search?q=Muscat+municipality+OR+Oman+civic+announcement+OR+road+work&hl=en-US&gl=US&ceid=US:en',
             'Google News Muscat Civic', 'google_news'),
        ],
    },
}

# ── Locality config ───────────────────────────────────────────────────────────
LOCATION_LOCALITY = {
    'Chennai': {'city': 'Chennai', 'region': 'tn',    'localityScore': 1.0},
    'Trichy':  {'city': 'Trichy',  'region': 'tn',    'localityScore': 0.9},
    'Muscat':  {'city': 'Muscat',  'region': 'oman',  'localityScore': 1.0},
    'India':   {'city': None,      'region': 'india', 'localityScore': 0.5},
    'Oman':    {'city': None,      'region': 'oman',  'localityScore': 0.5},
    'online':  {'city': None,      'region': None,    'localityScore': 0.3},
    'global':  {'city': None,      'region': None,    'localityScore': 0.3},
}


# ── Date extraction ───────────────────────────────────────────────────────────
_DATE_PATTERNS = [
    # "January 15, 2025" or "15 January 2025"
    (r'\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b',
     'dmy_full'),
    (r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b',
     'mdy_full'),
    # "Jan 15" (current year assumed)
    (r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\b',
     'md_abbr'),
    # "this friday", "next saturday"
    (r'\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
     'relative_weekday'),
    # "releasing on DD/MM" or "opening MM/DD"
    (r'\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b',
     'numeric_date'),
]

_MONTH_MAP = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
    'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}

_WEEKDAY_MAP = {'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
                'friday': 4, 'saturday': 5, 'sunday': 6}


def _next_weekday(ref_dt, target_wd):
    days_ahead = (target_wd - ref_dt.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return ref_dt + timedelta(days=days_ahead)


def extract_event_date(text: str, ref_ts: int) -> tuple[int | None, str]:
    """
    Return (event_start_ms, confidence) where confidence is one of
    'exact', 'range', 'inferred', 'unknown'.
    ref_ts is the publishedAt timestamp of the article.
    """
    lower = (text or '').lower()
    ref_dt = datetime.fromtimestamp(ref_ts / 1000, tz=timezone.utc)

    # Full date patterns
    for pat, kind in _DATE_PATTERNS:
        m = re.search(pat, lower)
        if not m:
            continue
        try:
            if kind == 'dmy_full':
                day, month_str, year = int(m.group(1)), m.group(2), int(m.group(3))
                month = _MONTH_MAP.get(month_str, 0)
                if month:
                    dt = datetime(year, month, day, 0, 0, 0, tzinfo=timezone.utc)
                    return int(dt.timestamp() * 1000), 'exact'
            elif kind == 'mdy_full':
                month_str, day, year = m.group(1), int(m.group(2)), int(m.group(3))
                month = _MONTH_MAP.get(month_str, 0)
                if month:
                    dt = datetime(year, month, day, 0, 0, 0, tzinfo=timezone.utc)
                    return int(dt.timestamp() * 1000), 'exact'
            elif kind == 'md_abbr':
                month_str, day = m.group(1), int(m.group(2))
                month = _MONTH_MAP.get(month_str, 0)
                if month:
                    year = ref_dt.year
                    dt = datetime(year, month, day, 0, 0, 0, tzinfo=timezone.utc)
                    # If date appears to be in the past, bump to next year
                    if dt < ref_dt - timedelta(days=1):
                        dt = dt.replace(year=year + 1)
                    return int(dt.timestamp() * 1000), 'inferred'
            elif kind == 'relative_weekday':
                prefix, wd_str = m.group(1), m.group(2)
                wd = _WEEKDAY_MAP[wd_str]
                if prefix == 'this':
                    days = (wd - ref_dt.weekday()) % 7
                    dt = ref_dt + timedelta(days=days)
                else:  # next
                    dt = _next_weekday(ref_dt, wd)
                return int(dt.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000), 'inferred'
            elif kind == 'numeric_date':
                d1, d2, yr = int(m.group(1)), int(m.group(2)), m.group(3)
                year = ref_dt.year if not yr else (int(yr) if int(yr) > 100 else 2000 + int(yr))
                # Assume DD/MM for Indian context
                if 1 <= d2 <= 12:
                    dt = datetime(year, d2, d1, 0, 0, 0, tzinfo=timezone.utc)
                    return int(dt.timestamp() * 1000), 'inferred'
        except (ValueError, OverflowError):
            continue

    return None, 'unknown'


# ── Expiry derivation ─────────────────────────────────────────────────────────
def derive_expiry(event_start_ms, event_end_ms, published_ms, category):
    """Return expiryAt ms or None."""
    if event_end_ms:
        return event_end_ms
    if event_start_ms:
        # Expire event at end of day it starts
        dt = datetime.fromtimestamp(event_start_ms / 1000, tz=timezone.utc)
        end_of_day = dt.replace(hour=23, minute=59, second=59, microsecond=0)
        return int(end_of_day.timestamp() * 1000)
    if category in ('shopping', 'airlines'):
        return published_ms + 48 * H_MS
    if category in ('alerts', 'weather_alerts', 'civic'):
        return published_ms + 24 * H_MS
    return None


# ── Retention ─────────────────────────────────────────────────────────────────
def keep_upahead_item(item: dict, ts: int) -> bool:
    expiry      = item.get('expiryAt')
    event_start = item.get('eventStartAt')
    category    = item.get('category', '')

    if expiry and expiry >= ts:
        return True
    if event_start:
        return (ts - DAY_MS) <= event_start <= (ts + 7 * DAY_MS)
    if category == 'shopping':
        return item.get('publishedAt', 0) >= ts - 48 * H_MS
    if category in ('alerts', 'weather_alerts', 'civic'):
        return item.get('publishedAt', 0) >= ts - 24 * H_MS
    return False


# ── Eligibility gate ──────────────────────────────────────────────────────────
def is_planner_eligible(item: dict, ts: int) -> bool:
    category = item.get('category', '')
    if item.get('suppressionReason'):
        return False
    if item.get('expiryAt') and item['expiryAt'] < ts:
        return False
    event_start = item.get('eventStartAt')
    if event_start:
        days_ahead = (event_start - ts) / DAY_MS
        if days_ahead < -0.25 or days_ahead > 7:
            return False
    elif category not in ('shopping', 'alerts', 'weather_alerts', 'civic', 'airlines'):
        return False
    if item.get('localityScore', 0) < 0.30:
        return False
    if item.get('dateConfidence') == 'unknown' and category not in ('alerts', 'shopping', 'weather_alerts', 'civic'):
        return False
    return True


# ── Actionability heuristic ───────────────────────────────────────────────────
def estimate_actionability(item: dict) -> float:
    score = 0.5
    category = item.get('category', '')
    title_l  = (item.get('title', '') + ' ' + item.get('summary', '')).lower()

    # High-action keywords
    if re.search(r'\b(book|register|apply|deadline|last day|today only|limited|urgent|evacuate|do not|warning)\b', title_l):
        score += 0.3
    # Low-action keywords (informational only)
    if re.search(r'\b(review|recap|opinion|analysis|explained|why|how|who is)\b', title_l):
        score -= 0.2

    if category in ('alerts', 'weather_alerts', 'civic'):
        score += 0.2
    if category == 'shopping':
        score += 0.15
    if category == 'events':
        score += 0.1

    return round(max(0.0, min(1.0, score)), 2)


# ── Feed parse ────────────────────────────────────────────────────────────────
def fetch_category_items(category: str, location: str, feeds: list, ts: int) -> tuple[list, dict]:
    results, source_health = [], {}
    locality_meta = LOCATION_LOCALITY.get(location, {'city': None, 'region': None, 'localityScore': 0.3})

    for url, source, source_group in feeds:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:15]:
                pub = entry.get('published_parsed')
                pub_ms = int(time.mktime(pub) * 1000) if pub else ts
                title   = entry.get('title', '').strip()
                summary = entry.get('summary', '').strip()
                link    = entry.get('link', '').strip()

                raw_text = f"{title} {summary}"
                event_start_ms, date_conf = extract_event_date(raw_text, pub_ms)
                event_end_ms   = None
                expiry_ms      = derive_expiry(event_start_ms, event_end_ms, pub_ms, category)

                item = {
                    'title':        title,
                    'summary':      summary,
                    'url':          link,
                    'source':       source,
                    'sourceGroup':  source_group,
                    'category':     category,
                    'publishedAt':  pub_ms,
                    'eventStartAt': event_start_ms,
                    'eventEndAt':   event_end_ms,
                    'expiryAt':     expiry_ms,
                    'dateConfidence': date_conf,
                    'dateSource':   'title' if event_start_ms else 'none',
                    'city':         locality_meta['city'],
                    'region':       locality_meta['region'],
                    'localityScore': locality_meta['localityScore'],
                    'language':     'en',
                }
                item['id'] = make_story_id(item)
                is_suppressed(item, category)  # sets suppressionReason
                item['actionabilityScore'] = estimate_actionability(item)
                item['plannerEligible']    = is_planner_eligible(item, ts)

                results.append(item)

            source_health[source_group] = {'ok': True, 'items': len(results), 'lastSuccess': ts}
        except Exception as e:
            source_health[source_group] = {'ok': False, 'error': str(e), 'items': 0}

    return results, source_health


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ts = now_ms()
    existing = read_json(UP_AHEAD_PATH, {'schemaVersion': 1, 'fetchedAt': 0, 'contentHash': '', 'items': []})
    old_items = existing.get('items', [])

    # Retain items that are still valid
    retained = [item for item in old_items if keep_upahead_item(item, ts)]
    retained_by_id = {item['id']: item for item in retained if item.get('id')}

    all_health = {}
    new_items = []

    for category, location_map in CATEGORY_FEEDS.items():
        for location, feeds in location_map.items():
            items, health = fetch_category_items(category, location, feeds, ts)
            all_health.update(health)
            new_items.extend(items)

    # Merge: new wins (fresh data replaces stale on same ID)
    merged_by_id = {**retained_by_id}
    for item in new_items:
        sid = item.get('id')
        if sid:
            merged_by_id[sid] = item  # new always wins

    all_items = list(merged_by_id.values())

    # Dedup — keep most-recently published on title fingerprint collision
    fp_seen: dict[str, dict] = {}
    for item in sorted(all_items, key=lambda x: x.get('publishedAt', 0), reverse=True):
        fp = title_fingerprint(item.get('title', ''))
        cat = item.get('category', '')
        key = f"{cat}::{fp}"
        if key not in fp_seen:
            fp_seen[key] = item
    deduped = list(fp_seen.values())

    snapshot = {
        'schemaVersion': 1,
        'fetchedAt':     ts,
        'contentHash':   compute_content_hash(deduped),
        'items':         deduped,
    }
    write_json(UP_AHEAD_PATH, snapshot)

    # Update source health
    existing_health = read_json(SOURCE_HEALTH_PATH, {'lastChecked': 0, 'sources': {}})
    existing_health['sources'].update(all_health)
    existing_health['lastChecked'] = ts
    write_json(SOURCE_HEALTH_PATH, existing_health)

    eligible = sum(1 for item in deduped if item.get('plannerEligible'))
    print(
        f'Done. total={len(deduped)}, plannerEligible={eligible}, '
        f'retained={len(retained)}, contentHash={snapshot["contentHash"]}'
    )


if __name__ == '__main__':
    main()
