# First Playable Implementation Plan

**Goal:** Deliver a local single-player game from seeded start to result and restart.

**Architecture:** Add a C++ replayable turn engine and JSON CLI mode, expose it through the existing local server, and build a separate pixel-art game page. Preserve the dashboard at `/dashboard`.

**Tech Stack:** C++11, Node.js 18+, browser HTML/CSS/JavaScript without new dependencies.

**Spec:** `docs/first-playable-design.md`

## Tasks

1. Add native turn model and focused tests for action legality, replay, AI decisions, routing, effects, and outcomes. Compile and run the focused test, then commit.
2. Add versioned CLI/API contract and Node validation tests. Run native/API checks, then commit.
3. Add original code-native pixel map, action tray with authoritative previews, turn feedback, tutorial, pause/restart, result screen, and dashboard link. Check keyboard/pointer interaction and both viewport sizes, then commit.
4. Update README, review the diff, run the full suite, and manually play start-to-result and restart. Commit documentation and any verified corrections.

## Review focus

- Empty action history returns a playable initial state.
- Invalid or excess actions cannot bypass terminal status.
- Low energy disables costly actions with a reason.
- Identical seed and actions yield identical output.
- Existing `/api/simulations` and dashboard continue to work.
