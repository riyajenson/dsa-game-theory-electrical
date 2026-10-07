# First playable: Signalbound

## Player experience and acceptance

The player is node 1, a small courier tower in an eight-round network crisis. Each round presents a packet request and four actions. The player previews the exact next-turn consequence, commits one action, watches packet and route feedback, and tries to deliver at least five packets while keeping energy above zero and reputation at least 0.55. A loss can also occur immediately when energy reaches zero. A result screen shows the engine's score, delivery counts and ratio, energy, rounds, and selfish decisions. Restart with the same seed reproduces the run.

## Screens and art

The game opens on a top-down map rendered with crisp SVG rectangles, pixel-aligned tiles, and nearest-neighbor image scaling. Relay towers, terminals, paths, interference, packet pulses, and a player sprite use original CSS/SVG primitives and a small navy, teal, amber, and coral palette. Press Start 2P and Space Grotesk are bundled under SIL Open Font License 1.1, with license files in `game/assets/`. The game screen contains the map, packet goal, route legend, status, action tray, turn log, pause and restart. An analysis link opens the existing dashboard at `/dashboard`. Layout stacks on narrow screens. Sound is deferred: no audio assets are required for this release.

## Authoritative boundary and contract

`POST /api/game` accepts `{ "schemaVersion": 1, "seed": integer 0..999999, "actions": ["TRANSMIT"|"RELAY"|"SLEEP"|"IDLE", ...] }`. The server validates size and syntax then invokes the C++ CLI with seed and ordered action history. The CLI replays from initial state for every request; there is no mutable server session or JavaScript scoring. The response contains version, seed, round, status, objective, nodes, links, shortest and energy-aware routes, current packet, last turn, full turn history, score/results, and next-action previews with legality, reason, energy/reputation deltas, delivery, and route. Actions after a terminal result are invalid. Repeating the same seed and action list produces identical JSON.

## Rules and AI

The graph is the phase-6 five-node topology. The player starts with 28 energy and 0.65 reputation. Each round offers a player packet from node 1 to terminal 5 for TRANSMIT. A neighbor's packet through node 1 to terminal 3 is available for RELAY on even rounds. TRANSMIT costs 4 energy and succeeds only when all intermediate AI nodes on the energy-aware route choose RELAY; RELAY costs 3 and delivers its packet. SLEEP recovers 1.5 but costs 0.10 reputation and records a selfish decision; IDLE costs 0.3 and lets the packet expire. The existing `applyActionResult` owns all energy/reputation changes. Action legality checks energy and packet availability before applying it. AI nodes use existing `chooseBestAction` with their current state and route context. A seeded mix of cooperative and selfish profiles plus seeded interference changes link weights each round. Routing uses `NetworkGraph`; shortest and energy-aware paths are recomputed from current nodes and link weights. Failed transmission consumes energy and lowers reputation through existing rules. The dashboard's batch simulation remains unchanged; the game uses one requested packet per round and its own explicit win condition.

Score is `100 * delivered + 20 * deliveryRatio + remainingEnergy + 50 * reputation - 10 * selfishDecisions`, rounded to an integer in C++. Delivery ratio is delivered / attempted. The game counts one attempted packet each round, including Sleep and Idle. No persistence or save file is included; the seed and action history are the replay format.

## Validation

Native tests cover legal actions, deterministic replay, AI profile decisions, route/delivery effects, energy/reputation, result thresholds, and serialization. API tests cover contract validation and process errors. Existing native, Node, and dashboard checks must remain green. Manual inspection covers a full win/loss path, restart, desktop, and narrow layout.

## Base and integration risk

The clean phase-6 worktree contains the runner, DP planner, JSON CLI, API, and dashboard, and is five commits ahead of phase-4. The primary phase-4 working tree has unrelated modified and untracked files; this milestone is developed in phase-6's existing worktree without merging or overwriting those changes.
