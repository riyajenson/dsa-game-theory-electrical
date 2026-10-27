# Sensor Network RPG workflow

This is a project workflow note, not an installed Codex skill.

1. Inspect the active branch and relevant branches, working tree, code, docs, tests, and current behavior. Verify phase-6 before selecting a base.
2. Scope one local single-player milestone with a visible player experience and acceptance criteria. Defer accounts, rooms, leaderboards, and Oracle hosting.
3. Design a versioned turn contract, seed, legal actions, AI behavior, scoring, and asset provenance. Keep C++ authoritative.
4. Build sequentially in coherent increments. Preserve existing changes and give readable action and route feedback.
5. Verify engine/API behavior, full checks, start-to-result and restart play, desktop and narrow layouts, and the final diff.
6. Make descriptive local micro-commits for verified work. Report run commands, test results, and the next milestone.

Do not use subagents. Do not push, merge, open PRs, deploy, provision cloud resources, or add secrets without explicit user direction.
