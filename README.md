# DSA Game Theory Project

## Title

Game-Theoretic Simulation of Energy-Aware Routing in Distributed Sensor Networks

## Project Overview

This is a purely software-based Data Structures and Algorithms project implemented mainly in C++. The project simulates a distributed sensor network where each sensor node has limited energy and must decide how to behave during communication. A node may transmit its own packet, relay another node's packet, sleep to save energy, or stay idle.

The project uses game theory to model each sensor node as a rational player. Each node calculates utility for its possible actions based on delivery reward, energy cost, delay penalty, reputation, and network contribution. This allows the system to compare cooperative behavior with selfish behavior and detect nodes that avoid helping the network even when they have enough energy.

## Why This Project Matters

Distributed networks often depend on cooperation. If every node only tries to save its own energy, packet delivery can fail and the overall network becomes unreliable. This project studies that conflict using a software simulation. It connects DSA concepts such as graphs, priority queues, queues, vectors, and dynamic programming with game-theoretic decision-making.

## Current Status

Phase 1 is focused on the game-theory foundation. The current implementation includes:

- C++ game-theory decision engine
- cooperative and selfish node strategies
- utility calculation for transmit, relay, sleep, and idle
- reputation update logic
- selfish-node detection
- repeated-game demo output
- documentation for the project model and roadmap

## Planned Phase Branches

- `phase-1`: project foundation, documentation, and game-theory module
- `phase-2`: graph representation and routing engine
- `phase-3`: DP-based energy decision planner
- `phase-4`: simulation metrics and strategy comparison
- `phase-5`: dashboard and visualization
- `phase-6`: final report and polish

## Repository Rule

The `main` branch is kept as the high-level project overview. Actual implementation work is developed phase by phase on separate branches.

