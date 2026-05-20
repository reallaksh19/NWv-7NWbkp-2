import os
import json
import time
import requests
import feedparser
import google.generativeai as genai
from datetime import datetime, timedelta
import traceback

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OUTPUT_FILE = "public/data/up_ahead.json"

# Configure Gemini
model = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
    except Exception as e:
        print(f"Error configuring Gemini: {e}")
else:
    print("WARNING: GEMINI_API_KEY not found. Up Ahead generation will be skipped/mocked.")

def fetch_rss_feeds():
    """
    Fetches headlines from various entertainment and city feeds.
    """
    feeds = [
        "https://www.thehindu.com/entertainment/feeder/default.rss",
        "https://www.thehindu.com/news/cities/chennai/feeder/default.rss",
        "https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml",
        "https://www.hindustantimes.com/feeds/rss/entertainment/bollywood/rssfeed.xml",
        "https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms", # TOI Entertainment
        "https://www.livemint.com/rss/news" # General news for holidays/bank closures sometimes
    ]

    all_items = []
    print("Fetching RSS feeds...")
    for url in feeds:
        try:
            d = feedparser.parse(url)
            for entry in d.entries[:10]: # Top 10 from each
                all_items.append(f"- {entry.title} ({entry.link})")
        except Exception as e:
            print(f"Error fetching {url}: {e}")

    return "\n".join(all_items)

def generate_fallback_data(headlines_text):
    """
    Generates a basic structure from headlines if AI fails.
    Parses the text format "- Title (Link)"
    """
    print("Generating fallback data from RSS items...")
    lines = headlines_text.split('\n')
    items = []

    today = datetime.now().date()
    today_str = today.strftime("%Y-%m-%d")

    for line in lines:
        if not line.startswith("- "): continue

        # Extract Title and Link
        # Format: "- Title (Link)"
        try:
            parts = line[2:].rsplit(" (", 1)
            title = parts[0]
            link = parts[1][:-1] if len(parts) > 1 else ""

            # Simple keyword categorization
            cat = "event"
            lower = title.lower()
            if "movie" in lower or "review" in lower or "release" in lower: cat = "movie"
            elif "festival" in lower or "holiday" in lower: cat = "festival"
            elif "cricket" in lower or "match" in lower: cat = "sport"
            elif "rain" in lower or "alert" in lower: cat = "alert"

            # Simple negative filter
            noise_words = ["review", "gossip", "rumour", "spotted", "dating", "box office",
                           "collection", "shocking", "viral", "video", "photo", "leaked",
                           "renamed", "locks release date", "casts", "producer", "court",
                           "petition", "arrested", "stealing", "sewage", "warns", "talks",
                           "deal", "financial results", "board meeting", "fog", "mist"]

            if any(w in lower for w in noise_words):
                continue

            items.append({
                "id": str(abs(hash(title))),
                "type": cat,
                "title": title,
                "subtitle": "From RSS",
                "description": "Latest update",
                "link": link,
                "tags": [cat]
            })
        except:
            continue

    # Create a basic timeline for "Today"
    timeline = [{
        "date": today_str,
        "dayLabel": "Latest Updates",
        "items": items[:20] # Top 20 items
    }]

    sections = {
        "movies": [{"title": i["title"], "text": i["title"], "link": i.get("link")} for i in items if i["type"] == "movie"],
        "festivals": [{"title": i["title"], "text": i["title"], "link": i.get("link")} for i in items if i["type"] == "festival"],
        "alerts": [{"text": i["title"], "severity": "medium"} for i in items if i["type"] == "alert"]
    }

    return {
        "timeline": timeline,
        "sections": sections,
        "weekly_plan": {
            "note": "AI generation unavailable. Showing latest RSS feeds."
        }
    }

