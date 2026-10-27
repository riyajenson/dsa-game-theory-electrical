# Signalbound report evidence map

**Baseline:** `phase-6` at `c60da0e` (25 October 2026). This map separates code facts, prior recorded QA, illustrative examples, and checks run for this report. “Earlier” means evidence already present in the repository or prior local QA artifacts; it is not a fresh run during report authoring.

| Report claim or figure | Primary evidence | Qualification |
| --- | --- | --- |
| Three modes and engine boundary | `server.js`; `src/SimulationRunner.cpp`; `src/GameSession.cpp`; `src/MultiplayerSession.cpp`; `game/game.js`; `game/multiplayer.js`; `dashboard/` | Dashboard action counts and Solo/Multiplayer packet delivery have different semantics. |
| Node fields, four actions, clamps, utility, selfish threshold | `src/GameTheoryEngine.h`, `src/GameTheoryEngine.cpp`; `tests/EnergyPlannerTests.cpp` | Multiplayer unused Relay special case is in `src/MultiplayerSession.cpp`. |
| Dijkstra, additive energy/reputation costs, strict tie update | `src/NetworkGraph.cpp`; `tests/NetworkGraphTests.cpp` | Complexity is analysis of the implementation, not a benchmark. |
| Six-link batch topology, default five-round results, route and planner comparison | `src/SimulationRunner.cpp`, `src/SimulationMetrics.cpp`, `src/EnergyPlanner.cpp`; `docs/result-analysis.md`; fresh `./simulation_cli.exe --rounds 5 --strategy mixed` output inspected during the report's source review | 25/20 and 80% count batch operations, not end-to-end live packets. The 4.40 value is the selected path's physical link sum in the batch output. |
| Solo eight rounds, profile, surge, legality, preview, score | `src/GameSession.cpp`; `src/GameSession.h`; `tests/GameSessionTests.cpp`; `docs/signalbound-balance.md` | Solo Relay is available on even rounds only. |
| Solo sampled balance | `tests/GameBalanceTests.cpp`; `docs/signalbound-balance.md` | 100 seeds per profile; 600 candidate plans per profile, with 600/500/100 wins. Sampled plan family, not an optimal-policy claim. |
| Solo browser controls, visuals, prior QA | `game/game.js`, `game/art.js`, `game/audio.js`, `game/polish.css`; `scripts/browser-qa.js`; `README.md` | Prior Chrome QA at 1440 and 390 px, not rerun for this report. No Solo screenshot is included because the earlier artifact was not available in this worktree. |
| Multiplayer routing, packet checks, actions, score, result | `src/MultiplayerSession.cpp`; `tests/MultiplayerSessionTests.cpp` | Every intermediate human node must Relay during that round. |
| Room state machine, deadline, host rights, hidden actions, snapshot and ordered events | `room-server.js`; `tests/multiplayer-server.test.js`; `game/multiplayer.js`; `docs/multiplayer-design.md` | Figures 1–2 are original explanatory diagrams distilled from code, not recorded runtime traces. |
| Session, HTTP/WS bounds, origin/proxy checks, generic errors and health | `server.js`, `room-server.js`, `deployment-config.js`; `tests/server.test.js`, `tests/multiplayer-server.test.js`, `tests/deployment-config.test.js` | Guest token is browser-held; no person-level identity. |
| Schema, idempotent match save, eligibility, restart interruption | `migrations/001_matches.sql`, `migrations/002_active_rooms.sql`, `match-store.js`, `room-server.js`; `tests/multiplayer-server.test.js` | Active turns are not checkpointed for resumption. |
| Online SQLite backup and restore | `scripts/sqlite-backup.js`; `tests/sqlite-backup.test.js`; `docs/oci-pilot-runbook.md` | Earlier isolated restore recovered one completed match and two leaderboard rows. |
| Figures 3, 5, 6, 7 | `docs/report-assets/multiplayer-*.png`, copied from earlier `%TEMP%/signalbound-multiplayer-qa/` Chrome screenshots made by `scripts/multiplayer-browser-qa.js`; QA description in `README.md` | Recorded prior desktop/390 px browser views. Figure 7 is a viewport, not a physical phone. |
| Figure 4 | `docs/report-assets/dashboard.png`, copied from `docs/screenshots/dashboard-desktop.png` | Recorded repository screenshot. |
| Two-client TLS/WSS result, restart, release, backup, rollback | `scripts/rehearse-local.js`; `docs/oci-pilot-runbook.md` “Local Arm and operations rehearsal”; earlier local rehearsal output | Node clients behind local TLS, not a fresh two-browser session or public service. |
| Arm emulation and remaining native check | `.github/workflows/arm-release-check.yml`; `scripts/build-release.sh`; `docs/oci-pilot-runbook.md` | Docker/QEMU ran AArch64 ELF on x86; OCI A1 hardware and Arm CI remain unverified. |
| OCI shape and non-deployment status | `infra/oci/`; `deploy/`; `docs/oci-pilot-runbook.md`; branch history through `c60da0e` | No tenancy-specific plan or apply; actual availability and charges cannot be inferred locally. |
| Literature context | Report references [R1]–[R9], each linked to an author, publisher, project, university, or OCI primary source | Accessed 25 October 2026. Comparisons describe positioning, not tested superiority. |

## Report-pass verification record

- Inspected clean worktree and recent commits: `git status --short --branch`, `git log -3 --oneline`; baseline was `c60da0e`.
- Read C++ engine, room/server/store, browser flow, package scripts, tests, design docs, README, OCI runbook, release workflow, and screenshots before drafting.
- Opened the primary literature and official simulator/OCI pages cited in the report on 25 October 2026. A publisher page for one conference paper was not necessary because its author/university-hosted text was available; no unsupported experimental performance comparison was imported.
- Built the PDF with `py scripts/render-project-report.py`; syntax-checked the renderer with `py -m py_compile scripts/render-project-report.py`; checked whitespace with `git diff --check`. PyMuPDF inspection found 12 nonempty A4 pages and zero text blocks outside the page bounds. A rendered contact sheet and full-resolution pages 3, 4, 5, 11, and 12 were visually inspected; the diagram labels and unsupported subscript glyphs were corrected before the final build. No application behavior changed, so the full application test suite was not repeated during report authoring.

## Deliberate evidence gaps

- No real OCI tenancy-specific Terraform plan, OCI A1 machine test, public DNS/TLS, or public two-device WSS game has occurred.
- No physical radio data or comparative user study validates educational effect or real-network performance.
- Prior browser QA was Chrome on Windows. The earlier local WSS operational rehearsal used Node clients and an emulated Arm container.
