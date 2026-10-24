# Phase 2 Completion Checklist

## Completed

- Weighted graph representation added with adjacency lists.
- Sensor nodes represented as graph vertices using the existing `SensorNode` model.
- Communication links represented as weighted undirected edges.
- Dijkstra's algorithm implemented using `std::priority_queue`.
- Standard shortest-route selection added.
- Energy-aware route selection added with penalties for low-energy and low-reputation relay nodes.
- Routing demo added to the main executable.
- C++ routing tests added for shortest path, energy-aware path selection, and unreachable destinations.
- Compile, run, and test instructions updated.
- Demo output updated with routing results.

## Ready for Review

- `NetworkGraph` interface is separated from the game-theory engine.
- Phase 2 builds on Phase 1 without changing the existing decision model.
- Energy-aware routing demonstrates a different route when a weak relay node sits on the cheapest path.

## Not Included in Phase 2

- Dynamic programming energy planner.
- Multi-round packet simulation metrics.
- Packet delivery ratio and network lifetime calculations.
- Dashboard visualization.
- Persistent input files for custom graph topologies.
