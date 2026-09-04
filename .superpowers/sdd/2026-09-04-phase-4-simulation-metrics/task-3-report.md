# Phase 4 Task 3 Report: Simulation Metrics Demonstration

## Scope

Implemented Task 3 in the isolated `phase-4-task-3` worktree. The task adds
a deterministic Phase 4 console demonstration while preserving the existing
Phase 1 game-theory and Phase 2 routing demonstrations.

## Changes

- Included `SimulationMetrics.h` in `src/main.cpp`.
- Added `runMetricsDemo()` and called it after the existing demo functions.
- Created two explicit, copied `SensorNode` snapshots. The second round is a
  copy of the first with deterministic energy changes, including a node at
  zero energy.
- Recorded the two rounds exclusively through `SimulationMetrics::recordRound`
  and rendered aggregate values from `SimulationMetrics::getResult()`.
- Added cooperative and selfish comparison rows using the returned strategy
  metrics; no aggregation logic was duplicated in `main.cpp`.
- Regenerated `sample-output/game-theory-demo-output.txt` from the compiled
  executable.

## Deterministic Scenario and Expected Results

Round 1 records 12 attempted and 10 delivered packets. Round 2 records 9
attempted and 7 delivered packets. The node snapshots contain cooperative and
selfish strategies; the selfish node qualifies as selfish in both rounds, and
a cooperative node reaches zero energy in round 2.

The resulting metrics are:

- Total attempted packets: 21
- Total delivered packets: 17
- Packet delivery ratio: 80.95%
- Average residual energy: 54.17
- Network lifetime round: 2
- Selfish event count: 2
- Cooperative: 4 observations, 48.50 average energy, 0 selfish events
- Selfish: 2 observations, 65.50 average energy, 2 selfish events

## Verification

Initial end-to-end output expectation was run before the implementation and
failed because the Phase 4 section did not exist. After implementation, the
following command compiled the demo, checked every required deterministic
output value, and regenerated the sample output:

```powershell
g++ -std=c++11 src/main.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o game_theory_demo.exe
```

Then the executable was run with an output assertion covering the label, all
required aggregate values, and both strategy rows, followed by:

```powershell
.\game_theory_demo.exe | Tee-Object -FilePath sample-output\game-theory-demo-output.txt
```

The compiler and executable both exited with code 0. The verified output
contains the complete Phase 4 metrics section while retaining the prior Phase
1 and Phase 2 sections.

## Files Changed

- `src/main.cpp`
- `sample-output/game-theory-demo-output.txt`
- `.superpowers/sdd/2026-09-04-phase-4-simulation-metrics/task-3-report.md`
