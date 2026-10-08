# Signalbound polish milestone

## Baseline observed at `e51df5b`

- The worktree is clean. The existing Chrome QA reaches a win (seed 17, five deliveries), a loss (eight Idle turns), and restart at desktop and 390 px without horizontal overflow.
- The map is legible but looks like a diagram: every tower uses nearly the same shape, terrain is a flat checkerboard, and turn effects mostly appear in the log. The mobile action tray starts below the map and player card.
- In seeds 0–39, a straightforward plan with four even-round Relays and one odd-round Transmit wins on 20 seeds. Relay is currently guaranteed and cheaper than Transmit. Only a seeded mixed AI composition is selectable.
- The browser has no sound preference, little loading/error treatment, and no focused turn-resolution moment.

## Work sequence

1. **Measure and tune the C++ game.** Add cooperative, mixed, and selfish AI profiles to a versioned replay contract. Use a deterministic seed sweep and focused engine/API tests to find unwinnable starts and dominant actions. Adjust only supported rules, document exact changes, and keep previews and scoring in C++.
2. **Give the world characters and reactions.** Draw original pixel-grid Spark-01 and distinct AI silhouettes, relay bases, terrain, terminals, interference, packet trails, low-battery and suspicious states in SVG/CSS. Animate the engine-reported packet route and turn outcome; honor reduced-motion settings.
3. **Make the eight-round flow clear.** Add a title/setup screen, compact tutorial, visible remaining rounds and win conditions, action preview, a turn-resolution panel with the engine's cause and deltas, deliberate pause/results/restart states, and useful loading/API-error recovery. Improve mobile action access and keyboard focus.
4. **Add optional sound.** Generate restrained effects with Web Audio, add mute and volume controls, and persist the preference locally. No audio is required to play.
5. **Verify and report.** Run native and API tests plus `npm.cmd test` and `npm.cmd run check`. Replay wins and losses at desktop and 390 px, inspect screenshots, fix visual defects, review the diff, update README/provenance/results, and make local coherent commits.

No accounts, rooms, leaderboards, cloud resources, pushes, merges, or changes to the phase-4 worktree are in scope.
