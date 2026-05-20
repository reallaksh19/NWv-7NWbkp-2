"""
prefetch_common.py — shared utilities for all prefetch scripts.
All fetch scripts import from here.
"""
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone

# ── Constants ─────────────────────────────────────────────────────────────────
H_MS   = 3_600_000
DAY_MS = 86_400_000

# ── Time ──────────────────────────────────────────────────────────────────────
def now_ms() -> int:
    return int(time.time() * 1000)


# ── File I/O (atomic writes) ──────────────────────────────────────────────────
def read_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path: str, data):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=False)
    os.replace(tmp, path)


# ── URL / title normalisation ─────────────────────────────────────────────────
def canonical_url(url: str) -> str:
    if not url:
        return ''
    url = url.strip()
    url = re.sub(r'#.*$', '', url)
    url = re.sub(r'\?.*$', '', url)
    url = url.replace('/amp/', '/')
    # Unwrap Google News redirect URLs
    url = re.sub(r'https://news\.google\.com/.*?url=([^&]+).*', r'\1', url)
    return url.lower().rstrip('/')


def title_fingerprint(title: str) -> str:
    t = (title or '').lower()
    t = re.sub(r'\b(live|latest|breaking|update|exclusive|watch|just in)\b', '', t)
    t = re.sub(r'[^a-z0-9 ]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


# ── Deterministic ID / hash ───────────────────────────────────────────────────
def make_story_id(item: dict) -> str:
    url_key = canonical_url(item.get('url', ''))
    if url_key:
        base = url_key
    else:
        base = '|'.join([
            title_fingerprint(item.get('title', '')),
            item.get('sourceGroup', ''),
            str(item.get('publishedAt', ''))[:10],
        ])
    return hashlib.sha1(base.encode('utf-8')).hexdigest()[:16]


def compute_content_hash(items) -> str:
    rows = []
    for item in sorted(items, key=lambda x: x.get('id', '')):
        rows.append('|'.join([
            item.get('id', ''),
            canonical_url(item.get('url', '')),
            title_fingerprint(item.get('title', '')),
            str(item.get('publishedAt', '')),
            str(item.get('eventStartAt', '')),
            str(item.get('expiryAt', '')),
        ]))
    return hashlib.md5('\n'.join(rows).encode('utf-8')).hexdigest()[:12]


# ── Suppression rules ─────────────────────────────────────────────────────────
SUPPRESS_PATTERNS = {
    'any': [
        r"you won'?t believe",
        r'\bviral\b',
        r'\bshocking\b',
        r'photo\s*gallery',
        r'\brecap\b',
        r'\bbreaks? the internet\b',
        r'\bomg\b',
    ],
    'events': [
        r'\breview\b',
        r'how it went',
        r'post.event',
        r'highlights from',
    ],
    'shopping': [
        r'best deals?',
        r'top \d+ ways?',
        r'listicle',
        r'you should buy',
    ],
    'movies': [
        r'box office collection',
        r'ott viewership',
        r'celebrity gossip',
        r'trailer reaction',
    ],
    'airlines': [
        r'fleet update',
        r'quarterly earnings',
        r'route speculation',
    ],
    'alerts': [
        r'\bblamed?\b',
        r'political (row|storm)',
        r'post.incident',
    ],
}


def is_suppressed(item: dict, category: str = 'any') -> bool:
    text = f"{item.get('title', '')} {item.get('summary', '')}".lower()
    for pat in SUPPRESS_PATTERNS.get('any', []) + SUPPRESS_PATTERNS.get(category, []):
        if re.search(pat, text):
            item['suppressionReason'] = pat
            return True
    item['suppressionReason'] = None
    return False


# ── Story normalisation ───────────────────────────────────────────────────────
def normalize_basic_story(raw: dict, source: str, source_group: str) -> dict:
    published = raw.get('publishedAt') or raw.get('published') or now_ms()
    item = {
        'title':       raw.get('title', '').strip(),
        'summary':     raw.get('summary', '').strip(),
        'source':      source,
        'sourceGroup': source_group,
        'url':         raw.get('url', '').strip(),
        'publishedAt': int(published),
        'category':    raw.get('category'),
        'region':      raw.get('region'),
        'language':    raw.get('language', 'en'),
    }
    item['id'] = make_story_id(item)
    return item
