# Project Summary

## Title

Game-Theoretic Simulation of Energy-Aware Routing in Distributed Sensor Networks

## Brief Summary

This project is a purely software-based DSA project implemented mainly in C++. It simulates a distributed sensor network where each sensor node has limited energy and behaves as a game-theoretic player. A node can choose to transmit, relay, sleep, or stay idle. The decision is made using a utility-based model that considers delivery reward, energy cost, delay penalty, and reputation.

The current Phase 1 implementation focuses on the game-theory decision engine. It compares cooperative and selfish node behavior, updates reputation values, and flags selfish nodes based on relay behavior.

## Objectives

- Model sensor nodes as rational game-theoretic players.
- Define possible node actions: transmit, relay, sleep, and idle.
- Calculate utility values for each action.
- Select the best action based on maximum utility.
- Compare cooperative and selfish strategies.
- Update energy and reputation after each decision.
- Detect selfish nodes using cooperation ratio, energy, and reputation.
- Build a clean foundation for later graph routing, DP planning, and simulation metrics.

## Primary Data Structures

- `struct SensorNode` for node state.
- `enum class NodeAction` for node actions.
- `enum class NodeStrategy` for cooperative or selfish behavior.
- `struct DecisionContext` for decision parameters.
- `vector<ActionUtility>` for storing utility values.

## Phase 1 Scope

Phase 1 does not implement full network routing yet. It focuses only on the core game-theory model that will later be connected to graph-based routing and simulation modules.

