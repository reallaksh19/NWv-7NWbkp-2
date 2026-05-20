import re

with open('scripts/apply_slice43_insight_browser_json_ingestion.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the two replaceOnce blocks that fail:
# 1. 'enrich snapshot pool with collector signals'
# 2. 'keep snapshot stories assignment'
# 3. Modify the 'attach snapshot runtime summary' block to also do the pool mapping.

text = re.sub(
    r"text = replaceOnce\(\s*text,\s*\s*return snapshot;,\s*.*?attach snapshot runtime summary'\s*\);",
    r'''text = replaceOnce(
    text,
        return snapshot;,
        const pool = (snapshot?.stories ?? []).map((story, index) => (
      enrichRawStoryWithSnapshotSignals({
        ...story,
        id: story?.id || story?.url || \\snapshot-story-\\\,
      }, snapshot)
    ));
    snapshot.stories = pool;

    return {
      ...snapshot,
      runtimeSummary: getInsightSnapshotRuntimeSummary(snapshot),
    };,
    'attach snapshot runtime summary and enrich pool'
  );''',
    text,
    flags=re.DOTALL
)

# Remove the next two replaceOnce calls
text = re.sub(
    r"text = replaceOnce\(\s*text,\s*\s*const pool = snapshot\?\.stories \?\? \[\];.*?keep snapshot stories assignment'\s*\);",
    r"",
    text,
    flags=re.DOTALL
)

with open('scripts/apply_slice43_insight_browser_json_ingestion.mjs', 'w', encoding='utf-8') as f:
    f.write(text)

