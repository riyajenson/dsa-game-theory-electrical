# Project Phases

## Branching Strategy

Each major phase is developed on its own branch. The `main` branch contains only the high-level project overview. This keeps the project history clean and makes each stage easy to review.

## Phase 1: Game Theory Foundation

Branch: `phase-1`

Goal:

Build the base game-theory model for node decision-making.

Includes:

- C++ project setup
- sensor node data model
- node actions and strategies
- utility calculation
- cooperative vs selfish behavior
- reputation update
- selfish-node detection
- repeated-game demo
- sample output
- phase documentation

## Phase 2: Graph and Routing Engine

Branch: `phase-2`

Goal:

Represent the sensor network as a weighted graph and implement routing.

Planned work:

- adjacency list graph
- weighted edges
- source and sink node selection
- Dijkstra's algorithm
- priority queue-based shortest path
- energy-aware route cost

## Phase 3: DP Energy Planner

Branch: `phase-3`

Goal:

Use dynamic programming to optimize node decisions over repeated rounds.

Planned work:

- DP state using round and remaining energy
- action transitions for relay, transmit, sleep, and idle
- long-term utility maximization
- comparison with greedy utility decisions

## Phase 4: Simulation Metrics

Branch: `phase-4`

Goal:

Add measurable performance analysis.

Planned work:

- packet delivery ratio
- average residual energy
- total energy consumed
- network lifetime
- selfish event count
- cooperative vs selfish strategy comparison

## Phase 5: Dashboard and Visualization

Branch: `phase-5`

Goal:

Create a visual interface for presenting the simulation.

Planned work:

- node graph visualization
- energy-level display
- route display
- metric charts
- selfish node alerts

## Phase 6: Final Report and Polish

Branch: `phase-6`

Goal:

Prepare the final submission version.

Planned work:

- final report
- screenshots
- result analysis
- code cleanup
- presentation support
- final testing

