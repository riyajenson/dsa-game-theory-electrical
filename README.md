# Signalbound / GridMind

Signalbound is a local, turn-based pixel-art sensor-network game. You control Spark-01 while C++-controlled sensors decide whether to cooperate. Deliver packets across a changing graph without exhausting your battery or losing trust. The original GridMind simulation dashboard remains available for analysis.

## Run locally

Requirements: Windows, Node.js 18 or newer, and `g++` with C++11 support on `PATH`. No npm dependencies or internet connection are needed after checkout.

```powershell
npm.cmd start
```

Open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) for the game. Open [http://127.0.0.1:3000/dashboard](http://127.0.0.1:3000/dashboard) for the existing analysis dashboard. The launcher compiles both C++ CLIs when needed, then serves both pages and APIs on loopback.

## Play

- Deliver at least **5 packets in 8 rounds**, end with **55% or more reputation**, and keep energy above zero.
- **Transmit** sends your packet from node 1 to terminal 5 through the energy-aware route. Intermediate AI sensors must choose Relay for delivery. Cost: 4 energy. A failed transmission also lowers reputation.
- **Relay** forwards a neighbor packet from node 2 through you to terminal 3. Requests arrive on even rounds. Cost: 3 energy; successful relay raises reputation.
- **Sleep** restores 1.5 energy but lowers reputation by 0.10 and counts as a selfish choice. **Idle** costs 0.3 energy while the packet expires.
- Select with a pointer or keys `1`–`4`. The C++ preview shows delivery, route, energy, and reputation effects. Press **Enter** or click **Confirm Action**. Press **P** to pause. Use **Restart** for the same seed, or **New** for another seed.
- Hover a tower for its energy, reputation, and AI profile. The pale dashed path is the shortest route; mint is the energy-aware route; coral marks interference.

The address bar includes the seed (`/?seed=17`). The game API is stateless: the seed plus ordered action history recreates a run. The UI does not compute game rules or score. Send this versioned body to `POST /api/game`:

```json
{"schemaVersion":1,"seed":17,"actions":["TRANSMIT","RELAY"]}
```

The response includes state, nodes, links, routes, history, previews, score, and result status. `POST /api/simulations` keeps the phase-6 dashboard contract unchanged. The rules and boundary are specified in [the first-playable design](docs/first-playable-design.md).

## Test

```powershell
npm.cmd test
npm.cmd run check
```

The test command compiles and runs native planner, routing, metrics, batch runner, and game session tests; runs Node API/launcher tests and dashboard assertions; and checks game client syntax. Browser checks cover desktop and 390-pixel widths, start-to-win, start-to-loss, and restart.

For the browser check, start the app, then start a separate hidden Chrome with remote debugging on port 9223 and run the QA script:

```powershell
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profile = '--user-data-dir=' + (Join-Path $env:TEMP 'signalbound-browser-qa')
Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--remote-debugging-port=9223','--remote-allow-origins=*',$profile,'about:blank') -WindowStyle Hidden
node scripts/browser-qa.js
```

The script checks both widths, pause, keyboard selection, win, loss, and restart, and saves screenshots under the system temporary directory.

## Architecture

- `src/GameTheoryEngine.*`: utility-based node decisions and reputation.
- `src/NetworkGraph.*`: weighted graph and shortest/energy-aware routes.
- `src/EnergyPlanner.*`: memoized finite-horizon DP and greedy comparison.
- `src/SimulationMetrics.*`: packet, energy, lifetime, and strategy aggregation.
- `src/SimulationRunner.*`: deterministic scenario and JSON contract.
- `src/GameSession.*`: seeded turn replay, legality, AI turns, delivery, scoring, result, and preview.
- `src/game_cli.cpp`: game JSON CLI. The existing simulation CLI still powers the dashboard.
- `server.js`: dependency-free loopback APIs and static server.
- `game/`: original SVG/CSS map and sprite art, controls, tutorial, feedback, and results.
- `dashboard/`: existing simulation and reporting view.

## Assets and licenses

Map tiles, towers, the player sprite, route effects, and packet animation are original code-native SVG/CSS in `game/`. No generated or third-party bitmap assets are used. The bundled **Press Start 2P** font comes from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/pressstart2p) and **Space Grotesk** from [Florian Karsten's repository](https://github.com/floriankarsten/space-grotesk). Both use SIL Open Font License 1.1; license texts are in `game/assets/`. Fonts are served locally for offline play.

## Future milestones

This release has no accounts, save database, rooms, leaderboard, or cloud dependency. A later milestone can add private rooms with server-authoritative matches. Player identity, persistent match history, and leaderboards should follow after match rules and replay validation are stable. Oracle Cloud deployment is a separate future hosting task.
