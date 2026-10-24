# Phase 4 Simulation Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable C++ metrics layer that aggregates packet delivery, residual energy, network lifetime, selfish events, and cooperative/selfish comparisons across simulation rounds.

**Architecture:** `SimulationMetrics` consumes immutable round observations and produces a `SimulationMetricsResult`. It owns aggregation only; it does not mutate `SensorNode` values, select actions, or compute routes. Strategy-specific totals are accumulated while recording node snapshots, reusing `GameTheoryEngine::isSelfishNode` for selfish-event detection.

**Tech Stack:** C++11, standard library containers, existing `SensorNode` and `GameTheoryEngine` types, assert-based executable tests.

**Spec:** `docs/superpowers/specs/2026-09-04-phase-4-simulation-metrics-design.md`

## Global Constraints

- Preserve the existing Phase 1 and Phase 2 public APIs.
- Use C++11-compatible syntax and standard-library types only.
- Do not add dynamic programming, dashboards, persistence, or external dependencies.
- Negative packet counters are normalized to zero; delivered packets cannot exceed attempted packets.
- Network lifetime is the smallest observed round with any node energy `<= 0`, or `-1` when no node reaches that threshold.

### Task 1: Define metrics interfaces and write failing tests

**Files:**
- Create: `src/SimulationMetrics.h`
- Create: `tests/SimulationMetricsTests.cpp`

**Interfaces:**
- `struct SimulationRoundObservation { int round; int attemptedPackets; int deliveredPackets; std::vector<SensorNode> nodes; };`
- `struct StrategyMetrics { int nodeObservations; double totalResidualEnergy; int selfishEvents; double averageResidualEnergy() const; };`
- `struct SimulationMetricsResult { int totalAttemptedPackets; int totalDeliveredPackets; double packetDeliveryRatio; double averageResidualEnergy; int networkLifetimeRound; int selfishEventCount; StrategyMetrics cooperative; StrategyMetrics selfish; };`
- `class SimulationMetrics { public: void recordRound(const SimulationRoundObservation& observation); SimulationMetricsResult getResult() const; };`

- [ ] **Step 1: Write tests for the public behavior**

  Add tests that record observations and assert:

  ```cpp
  SimulationMetrics metrics;
  metrics.recordRound({1, 4, 3, {cooperativeNode, selfishNode}});
  SimulationMetricsResult result = metrics.getResult();
  assert(result.totalAttemptedPackets == 4);
  assert(result.totalDeliveredPackets == 3);
  assert(nearlyEqual(result.packetDeliveryRatio, 0.75));
  ```

  Cover normal aggregation, energy averaging, lifetime at the first dead-node round, selfish events, strategy buckets, empty input, and negative/over-limit packet normalization.

- [ ] **Step 2: Compile the tests before implementation**

  Run:

  ```powershell
  g++ -std=c++11 tests/SimulationMetricsTests.cpp src/GameTheoryEngine.cpp src/SimulationMetrics.cpp -o simulation_metrics_tests.exe
  ```

  Expected: compilation fails because `SimulationMetrics.cpp` does not exist yet.

### Task 2: Implement the metrics aggregation

**Files:**
- Create: `src/SimulationMetrics.cpp`
- Modify: `src/SimulationMetrics.h`

**Interfaces:**
- `recordRound` normalizes packet counts, sums totals, and updates lifetime with the minimum qualifying round.
- `getResult` returns calculated metrics without mutating stored observations.
- `StrategyMetrics::averageResidualEnergy` returns `0.0` when `nodeObservations == 0`.

- [ ] **Step 1: Implement counter normalization**

  Normalize attempted and delivered counts with `std::max(0, value)`, then cap delivered packets at attempted packets before adding them to totals.

- [ ] **Step 2: Implement node and strategy aggregation**

  For every node snapshot, add its energy to the global total and to the matching cooperative/selfish bucket. Increment `selfishEventCount` and the matching bucket’s `selfishEvents` when `GameTheoryEngine::isSelfishNode(node)` is true.

- [ ] **Step 3: Implement result calculation**

  Return zero delivery ratio for zero attempts, divide total energy by node observations for average energy, and return `-1` if no node has reached zero energy.

- [ ] **Step 4: Run the focused tests**

  Run:

  ```powershell
  g++ -std=c++11 tests/SimulationMetricsTests.cpp src/GameTheoryEngine.cpp src/SimulationMetrics.cpp -o simulation_metrics_tests.exe
  .\simulation_metrics_tests.exe
  ```

  Expected: exit code `0`.

### Task 3: Add the Phase 4 demonstration

**Files:**
- Modify: `src/main.cpp`
- Modify: `sample-output/game-theory-demo-output.txt`

**Interfaces:**
- Add a `runMetricsDemo()` function that creates explicit round observations from copied node states and records packet attempts/deliveries.
- Keep the existing game-theory and routing demos intact.

- [ ] **Step 1: Add a deterministic multi-round metrics scenario**

  Record several rounds containing cooperative and selfish nodes, with at least one round where a node reaches zero energy and with differing delivery counts.

- [ ] **Step 2: Print the metrics result**

  Display packet delivery ratio, average residual energy, network lifetime round, selfish events, and cooperative/selfish comparison rows.

- [ ] **Step 3: Compile and regenerate the demo output**

  Run:

  ```powershell
  g++ -std=c++11 src/main.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o game_theory_demo.exe
  .\game_theory_demo.exe | Tee-Object -FilePath sample-output\game-theory-demo-output.txt
  ```

  Expected: exit code `0` and the output includes the Phase 4 metrics section.

### Task 4: Document and verify Phase 4

**Files:**
- Create: `docs/phase-4-checklist.md`
- Modify: `src/README.md`

- [ ] **Step 1: Document completed and deferred Phase 4 scope**

  List each metric, the observation model, tests, and deferred dashboard/persistence work.

- [ ] **Step 2: Update build and test commands**

  Include `src/SimulationMetrics.cpp` in demo and test compile commands and add the new test executable.

- [ ] **Step 3: Run full verification**

  Run:

  ```powershell
  g++ -std=c++11 src/main.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o game_theory_demo.exe
  g++ -std=c++11 tests/NetworkGraphTests.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp -o network_graph_tests.exe
  g++ -std=c++11 tests/SimulationMetricsTests.cpp src/GameTheoryEngine.cpp src/SimulationMetrics.cpp -o simulation_metrics_tests.exe
  .\network_graph_tests.exe
  .\simulation_metrics_tests.exe
  git diff --check
  git status --short
  ```

  Expected: all compile commands and tests exit `0`, no whitespace errors, and only the intended Phase 4 files are changed.

- [ ] **Step 4: Create one local Phase 4 commit**

  ```powershell
  git add docs/ src/ tests/ sample-output/game-theory-demo-output.txt
  git commit -m "phase 4: add simulation metrics"
  ```

  Do not run `git push`.
