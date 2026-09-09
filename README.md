# GridMind

GridMind is an end-to-end demonstration of game-theoretic, energy-aware routing in a distributed sensor network. The C++ core models node decisions, Dijkstra routing, dynamic-programming energy planning, and multi-round metrics. A local Node.js API runs that simulation and feeds an interactive browser dashboard.

## Run the dashboard

Requirements: Node.js 18 or newer and g++ with C++11 support.

```powershell
npm.cmd start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The launcher compiles the simulation CLI when needed, starts the local API, and serves the dashboard. Choose 1–20 rounds and a cooperative, selfish, or mixed strategy.

## Test everything

```powershell
npm.cmd test
```

This compiles and runs the planner, routing, metrics, and simulation suites, followed by the API, launcher, and dashboard tests.

## Architecture

- `src/GameTheoryEngine.*`: utility-based node decisions and reputation.
- `src/NetworkGraph.*`: weighted graph and shortest/energy-aware routes.
- `src/EnergyPlanner.*`: memoized finite-horizon DP and greedy comparison.
- `src/SimulationMetrics.*`: packet, energy, lifetime, and strategy aggregation.
- `src/SimulationRunner.*`: deterministic scenario and JSON contract.
- `server.js`: dependency-free local API and static server.
- `dashboard/`: responsive live dashboard.

This release is intentionally local-only and stateless.
