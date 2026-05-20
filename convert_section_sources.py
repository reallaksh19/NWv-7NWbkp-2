import json

with open('config/section_sources.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

new_sections = {}
for section_name, feeds in data['sections'].items():
    new_feeds = []
    for entry in feeds:
        if isinstance(entry, list) and len(entry) >= 5:
            new_feeds.append({
                "url": entry[0],
                "source": entry[1],
                "sourceGroup": entry[2],
                "tier": entry[3],
                "topic": entry[4]
            })
        elif isinstance(entry, dict):
            # Already converted — normalize "name" -> "source" if needed
            if "name" in entry and "source" not in entry:
                entry["source"] = entry.pop("name")
            new_feeds.append(entry)
    new_sections[section_name] = new_feeds

data['sections'] = new_sections

with open('config/section_sources.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

print('Converted', len(new_sections), 'sections to object format with source key')
