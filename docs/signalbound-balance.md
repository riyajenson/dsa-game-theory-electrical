# Signalbound rules and balance, contract v2

The game API now accepts `{ "schemaVersion": 2, "seed": 17, "profile": "mixed", "actions": [] }`. Profiles are `cooperative`, `mixed`, and `selfish`. The ordered actions and seed still replay the whole game. The phase-6 dashboard API and batch simulation are unchanged.

## Game-only rule changes

- Win after eight rounds with **at least six delivered packets**, **at least 0.60 reputation**, and energy above zero. Spark-01 begins with 28 energy and 0.55 reputation. The previous five-packet / 0.55 target left too little pressure on energy or routing.
- Cooperative mode makes AI nodes 2–5 cooperative. Mixed mode makes node 2 selfish and, on seeds divisible by five, node 3 selfish. Selfish mode makes nodes 2–5 selfish. Spark-01 remains player-controlled.
- The physical shortest route still uses the six phase-6 links and seeded interference. The game's energy-aware route adds a cost of 6 to each edge touching a selfish intermediate node before calling `NetworkGraph::findEnergyAwareRoute`; that reflects refusal risk without changing the dashboard's routing implementation. Terminal 5 is excluded from this penalty.
- A deterministic **signal surge** occurs when `(seed + round) % 4 < 2` (rounds are 1-based). The existing utility engine receives delivery reward 30 rather than 8 for an AI node asked to relay during a surge. Selfish AI can cooperate during those rounds; the chosen action still comes from `GameTheoryEngine::chooseBestAction`. The state exposes the surge and each AI decision.
- A successful player Transmit adds 35 score points beyond the previous score formula. This rewards a riskier own-packet delivery against the reliable even-round Relay. The engine reports the exact score and turn delta.
- Failed Transmit reports the first AI relay that refused. Node suspicion comes from `GameTheoryEngine::isSelfishNode`. Previews replay the next turn through the same C++ engine, so they include the actual delivery outcome and cause.

## Evidence and remaining balance scope

At `e51df5b`, a simple four-Relay plus one-Transmit plan won on only 20 of seeds 0–39. With the changes above, `GameBalanceTests` checks seeds 0–99 for each profile. It tries all six ways to place two Transmits in odd rounds, with Relays on even rounds and Idle in the remaining slots. Every sampled start has a win. Winning plans total **600/500/100** for cooperative/mixed/selfish, respectively, out of 600 plans per profile. This proves a reachable win for those seeds under that plan family; it does not exhaust every possible player policy or establish subjective difficulty for every seed.
