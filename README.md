# Signalbound / GridMind

Signalbound is a pixel-art sensor-network game with separate Solo and live multiplayer modes. The C++ engine owns legal actions, routing, energy, reputation, delivery, and scoring. The original GridMind analysis dashboard remains available.

## Run locally

Requirements: Windows, Node.js **24 or newer** (for built-in SQLite and WebSocket browser QA), and `g++` with C++11 support on `PATH`. No npm package dependencies are needed.

```powershell
npm.cmd start
```

Open [Solo](http://127.0.0.1:3000/), [Multiplayer](http://127.0.0.1:3000/multiplayer), or the [analysis dashboard](http://127.0.0.1:3000/dashboard). The launcher compiles the three C++ CLIs when needed and serves them on loopback. For another device on the same LAN, bind to the network and use the host machine's LAN address:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '3000'
npm.cmd start
```

Allow the selected port through the host firewall as appropriate. Completed matches use SQLite at `data/matches.sqlite` by default. Set `SIGNALBOUND_DB_PATH` to an absolute path on a persistent volume to change it. Migration `migrations/001_matches.sql` runs automatically; database and WAL files are git ignored. `TURN_SECONDS` changes the default timer for local testing; production lobby choices are 20–90 seconds.

## Multiplayer rooms and rules

1. Enter a name and create a room. Share the six-character code with one to three other people. Each guest gets one fixed node in the same map. The lobby shows assigned nodes, names, connections, ready states, and timer setting. The host starts when everyone is ready.
2. In each of eight simultaneous rounds, privately choose Transmit, Relay, Sleep, or Idle. The first accepted choice locks. Everyone submitting resolves immediately; otherwise the timer fills missing actions with Idle. Other players see only who has submitted until resolution. The map then animates packets and shows actions, route changes, battery, trust, score effects, and plain-language failure reasons.
3. The network wins at least **6 deliveries in 8 rounds**. Results show the network outcome, each player's contribution and rank, and an opt-in rematch. If a player has left or disconnected, the host can reopen the lobby under the same code and invite a replacement. The leaderboard retains eligible completed performances across server restarts.

Transmit creates one packet from your node to terminal 05 along the C++ energy-aware route. Every intermediate sensor must choose Relay that round, or the packet stops at the first refusal. Low energy, low reputation, and one seeded interference link can alter the route. Transmit costs **4** energy and changes reputation by **+0.02** on delivery or **−0.03** on failure. Relay costs **3**, forwards all delivered packets routed through your node, and raises reputation **0.06** if helpful; an unused Relay costs energy with no trust gain. Sleep restores **1.5** energy, lowers reputation **0.10**, and counts as selfish. Idle costs **0.3**. A sensor needs enough energy to Transmit or Relay. Values stay in 0–100 energy and 0–1 reputation.

Individual score is `20 × own deliveries + 12 × packets relayed + 4 × helpful relay rounds + floor(10 × reputation) + floor(energy / 5) − 5 × sleeps`. Relay can open a teammate's route and earn multiple packet rewards; Transmit can score well on a direct route but block another packet that needs your node. Sleep may preserve later options at an immediate trust and score cost. Ranking breaks ties by own deliveries, packets relayed, final reputation, and lower node number.

A refresh reclaims your node with a random 256-bit guest token kept in browser local storage; the server stores its hash in memory and, for a started match, in SQLite until that match ends or its interrupted lobby reopens. Clearing browser storage loses the identity. A server restart **interrupts active matches without ranking them**; returning guests see the reason and may reopen the lobby. Lobby-only rooms expire on restart. Completed matches and leaderboard rows persist. A disconnected or departed node defaults to Idle at deadlines. An inactive lobby expires after 30 minutes; a match with all players gone is abandoned after two empty rounds. A completed match is leaderboard eligible only when each participant had at least one accepted action and fewer than two consecutive rounds had no accepted action. Ineligible results are stored for audit. Each match ID inserts once; repeated finish requests cannot add scores. The leaderboard lists the top 50 individual match performances. Ties use own deliveries, packets relayed, final reputation, earliest completion, then lower node number. Guest names are not accounts; there is no account recovery or anti-collusion control.

## Multiplayer API and replay

`POST /api/rooms` with `{"name":"Ada"}` creates a room; `POST /api/rooms/CODE/join` joins. Each returns `{roomId,token,nodeId}`. `GET /api/leaderboard` lists eligible scores. `GET /api/matches/MATCH_ID` returns seed, ordered action record, engine schema, and final JSON. `GET /api/health` reports CLI and storage readiness.

Connect to same-origin `/ws`. Client messages use `v:1`, `type`, and `roomId`. Begin with `{"v":1,"type":"hello","roomId":"ABC234","token":"...","afterSeq":0}`. The server sends a current `snapshot` with your node and private accepted action. Ordered events include `roomId`, `matchId`, `seq`, `round`, `type`, and `data`; reconnect or sequence gaps recover by snapshot. Public `submitted` events reveal only a boolean. `accepted` is private. `round_resolved` contains authoritative C++ output. Intents are `ready`, `settings`, `start`, `action`, `leave`, `rematch`, and `reopen`; an action includes current match ID, round, and action name, never a node ID or computed totals. Server checks message shape, membership, host privilege, action legality, size, rate, and duplicates.

Saved records contain a deterministic seed and ordered action letters (`T/R/S/I` for each assigned node, comma-separated rounds). Replay after building with `multiplayer_cli.exe --seed 17 --players 2 --rounds TR,II`. The same binary and record yield identical engine output. SQLite tables are `matches`, `match_players`, and `schema_migrations`.

## Solo play

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

The test command compiles and runs native planner, routing, metrics, batch runner, Solo, 100-seed balance, and multiplayer tests. Node tests cover HTTP and WebSocket rooms, private simultaneous actions, timeout, duplicate submission, reconnect, SQLite persistence across restart, deterministic replay, and leaderboard idempotence. Dashboard assertions and client syntax checks also run. Node 24 currently prints an experimental warning for its built-in SQLite module.

For Solo browser QA, start the app, then start a separate hidden Chrome with remote debugging on port 9223 and run:

```powershell
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profile = '--user-data-dir=' + (Join-Path $env:TEMP 'signalbound-browser-qa')
Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--remote-debugging-port=9223','--remote-allow-origins=*',$profile,'about:blank') -WindowStyle Hidden
node scripts/browser-qa.js
```

The script saves title, game, and result screenshots under the system temporary directory. In the earlier Solo milestone, Chrome browser QA passed at 1440 and 390 pixels. Seed 17 mixed won with 6/8 packets and score 734 after two Transmits, four Relays, and two Idles; eight Idles lost. The 100-seed, three-profile sweep found a winning plan in every sampled start, with 600/500/100 winning candidate plans out of 600 for cooperative/mixed/selfish. This sampled sweep does not guarantee every seed or player policy.

For multiplayer QA, start the server on port 3000 with `$env:TURN_SECONDS='3'` for a short test deadline. Launch two independent Chrome profiles, then run the script in another terminal:

```powershell
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profileA = '--user-data-dir=' + (Join-Path $env:TEMP 'signalbound-multi-a')
$profileB = '--user-data-dir=' + (Join-Path $env:TEMP 'signalbound-multi-b')
Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--remote-debugging-port=9223','--remote-allow-origins=*',$profileA,'about:blank') -WindowStyle Hidden
Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--remote-debugging-port=9224','--remote-allow-origins=*',$profileB,'about:blank') -WindowStyle Hidden
node scripts/multiplayer-browser-qa.js
```

The script creates and joins a room, refreshes the second browser mid-match and on results, waits for a timeout, finishes eight rounds, checks rematch, checks desktop and 390-pixel widths for overflow, and writes screenshots to `%TEMP%\signalbound-multiplayer-qa`.

Both viewport sizes completed a full win, loss, and restart. Additional browser checks passed for reduced motion, keyboard confirmation, mute/volume persistence, API failure recovery, and retrying a failed turn without dropping earlier turns. Final title, map, resolution, and results screenshots were inspected. Verification used Windows and Chrome; other browsers are not yet certified. Refresh starts the same seed again; in-progress saves are not included. Audio is short synthesized effects only, with no music track.

## Architecture

- `src/GameTheoryEngine.*`: utility-based node decisions and reputation.
- `src/NetworkGraph.*`: weighted graph and shortest/energy-aware routes.
- `src/EnergyPlanner.*`: memoized finite-horizon DP and greedy comparison.
- `src/SimulationMetrics.*`: packet, energy, lifetime, and strategy aggregation.
- `src/SimulationRunner.*`: deterministic scenario and JSON contract.
- `src/GameSession.*`: seeded Solo turn replay, legality, AI turns, delivery, scoring, result, and preview.
- `src/MultiplayerSession.*`: seeded simultaneous multiplayer replay, energy-aware routes, legal actions, packet outcomes, and per-node scoring.
- `src/game_cli.cpp`: game JSON CLI. The existing simulation CLI still powers the dashboard.
- `server.js`, `room-server.js`: HTTP APIs, versioned WebSocket rooms, membership, deadlines, and snapshots.
- `match-store.js`, `migrations/`: SQLite completed match records and leaderboard.
- `game/`: original code-native pixel sprites, terrain, packet/status effects, Solo and multiplayer UI, optional Solo Web Audio cues, and results.
- `dashboard/`: existing simulation and reporting view.

## Assets and licenses

Spark-01, four distinct AI/terminal sprites, terrain, relay ruins, interference, route, packet, and delivery effects are original code-native SVG/CSS in `game/art.js` and `game/polish.css`. The title Spark sprite is original CSS art. Sound cues are synthesized at runtime with Web Audio in `game/audio.js`; no external audio files or generated bitmap assets are used. The bundled **Press Start 2P** font comes from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/pressstart2p) and **Space Grotesk** from [Florian Karsten's repository](https://github.com/floriankarsten/space-grotesk). Both use SIL Open Font License 1.1; license texts are in `game/assets/`. Fonts are served locally for offline play.

## Hosting later

### Temporary Render Free playtest

The dedicated `render-free-playtest` branch has a [single-service Free Blueprint](render.yaml) and [playtest runbook](docs/render-free-playtest.md). Its native Node 24.21.0 build compiles the C++ CLIs on Render's Linux CPU; `node server.js` starts one room process on Render's `PORT`. Render supplies its own HTTPS URL and WSS upgrade proxy. The `render-test` mode derives the sole allowed origin from `RENDER_EXTERNAL_URL`, binds `0.0.0.0`, and stores SQLite under `/tmp/signalbound`. It issues no cookies; room guest tokens stay in browser local storage. The pages visibly label this deployment as a temporary test.

Run `npm run check` and `npm test` before pushing that branch. The build command is `sh scripts/check-render-linux.sh`, start command `node server.js`, and health path `/api/health`. The required Blueprint variables are `SIGNALBOUND_ENV=render-test`, `HOST=0.0.0.0`, `TRUST_PROXY=render`, `SIGNALBOUND_DATA_DIR=/tmp/signalbound`, `COOKIE_MODE=none`, and `TURN_SECONDS=30`; Render injects `PORT`, `RENDER`, and `RENDER_EXTERNAL_URL`. The Blueprint declares one Free service with no disk or database and automatic deploys off. Inspect the Render plan and workspace billing controls before creation. Run `node scripts/smoke.js https://<assigned-host>.onrender.com` after deploy.

**All rooms, match records, and leaderboard history on Render Free may disappear on restart, redeploy, or idle spin-down.** A live match never earns a completed result when interrupted. Render currently documents spin-down after 15 minutes without inbound traffic and a cold start that can take about a minute. Use the runbook for public two-browser play, refresh/timeout/rematch checks, manual redeploy, and service deletion. This playtest is separate from the durable OCI pilot below; no OCI resource or setting is needed for Render.

The [OCI pilot runbook](docs/oci-pilot-runbook.md) and [Terraform configuration](infra/oci/main.tf) prepare one Ubuntu 24.04 Arm VM, a persistent SQLite volume, systemd, and nginx TLS/WSS. No cloud resources were provisioned or deployed. Production requires `SIGNALBOUND_ENV=production`, `PUBLIC_ORIGIN=https://<dns>`, matching `ALLOWED_ORIGINS`, `TRUST_PROXY=loopback`, `HOST=127.0.0.1`, and absolute persistent `SIGNALBOUND_DATA_DIR` and `SIGNALBOUND_DB_PATH`; see [environment example](deploy/signalbound.env.example). `COOKIE_MODE=none` reflects bearer sessions in local storage. Active matches become visibly interrupted and unranked after a restart; completed matches and the guest leaderboard persist. Use one server process. A second process needs a shared room coordinator.

For a local HTTPS/WSS proxy test on Windows, generate a short-lived self-signed certificate outside this repository (OpenSSL from Git for Windows is shown):

```powershell
$qa = Join-Path $env:TEMP 'signalbound-oci-tls-qa'
New-Item -ItemType Directory -Path $qa -Force | Out-Null
& 'C:\Program Files\Git\usr\bin\openssl.exe' req -x509 -newkey rsa:2048 -nodes -days 1 -keyout (Join-Path $qa 'key.pem') -out (Join-Path $qa 'cert.pem') -subj '/CN=127.0.0.1' -addext 'subjectAltName=IP:127.0.0.1'
```

In terminal 1, set `$env:TURN_SECONDS='3'`, `$env:SIGNALBOUND_DB_PATH=Join-Path $qa 'matches.sqlite'`, and run `node server.js`. In terminal 2, set `$env:TLS_CERT=Join-Path $qa 'cert.pem'` and `$env:TLS_KEY=Join-Path $qa 'key.pem'`, then run `node scripts/local-tls-proxy.js`. In terminal 3, launch two isolated Chrome profiles as in the browser QA section above, adding `--ignore-certificate-errors` to both; set `$env:QA_BASE_URL='https://127.0.0.1:3443'` and run `node scripts/multiplayer-browser-qa.js`. This test proxy forwards Host, Origin, protocol, and WebSocket Upgrade. It does not issue a public certificate. `node scripts/smoke.js http://127.0.0.1:3000` checks Solo, multiplayer, dashboard, liveness, readiness, and leaderboard.
