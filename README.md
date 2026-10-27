# Signalbound / GridMind

Signalbound is a local, turn-based pixel-art sensor-network game. You control Spark-01 while C++-controlled sensors decide whether to cooperate. Deliver packets across a changing graph without exhausting your battery or losing trust. The original GridMind simulation dashboard remains available for analysis.

## Run locally

Requirements: Windows, Node.js 18 or newer, and `g++` with C++11 support on `PATH`. No npm dependencies or internet connection are needed after checkout.

```powershell
npm.cmd start
```

Open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) for the game. Open [http://127.0.0.1:3000/dashboard](http://127.0.0.1:3000/dashboard) for the existing analysis dashboard. The launcher compiles both C++ CLIs when needed, then serves both pages and APIs on loopback.

## Play

- Deliver at least **6 packets in 8 rounds**, finish with **60% or more reputation**, and keep energy above zero. Spark-01 starts with 28 energy and 55% trust.
- Choose **Ally Grid** (cooperative AI), **Fault Line** (mixed AI), or **Blackout** (selfish AI) on the title screen. The same seed and profile replay the same run.
- **Transmit** sends your packet from node 1 to terminal 5 through the risk-aware route. Intermediate AI sensors must choose Relay. Cost: 4 energy. A failed transmission lowers reputation; a successful own-packet delivery earns extra score.
- **Relay** forwards a neighbor packet on even rounds. Cost: 3 energy; success raises reputation. **Sleep** restores 1.5 energy but lowers trust by 0.10. **Idle** costs 0.3 energy and lets a packet expire.
- Select with pointer or keys `1`-`4`. The C++ preview gives the exact next-turn outcome before **Enter** or **Confirm Action**. Press **P** to pause and **Escape** to resume. Replay the same seed, try a new one, or change network profile from the pause/results screens.
- Hover a sensor for energy, trust, and strategy. Pale dashes mark the physical shortest route; mint marks the risk-aware route; coral marks interference. Gold beacons and `!` badges flag suspicious sensors. The packet animation, failure stop, delivery burst, log, and effect panel use the C++ turn response.
- Mute and volume controls are optional and persist in local browser storage. Reduced-motion settings shorten the turn presentation.

The address bar includes the seed and profile (`/?seed=17&profile=mixed`). The stateless game API replays seed, profile, and ordered action history. The UI never computes rules or score. Send this body to `POST /api/game`:

```json
{"schemaVersion":2,"seed":17,"profile":"mixed","actions":["TRANSMIT","RELAY"]}
```

The response includes nodes, links, routes, history, previews, score, and result status. `POST /api/simulations` retains the phase-6 dashboard contract. See [first-playable design](docs/first-playable-design.md), [polish plan](docs/signalbound-polish-plan.md), and [balance record](docs/signalbound-balance.md).

## Test

```powershell
npm.cmd test
npm.cmd run check
```

The test command compiles and runs native planner, routing, metrics, batch runner, game session, and 100-seed balance tests; runs Node API/launcher tests and dashboard assertions; and checks game client syntax. Browser checks cover desktop and 390-pixel widths, start-to-win, start-to-loss, pause, restart, API recovery, and sound preference persistence.

The browser QA script needs Node.js 22 or newer for its built-in WebSocket client. Start the app, then start a separate hidden Chrome with remote debugging on port 9223 and run the script:

```powershell
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profile = '--user-data-dir=' + (Join-Path $env:TEMP 'signalbound-browser-qa')
Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--remote-debugging-port=9223','--remote-allow-origins=*',$profile,'about:blank') -WindowStyle Hidden
node scripts/browser-qa.js
```

The script saves title, game, and result screenshots under the system temporary directory. Milestone verification: `npm.cmd test` passed all native suites and 10 Node tests; `npm.cmd run check` passed; Chrome browser QA passed at 1440 and 390 pixels. Seed 17 mixed won with 6/8 packets and score 734 after two Transmits, four Relays, and two Idles; eight Idles lost. The 100-seed, three-profile sweep found a winning plan in every sampled start, with 600/500/100 winning candidate plans out of 600 for cooperative/mixed/selfish. This sampled sweep does not guarantee every seed or player policy.

Both viewport sizes completed a full win, loss, and restart. Additional browser checks passed for reduced motion, keyboard confirmation, mute/volume persistence, API failure recovery, and retrying a failed turn without dropping earlier turns. Final title, map, resolution, and results screenshots were inspected. Verification used Windows and Chrome; other browsers are not yet certified. Refresh starts the same seed again; in-progress saves are not included. Audio is short synthesized effects only, with no music track.

## Architecture

- `src/GameTheoryEngine.*`: utility-based node decisions and reputation.
- `src/NetworkGraph.*`: weighted graph and shortest/energy-aware routes.
- `src/EnergyPlanner.*`: memoized finite-horizon DP and greedy comparison.
- `src/SimulationMetrics.*`: packet, energy, lifetime, and strategy aggregation.
- `src/SimulationRunner.*`: deterministic scenario and JSON contract.
- `src/GameSession.*`: seeded turn replay, legality, AI turns, delivery, scoring, result, and preview.
- `src/game_cli.cpp`: game JSON CLI. The existing simulation CLI still powers the dashboard.
- `server.js`: dependency-free loopback APIs and static server.
- `game/`: original code-native pixel sprites, terrain, packet/status effects, title, tutorial, turn feedback, optional Web Audio cues, and results.
- `dashboard/`: existing simulation and reporting view.

## Assets and licenses

Spark-01, four distinct AI/terminal sprites, terrain, relay ruins, interference, route, packet, and delivery effects are original code-native SVG/CSS in `game/art.js` and `game/polish.css`. The title Spark sprite is original CSS art. Sound cues are synthesized at runtime with Web Audio in `game/audio.js`; no external audio files or generated bitmap assets are used. The bundled **Press Start 2P** font comes from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/pressstart2p) and **Space Grotesk** from [Florian Karsten's repository](https://github.com/floriankarsten/space-grotesk). Both use SIL Open Font License 1.1; license texts are in `game/assets/`. Fonts are served locally for offline play.

## Future milestones

This release has no accounts, save database, rooms, leaderboard, or cloud dependency. A later milestone can add private rooms with server-authoritative matches. Player identity, persistent match history, and leaderboards should follow after match rules and replay validation are stable. Oracle Cloud deployment is a separate future hosting task.
