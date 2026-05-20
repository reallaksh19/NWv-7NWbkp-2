# Defect Tracking Matrix

- ID: P001
  Area: Planner classification
  Severity: High
  Owner file(s): src/intelligence/classification.js
  Detection: benchmark offline + planner_edgecases
  Exit gate: planner precision >= 0.85, no regression in smoke suite

- ID: P002
  Area: Market Data Completeness
  Severity: Medium
  Owner file(s): src/services/indianMarketService.js, public/data/market_snapshot.json
  Detection: test_market_snapshot_integrity.mjs
  Exit gate: Snapshot integrity test asserts more than just indices, checks commodities/currencies.

- ID: P003
  Area: Cascading Renders & Static Errors
  Severity: High
  Owner file(s): src/App.jsx, src/components/DebugConsole.jsx, src/pages/TechSocialPage.jsx
  Detection: npm run lint
  Exit gate: 0 errors, 0 warnings

- ID: P004
  Area: Date and Location Routing
  Severity: High
  Owner file(s): src/intelligence/dateAware.js, src/intelligence/locationAware.js
  Detection: benchmark online_input_100.json
  Exit gate: online Up Ahead precision >= 0.82, offline planner recall >= 0.75

- ID: P005
  Area: Static Host Truthfulness
  Severity: Medium
  Owner file(s): src/runtime/runtimeCapabilities.js, src/pages/MainPage.jsx
  Detection: Visual verification and smoke test
  Exit gate: No silent degradation, explicit feature status flags rendered

