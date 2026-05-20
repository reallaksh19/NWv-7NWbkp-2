# Insight Behavior Tuning Plan

## Slice:** 11 — Insight Behavior Tuning Plan (Plan-Only Slice)

**Production behavior changed:** No

---

## Current Insight problem statement

Insight scores frequently grade C/D/F due to weak child trees, poor angle diversity, and duplicate pressure from same-source clustering. Before any behavior is tuned, a rigorous diagnostic review must capture the root causes and verify which config knobs are actually responsible.

---

## Current relevant contracts

The following constants govern Insight behavior. **Do not change** any of these as part of Slice 11.

- `MIN_CHILD_INFO_GAIN` — minimum information gain required for a child story to count as useful
- `MAX_PER_SOURCE_GROUP` — maximum children drawn from a single source group per parent
- `MAX_PER_ANGLE` — maximum children sharing the same visible angle per parent
- `MIN_SOURCES_PER_TREE` — minimum distinct source groups required in a child tree to avoid a source-diversity penalty
- `WEAK_TREE_CHILD_MIN` — threshold below which a parent's child count marks the tree as weak
- `SAME_EVENT_THRESHOLD` — cosine similarity threshold above which two stories are treated as the same event
- `POSSIBLE_EVENT_THRESHOLD` — cosine similarity threshold above which two stories are treated as possibly the same event

Debug fields populated on every scored parent:
- `parent.debug.scoreBreakdown` — per-signal breakdown of the composite parent score
- `parent.debug.hiddenCount` — number of candidate children suppressed as duplicates
- `parent.debug.replacements` — rescue replacements applied during variant rescue
- `capturedAtSnapshot` — ISO timestamp marking when the pipeline snapshot was captured

---

## Required diagnostic review before behavior tuning

Before any code in the Insight pipeline is changed for quality reasons, the executing agent **must**:

1. Run the real-snapshot benchmark and capture the output.
2. Record the distribution of grades (A/B/C/D/F) across all scored parents.
3. Identify the top-3 RCA signals driving low grades.
4. Confirm which config constants are the root cause vs. symptom.
5. File the checkpoint report (format below) before proceeding to Slice 12.

---

## Behavior tuning sequence

### Slice 12 — Insight child-tree tuning only

Scope: child tree selection logic only. No changes to parent ranking, dedup thresholds, or source fetching. Target: improve `MIN_SOURCES_PER_TREE` compliance rate.

### Slice 13 — Insight duplicate diagnostics hardening only

Scope: surface `parent.debug.hiddenCount` and `parent.debug.replacements` in the grade popup. No behavior changes to dedup logic.

### Slice 14 — Insight ranking reason clarity only

Scope: expose `parent.debug.scoreBreakdown` in the UI grade panel. No changes to ranking weights or scoring math.

### Slice 15 — First actual behavior tuning

Scope: One behavior change only. Gate: real-snapshot ratchet must remain green after the change. No compound changes allowed.

---

## Explicit non-goals

The following changes are **prohibited** in Slices 11–14:

- Do not change DEFAULT_CONFIG
- Do not change dedup thresholds
- Do not change ranking weights
- Do not change child tree selection
- Do not change source fetching
- Do not claim behavior is improved until real diagnostics prove it

---

## Review checklist before Slice 12

- [ ] Real-snapshot benchmark has been run and output captured
- [ ] Grade distribution documented (A/B/C/D/F counts)
- [ ] Top-3 RCA signals identified
- [ ] Config constants confirmed as root cause
- [ ] Checkpoint report filed (see format below)
- [ ] No production code was changed in Slice 11

---

## Mandatory checkpoint report for executing agent

Before beginning Slice 12, the executing agent must produce a report in the following format:

```
CHECKPOINT RESULT:
- Snapshot date: <ISO date>
- Grade distribution: A=N B=N C=N D=N F=N
- Top RCA signals: [signal1, signal2, signal3]
- Root-cause config constants: [const1, const2]
- Production behavior changed in Slice 11: No
- Ready to proceed to Slice 12: Yes/No
```

Failure to produce this report before Slice 12 begins is a blocking protocol violation.
