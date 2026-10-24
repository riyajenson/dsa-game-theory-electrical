# Game Theory Model

## Players

Each virtual sensor node is treated as a player. Every player has its own energy level, reputation score, relay history, and strategy type.

## Strategies

The current implementation supports two strategy types:

- **Cooperative:** gives higher importance to packet delivery and network contribution.
- **Selfish:** gives higher importance to saving its own energy.

## Actions

Each node can choose one of four actions:

- **Transmit:** send its own packet.
- **Relay:** forward another node's packet.
- **Sleep:** save energy while refusing to participate.
- **Idle:** remain active without transmitting or relaying.

## Utility Function

The decision engine follows the idea:

```text
Utility = Benefit - Cost - Penalty
```

For example, relay utility depends on:

- delivery reward
- reputation benefit
- relay energy cost
- selfish resistance

Sleep utility depends on:

- sleep recovery benefit
- low-energy urgency
- network penalty for refusing to help

The node calculates utility for all available actions and selects the action with the highest utility.

## Reputation Update

Reputation increases when a node helps the network by relaying successfully. Reputation decreases when a node avoids relaying by sleeping during a relay request.

## Selfish Node Detection

A node is flagged as selfish when:

```text
relay requests >= 3
cooperation ratio < 0.45
energy > 30
reputation < 0.55
```

This means the node had enough energy to help but repeatedly avoided cooperation.

## Why This Fits Game Theory

The model captures conflict between individual benefit and network benefit. A selfish node tries to preserve its own energy, while a cooperative node improves packet delivery. The repeated-game setup makes reputation important because present decisions affect future trust.

