# Source Module

## Purpose

This folder contains the C++ implementation for the Phase 1 game-theory decision engine, the Phase 2 graph routing engine, and the Phase 4 simulation metrics engine.

## Files

- `GameTheoryEngine.h` defines the sensor node data model, strategies, actions, and decision engine interface.
- `GameTheoryEngine.cpp` implements utility calculation, action selection, reputation updates, and selfish-node detection.
- `NetworkGraph.h` defines the weighted sensor network graph and routing result interfaces.
- `NetworkGraph.cpp` implements adjacency-list graph storage, Dijkstra shortest path, and energy-aware route selection.
- `SimulationMetrics.h` defines explicit round observations and result structures for packet, energy, lifetime, and strategy metrics.
- `SimulationMetrics.cpp` aggregates deterministic round observations into Phase 4 metrics.
- `main.cpp` runs the repeated-game, graph-routing, and Phase 4 simulation-metrics demos.

## Compile

From the project root:

```powershell
g++ -std=c++11 src/main.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o game_theory_demo.exe
```

## Run

```powershell
.\game_theory_demo.exe
```

## Run Tests

```powershell
g++ -std=c++11 tests/NetworkGraphTests.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp -o network_graph_tests.exe
.\network_graph_tests.exe
```

```powershell
g++ -std=c++11 tests/SimulationMetricsTests.cpp src/GameTheoryEngine.cpp src/SimulationMetrics.cpp -o simulation_metrics_tests.exe
.\simulation_metrics_tests.exe
```

## Save Demo Output

```powershell
.\game_theory_demo.exe | Tee-Object -FilePath sample-output\game-theory-demo-output.txt
```

## Current Scope

The current module supports Phase 1 game-theory decisions, Phase 2 graph-based routing, and Phase 4 deterministic simulation metrics. Dynamic programming planning, dashboard visualization, persistent simulation data, and richer packet-level simulation remain planned for later phases.

