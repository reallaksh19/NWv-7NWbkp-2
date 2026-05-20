# Planner / Up Ahead Benchmarks

This folder contains fixed-date benchmark fixtures for comparing Up Ahead and Planner logic.

## Benchmark anchor
- `as_of_date`: `2024-11-26`
- planner window: next **7** days, inclusive through `2024-12-03`

## Files
- `planner_upahead_online_input_100.json`: 100 mixed online-like feed items; date sense required, location ignored.
- `planner_upahead_online_expected_output.json`: expected surfaced set for the online run.
- `planner_upahead_offline_input_100.json`: 100 mixed offline/location-sensitive feed items with locality aliases.
- `planner_upahead_offline_expected_output.json`: expected surfaced set for the offline run.

## Coverage
- categories: `offer`, `airline_offer`, `event`, `movie`, `alert`
- mixed date formats
- fuzzy/typo-heavy values
- publish-date vs occurrence-date separation
- items before the 7-day window and more than 20 days after the anchor date
- locality aliases such as `T Nagar`→`Chennai`, `Al Khuwair`→`Muscat`, `Srirangam`→`Trichy`
