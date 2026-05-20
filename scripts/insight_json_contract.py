"""
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
        r"\bofficials?\b", r"\bministry\b", r"\bregulator\b", r"\bgovernment\b",
        r"\bstatement\b", r"\bconfirmed\b", r"\bapproved\b", r"\brejected\b",
    ],
    "market_reaction": [
        r"\bshares?\b", r"\bstocks?\b", r"\binvestors?\b", r"\bmarket\b",
        r"\bfell\b", r"\brose\b", r"\bsurged\b", r"\btumbled\b", r"\btrading\b",
    ],
    "expert_analysis": [
        r"\banalysts?\b", r"\bexperts?\b", r"\banalysis\b", r"\bexplains?\b",
        r"\bwhy it matters\b", r"\bimplications?\b", r"\bwarns?\b",
    ],
    "reaction_public": [
        r"\busers?\b", r"\bpublic\b", r"\bresidents?\b", r"\bbacklash\b",
        r"\bviral\b", r"\bcriticis(?:e|ed|es|ing)\b", r"\bprotests?\b",
    ],
    "background_context": [
        r"\bexplainer\b", r"\btimeline\b", r"\bwhat led\b", r"\bcontext\b",
        r"\bkey points\b", r"\bthings to know\b", r"\bhow it started\b",
    ],
    "regional_followup": [
        r"\blocal\b", r"\bregional\b", r"\bcity\b", r"\bdistrict\b",
        r"\bchennai\b", r"\btrichy\b", r"\btamil nadu\b", r"\bmuscat\b", r"\boman\b",
    ],
    "fact_update": [
        r"\bupdated?\b", r"\bnew figures?\b", r"\bdata\b", r"\bnumber\b",
        r"\bpercent\b", r"\b%\b", r"\bmillion\b", r"\bbillion\b",
    ],
}

NUMBER_RE = re.compile(
    r"(?:₹|\$|€|£)?\d+(?:,\d+)*(?:\.\d+)?\s*"
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
        for token in re.sub(r"[^a-zA-Z0-9\s-]", " ", text.lower()).split()
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
