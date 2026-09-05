# Phase 5 Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free dashboard that visualizes the Phase 2 routes and Phase 4 deterministic metrics and node states in a responsive browser page.

**Architecture:** `dashboard/index.html` defines semantic UI sections and stable IDs; `dashboard/styles.css` defines layout and visual states; `dashboard/app.js` owns the immutable snapshot and DOM render functions. The dashboard is a static frontend with no backend, build tool, network request, or mutation of C++ code.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Node syntax checking, PowerShell static checks.

**Spec:** `docs/superpowers/specs/2026-09-05-phase-5-dashboard-design.md`

## Global Constraints

- The first dashboard uses a deterministic data snapshot matching the Phase 4 demo.
- It does not add persistence, a backend, a build system, a charting dependency, live C++ output parsing, or deployment configuration.
- Use semantic headings, lists, tables/figures where appropriate, and visible labels.
- Energy bars expose `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Suspicious status is conveyed with text and color, never color alone.
- The layout must remain usable on narrow screens without horizontal page scrolling.
- Missing arrays or values must render safe empty states rather than throw during startup.
- No network requests or external assets are permitted.

### Task 1: Create the dashboard document structure

**Files:**
- Create: `dashboard/index.html`

**Interfaces:**
- Provides IDs consumed by `dashboard/app.js`: `node-grid`, `metric-grid`, `route-list`, `strategy-bars`, `last-updated`, and `empty-state`.
- Loads `styles.css` and `app.js` only through relative local paths.

- [ ] **Step 1: Write the semantic page shell**

  Add a page title, dashboard header, metric section, node-state section, route section, strategy-comparison section, and an empty-state element. Use headings and lists/tables where they convey structure.

- [ ] **Step 2: Add accessibility anchors**

  Give each dynamic container an accessible heading relationship and keep the page usable before JavaScript by including a short no-script message.

- [ ] **Step 3: Run static structure checks**

  Confirm the file contains the required IDs, local asset references, and no `http://` or `https://` URLs.

### Task 2: Build the responsive visual system

**Files:**
- Create: `dashboard/styles.css`

**Interfaces:**
- Styles the IDs and classes emitted by `dashboard/app.js`: `.metric-card`, `.node-card`, `.energy-bar`, `.route-card`, `.status-badge`, `.chart-bar`, `.is-alert`, and `.is-muted`.

- [ ] **Step 1: Add the desktop layout and design tokens**

  Define colors, spacing, radii, typography, card surfaces, and a two-column dashboard layout with a compact header.

- [ ] **Step 2: Add node, route, metric, and chart states**

  Make low energy and suspicious nodes visually distinct while keeping labels visible. Style route paths as readable node sequences and chart bars with text values.

- [ ] **Step 3: Add the narrow-screen layout**

  At a narrow breakpoint, collapse grids to one column, keep route paths wrapping, and prevent horizontal page overflow.

### Task 3: Add the deterministic data model and renderers

**Files:**
- Create: `dashboard/app.js`

**Interfaces:**
- `dashboardData.metrics`: Phase 4 aggregate values.
- `dashboardData.nodes`: node snapshots with `id`, `strategy`, `energy`, `reputation`, and `suspicious`.
- `dashboardData.routes`: route objects with `label`, `path`, and `cost`.
- `renderMetrics(metrics)`, `renderNodes(nodes)`, `renderRoutes(routes)`, `renderStrategyBars(nodes)`, and `renderDashboard(data)`.

- [ ] **Step 1: Define the immutable snapshot**

  Encode the verified Phase 4 values: 21 attempted packets, 17 delivered packets, 80.95 delivery percentage, 54.17 average energy, lifetime round 2, two selfish events, the five Phase 2 route-demo nodes, and both route results.

- [ ] **Step 2: Implement safe DOM helpers and metric rendering**

  Render numeric values with fixed formatting, escape text through `textContent`, and show an empty state when data is missing rather than throwing.

- [ ] **Step 3: Implement node and route rendering**

  Render energy progress bars with the required ARIA attributes, visible strategy/suspicious labels, reputation values, and route paths/costs.

- [ ] **Step 4: Implement strategy comparison bars and startup**

  Aggregate average energy by strategy from the node snapshot, render text plus proportional bars, and call `renderDashboard(dashboardData)` only after the DOM is ready.

- [ ] **Step 5: Run JavaScript syntax verification**

  Run:

  ```powershell
  node --check dashboard/app.js
  ```

  Expected: exit code `0`.

### Task 4: Document and verify Phase 5 locally

**Files:**
- Create: `dashboard/README.md`
- Create: `docs/phase-5-checklist.md`
- Modify: `src/README.md`

- [ ] **Step 1: Document local dashboard usage**

  Explain that the dashboard is static, list the files, and give a local-server command that does not require a dependency install.

- [ ] **Step 2: Document Phase 5 scope**

  List completed visualization features and deferred live-data, persistence, and deployment work.

- [ ] **Step 3: Run full verification**

  Run:

  ```powershell
  node --check dashboard/app.js
  rg -n "node-grid|metric-grid|route-list|strategy-bars|progressbar|PHASE 5|Simulation Metrics" dashboard/index.html dashboard/app.js dashboard/README.md docs/phase-5-checklist.md
  g++ -std=c++11 src/main.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o game_theory_demo.exe
  g++ -std=c++11 tests/NetworkGraphTests.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp -o network_graph_tests.exe
  g++ -std=c++11 tests/SimulationMetricsTests.cpp src/GameTheoryEngine.cpp src/SimulationMetrics.cpp -o simulation_metrics_tests.exe
  .\network_graph_tests.exe
  .\simulation_metrics_tests.exe
  .\game_theory_demo.exe
  git diff --check
  ```

  Expected: all commands exit `0`, required dashboard labels exist, and the existing Phase 1–4 output remains present.

- [ ] **Step 4: Commit locally; do not push**

  ```powershell
  git add dashboard docs/phase-5-checklist.md docs/superpowers src/README.md
  git commit -m "phase 5: add local metrics dashboard"
  ```
