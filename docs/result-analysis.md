# Result Analysis

The default five-round mixed scenario attempts 25 packet operations and delivers 20, producing an 80% delivery ratio. Average residual energy across all observations is 66.30%; the final-round node average is 62.10%. No node is depleted, so network lifetime remains active.

The selfish node conserves energy by sleeping while its reputation falls to zero. After enough observations it is flagged as suspicious, creating three selfish-event observations. Cooperative nodes consistently relay and finish with stronger reputation but lower energy.

The link-weight shortest path is `1 → 2 → 5` with cost 2.00. Energy-aware routing avoids the low-trust selfish relay and chooses `1 → 3 → 4 → 5` with cost 4.40. Minimum link cost is therefore not necessarily the most reliable network path.

For the default horizon, DP and greedy both select relay actions and produce equal utility and residual energy, so the simpler greedy plan is recommended. DP remains valuable when future contexts make immediate utility conflict with longer-term energy preservation.
