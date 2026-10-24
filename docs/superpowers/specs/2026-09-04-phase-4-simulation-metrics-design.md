# Phase 4 Simulation Metrics Design

## Goal

Add a small, reusable metrics layer for multi-round sensor-network simulations. It will turn explicit packet and node observations into delivery, energy, lifetime, selfish-event, and strategy-comparison results without changing the existing game-theory or routing APIs.

## Scope

Phase 4 will provide:

- Packet delivery ratio from attempted and delivered packets.
- Average residual energy from observed node states.
- Network lifetime as the first round in which any observed node reaches zero energy.
- Selfish-event count using the existing `GameTheoryEngine::isSelfishNode` rule.
- Separate aggregate results for cooperative and selfish nodes.
- A console demonstration and focused unit tests.

It will not add dynamic programming, persistent input files, dashboard code, or a full packet-level network simulator.

## Architecture

`SimulationMetrics` is an observation/aggregation class. A caller records one round at a time by supplying packet counters and the current node states. The class stores only the aggregates needed for the Phase 4 outputs; it does not mutate nodes, choose actions, or calculate routes.

The result object exposes the final calculated metrics and strategy buckets. This keeps metrics independent from `GameTheoryEngine` and `NetworkGraph`, while allowing the existing selfish-node detector to be reused when a round is recorded.

## Data flow

```text
GameTheoryEngine / NetworkGraph / simulation loop
                |
                v
        SimulationMetrics::recordRound
                |
                v
       SimulationMetricsResult::finalize
```

Each round records:

- Round number.
- Number of attempted packets.
- Number of delivered packets.
- Current `SensorNode` snapshots.

Delivery ratio is `delivered / attempted`, returning `0.0` when no packets were attempted. Average residual energy is calculated across all observed node snapshots. Network lifetime is the first recorded round containing a node with energy `<= 0`; if no node dies, the result is `-1`.

## Strategy comparison

For each strategy, metrics are accumulated from the nodes belonging to that strategy:

- Number of node observations.
- Total and average residual energy.
- Number of selfish detections.

The comparison is descriptive and does not claim statistical significance. A node is counted once per recorded round when `isSelfishNode` returns true.

## Error handling

- Negative packet counts are ignored by clamping them to zero.
- Delivered packets are capped at attempted packets for a round.
- Empty node observations produce zero average energy and zero strategy observations.
- Repeated or out-of-order round numbers do not alter aggregate calculations; the lifetime value uses the smallest qualifying round.

## Verification

Tests will cover delivery ratio, energy averaging, lifetime detection, selfish-event counting, strategy aggregation, empty input behavior, and packet-counter normalization. The demo and the existing Phase 2 routing tests must continue to compile and pass.
