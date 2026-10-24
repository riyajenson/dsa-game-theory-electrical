# Source Module

## Purpose

This folder contains the Phase 1 C++ implementation of the game-theory decision engine.

## Files

- `GameTheoryEngine.h` defines the data models and engine interface.
- `GameTheoryEngine.cpp` implements utility calculation, action selection, reputation updates, and selfish-node detection.
- `main.cpp` runs a repeated-game demo.

## Compile

From the project root:

```powershell
g++ -std=c++11 src/main.cpp src/GameTheoryEngine.cpp -o game_theory_demo.exe
```

## Run

```powershell
.\game_theory_demo.exe
```

## Save Demo Output

```powershell
.\game_theory_demo.exe | Tee-Object -FilePath sample-output\game-theory-demo-output.txt
```

## Current Scope

This module only handles game-theory decisions. Graph routing, DP planning, and dashboard features are planned for later phases.

