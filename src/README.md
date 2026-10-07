# C++ Simulation Core

The source layer owns all domain behavior and has no HTTP dependency.

- `GameTheoryEngine`: action utilities, action effects, reputation, and selfish-node detection.
- `NetworkGraph`: weighted graph plus shortest and energy-aware routes.
- `EnergyPlanner`: memoized finite-horizon DP and greedy comparison.
- `SimulationMetrics`: delivery, energy, lifetime, and selfish-event aggregation.
- `SimulationRunner`: deterministic five-node scenario and dashboard JSON.
- `simulation_cli.cpp`: CLI validation and JSON output.
- `GameSession`: seeded player turn replay, AI decisions, action previews, scoring, and game JSON.
- `game_cli.cpp`: replay CLI for the versioned local game API.

Use `npm.cmd test` from PowerShell to compile and run every suite, or `npm.cmd run check` to compile both CLIs.
