# Source Module

## Purpose

This folder contains the C++ implementation for the game-theory decision engine and the Phase 2 graph routing engine.

## Files

- `GameTheoryEngine.h` defines the sensor node data model, strategies, actions, and decision engine interface.
- `GameTheoryEngine.cpp` implements utility calculation, action selection, reputation updates, and selfish-node detection.
- `NetworkGraph.h` defines the weighted sensor network graph and routing result interfaces.
- `NetworkGraph.cpp` implements adjacency-list graph storage, Dijkstra shortest path, and energy-aware route selection.
- `main.cpp` runs the repeated-game demo and the graph routing demo.

## Compile

From the project root:

```powershell
g++ -std=c++11 src/main.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp -o game_theory_demo.exe
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

## Save Demo Output

```powershell
.\game_theory_demo.exe | Tee-Object -FilePath sample-output\game-theory-demo-output.txt
```

## Current Scope

The current module supports game-theory decisions and graph-based routing. Dynamic programming planning, full simulation metrics, and dashboard visualization are planned for later phases.

