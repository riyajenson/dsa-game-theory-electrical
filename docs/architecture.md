# Project Architecture

## Architecture Overview

The project is designed as a modular software simulation. Each module handles one responsibility so that the system can grow phase by phase without mixing routing, game theory, metrics, and visualization logic.

## High-Level Flow

```text
Sensor Network Input
        |
        v
Graph and Node State Model
        |
        v
Game Theory Decision Engine
        |
        v
Routing and Packet Simulation
        |
        v
Metrics and Strategy Comparison
        |
        v
Dashboard and Final Reports
```

## Core Modules

### 1. Node Model

Stores the state of each virtual sensor node, including node ID, energy, reputation, relay requests, successful relays, selfish decisions, and strategy type.

### 2. Game Theory Engine

Calculates utility values for each possible node action. It selects the action with maximum utility and updates energy and reputation after each decision.

### 3. Graph Model

Planned for Phase 2. This module will represent the sensor network as a weighted graph. Nodes will represent sensors, and edges will represent communication links with energy or distance cost.

### 4. Routing Engine

Planned for Phase 2. This module will use Dijkstra's algorithm and priority queues to find low-cost routes from source nodes to the sink node.

### 5. DP Energy Planner

Planned for Phase 3. This module will use dynamic programming to optimize repeated energy decisions over multiple simulation rounds.

### 6. Metrics Engine

Planned for Phase 4. This module will calculate packet delivery ratio, residual energy, network lifetime, selfish event count, and strategy comparison results.

### 7. Dashboard

Planned for Phase 5. The dashboard will visualize the network, node energy, routes, metrics, and suspicious nodes.

## Current Phase 1 Architecture

```text
DecisionContext
        |
        v
GameTheoryEngine
        |
        +--> calculate utilities
        +--> choose best action
        +--> update energy and reputation
        +--> detect selfish nodes
        |
        v
Repeated Game Demo
```

Phase 1 intentionally focuses only on the game-theory core. Graph routing, DP planning, and dashboard features will be added later.