def generate_up_ahead_data(headlines):
    """
    Uses Gemini to generate the Up Ahead JSON.
    """
    if not model:
        return None

    today_str = datetime.now().strftime("%A, %d %B %Y")

    prompt = f"""
    You are an intelligent lifestyle and events editor.
    Today is {today_str}.

    I have a list of recent news headlines (below).
    Your task is to generate a structured JSON output for an "Up Ahead" dashboard.

    Sources Headlines:
    {headlines}

    Instructions:
    1. **Analyze Headlines**: Look for movie releases, events, festivals, or important dates mentioned in the headlines for the NEXT 7-14 DAYS.
    2. **Internal Knowledge**: Supplement the news with your own knowledge of:
       - Major Movie Releases (Tamil, Hindi, English) scheduled for this week/next week.
       - Upcoming Holidays, Festivals, or Bank Closures in India/Tamil Nadu.
       - Major Sporting Events (Cricket, Football) this week.
    3. **"Plan My Week"**: Create a fun, curated 7-day plan (starting Today).

    Output JSON Format (Strict JSON only, no markdown blocks):
    {{
        "timeline": [
            {{
                "date": "YYYY-MM-DD",
                "dayLabel": "Monday (Today)",
                "items": [
                    {{
                        "id": "unique_id",
                        "type": "movie|event|festival|alert|sport",
                        "title": "Leo Release",
                        "subtitle": "In Theaters",
                        "description": "Short 1-line description.",
                        "tags": ["Tamil", "Action"]
                    }}
                ]
            }}
            // Generate for next 7 days. If a day has no specific event, suggest a generic activity (e.g. "Try a new restaurant").
        ],
        "sections": {{
            "movies": [ {{ "title": "...", "releaseDate": "...", "language": "..." }} ],
            "festivals": [ {{ "title": "...", "date": "..." }} ],
            "alerts": [ {{ "text": "Heavy Rain expected on Tuesday", "severity": "high|medium|low" }} ] // Infer from headlines or general knowledge
        }},
        "weekly_plan": {{
            "monday": "...",
            "tuesday": "...",
            "wednesday": "...",
            "thursday": "...",
            "friday": "...",
            "saturday": "...",
            "sunday": "..."
        }}
    }}
    """

    try:
        print("Generating Up Ahead data with Gemini...")
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Clean markdown if present
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]

        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error generating data: {e}")
        traceback.print_exc()
        return None

def load_existing_data(filepath):
    """Loads existing JSON data if available."""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading existing data: {e}")
    return None

def merge_data(existing, new_data):
    """
    Merges new data into existing data.
    - Preserves future events from existing data.
    - Adds new events.
    - Deduplicates based on title/id.
    - Filters out past events.
    """
    if not existing:
        return new_data

    merged = {"timeline": [], "sections": {}, "weekly_plan": {}}
    today = datetime.now().date()

    # 1. Merge Timeline
    # Map dates to items
    timeline_map = {}

    # Process existing timeline
    if "timeline" in existing:
        for day in existing["timeline"]:
            try:
                date_obj = datetime.strptime(day["date"], "%Y-%m-%d").date()
                if date_obj >= today: # Only keep today and future
                    timeline_map[day["date"]] = day
            except ValueError:
                continue

    # Process new timeline
    if "timeline" in new_data:
        for day in new_data["timeline"]:
            date_str = day["date"]
            if date_str not in timeline_map:
                timeline_map[date_str] = day
            else:
                # Merge items for the same day
                existing_items = timeline_map[date_str].get("items", [])
                new_items = day.get("items", [])

                # Simple deduplication by title
                existing_titles = {item.get("title", "").lower() for item in existing_items}

                for item in new_items:
                    if item.get("title", "").lower() not in existing_titles:
                        existing_items.append(item)

                timeline_map[date_str]["items"] = existing_items

    # Convert map back to list and sort
    merged["timeline"] = sorted(timeline_map.values(), key=lambda x: x["date"])

    # 2. Merge Sections (Movies, Festivals, Alerts)
    # Strategy: Merge and accumulate, removing duplicates by title.
    existing_sections = existing.get("sections", {})
    new_sections = new_data.get("sections", {})
    merged_sections = {}

    all_keys = set(existing_sections.keys()) | set(new_sections.keys())

    for key in all_keys:
        e_list = existing_sections.get(key, [])
        n_list = new_sections.get(key, [])

        # Deduplicate by title (case-insensitive)
        seen_titles = set()
        merged_list = []

        # Process existing items first
        for item in e_list:
            title = item.get("title", "").strip().lower()
            if title and title not in seen_titles:
                seen_titles.add(title)
                merged_list.append(item)

        # Add new items if not already present
        for item in n_list:
            title = item.get("title", "").strip().lower()
            if title and title not in seen_titles:
                seen_titles.add(title)
                merged_list.append(item)

        merged_sections[key] = merged_list

    merged["sections"] = merged_sections

    # 3. Weekly Plan - Always take the new one as it's context-aware for "This Week"
    merged["weekly_plan"] = new_data.get("weekly_plan", existing.get("weekly_plan", {}))

    return merged

def main():
    print("Starting Up Ahead Script...")

    headlines = fetch_rss_feeds()

    # Generate new data
    new_data = generate_up_ahead_data(headlines)

    if not new_data:
        print("AI Generation failed. Attempting fallback generation from RSS...")
        new_data = generate_fallback_data(headlines)

    if not new_data:
        print("Fallback generation failed.")
        if not os.path.exists(OUTPUT_FILE):
             print("No existing data. Exiting.")
             return
        print("Keeping existing data.")
        return

    # Load existing
    existing_data = load_existing_data(OUTPUT_FILE)

    # Merge
    final_data = merge_data(existing_data, new_data)

    # Add metadata
    final_data["lastUpdated"] = datetime.now().isoformat()

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"Success! Data merged and saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
