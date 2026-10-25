# Render Free multiplayer playtest

This is a disposable public test target, separate from the persistent OCI pilot. One Render **Free Web Service** runs one Node process, the three locally built C++ CLIs, and SQLite under `/tmp/signalbound`. The only deploy source is the dedicated `render-free-playtest` branch. No disk, database service, paid compute, PR, or OCI change belongs to this target.

## Design and acceptance

1. `render.yaml` declares exactly one native Node web service, `plan: free`, one instance, a pinned Node version, `sh scripts/check-render-linux.sh` build, `node server.js` start, and `/api/health` readiness. The build compiles C++ on Render's actual Linux CPU and verifies ELF machine type and CLI startup; no AArch64 release archive is transferred. A clean local Debian 12 container follows the same commands before push.
2. `SIGNALBOUND_ENV=render-test` requires Render's `RENDER=true` and assigned `RENDER_EXTERNAL_URL`, a public `0.0.0.0:$PORT` listener, `TRUST_PROXY=render`, and an absolute temporary SQLite directory. The origin is the exact assigned HTTPS origin and becomes the sole allowed browser and WSS origin. Existing `production` remains loopback-only for OCI; `local` remains local.
3. The edge terminates TLS; Node checks the forwarded HTTPS protocol and public Host. Guest bearer tokens remain scoped to room members in browser local storage. There are no cookies to misconfigure. Existing room limits, message validation, and one-action-per-player checks remain in effect. A visible test banner on Solo, multiplayer, and dashboard warns that scores and rooms may disappear.
4. Active matches interrupted by a process restart remain unranked if the ephemeral database survives. If Render discards the filesystem on restart, even the interrupted marker and completed leaderboard disappear. Neither case awards a completed result for the interrupted match.
5. Verification: focused configuration/proxy/banner tests first; native and Node suite; clean Linux build/start and smoke; local TLS/WSS two-client round flow; then only this branch is pushed. The Render dashboard must show Free, one service, no disk/database, and no paid upgrade before creation. Public HTTPS/WSS checks follow deployment, with the phone-on-mobile-data step left to the user.

## Operational notes

Render's [Free limits](https://render.com/docs/free) include idle spin-down and loss of local files on restart, redeploy, or spin-down. On 25 October 2026, Render documents a 15-minute idle window; an incoming HTTP request or WebSocket message can keep the instance active. Cold start can take about a minute. Usage and billing limits are account-specific; inspect the workspace before creation. Render's [web service docs](https://render.com/docs/web-services), [WebSocket docs](https://render.com/docs/websocket), [runtime tools](https://render.com/docs/native-runtimes), and [default environment variables](https://render.com/docs/environment-variables) are the sources for this design.

## Build and start

The checked-in [Blueprint](../render.yaml) declares **one** native Node web service, `plan: free`, `numInstances: 1`, no disk, no database resource, and automatic deploys off. `.node-version` pins Node 24.21.0. Render's native Debian 12 runtime includes `g++`; `sh scripts/check-render-linux.sh` logs `uname -m`, builds all three CLIs with `npm run check`, verifies their ELF machine type against that actual architecture, and executes a tiny request through each. Start is `node server.js`. The server binds `HOST=0.0.0.0` and Render's injected `PORT` (normally 10000) only in `render-test` mode. Render's `RENDER_EXTERNAL_URL` supplies the exact HTTPS origin; it is not checked into source. `/api/health` tests all three CLIs and SQLite readiness; `/api/live` is liveness only.

No packages need `npm install` in this repository. On a clean Linux copy, the exact build/start commands are:

```sh
sh scripts/check-render-linux.sh
RENDER=true RENDER_EXTERNAL_URL=https://signalbound-test.onrender.com \
  SIGNALBOUND_ENV=render-test HOST=0.0.0.0 PORT=10000 \
  TRUST_PROXY=render SIGNALBOUND_DATA_DIR=/tmp/signalbound \
  COOKIE_MODE=none node server.js
```

The URL above is a **local example for startup checks**, not a reserved or deployed hostname. Render itself sets `RENDER` and `RENDER_EXTERNAL_URL`; operators must not invent them in its dashboard. The web service's public URL may have a generated suffix. `render-test` rejects a missing or non-HTTPS Render URL, wrong host/bind address, wrong proxy setting, a non-temporary data path, or inconsistent override origins. For production OCI, keep `SIGNALBOUND_ENV=production`, loopback binding, `TRUST_PROXY=loopback`, and persistent storage as in the [OCI runbook](oci-pilot-runbook.md).

## Local verification

From the `render-free-playtest` branch:

```powershell
npm.cmd run check
npm.cmd test
$tree = git write-tree
$qa = Join-Path $env:TEMP 'signalbound-render-clean'
New-Item -ItemType Directory -Force -Path $qa | Out-Null
git archive --format=tar -o (Join-Path $qa 'source.tar') $tree
tar -xf (Join-Path $qa 'source.tar') -C $qa
docker run --rm --platform linux/amd64 -v "${qa}:/app" -w /app node:24.21.0-bookworm sh scripts/check-render-linux.sh
```

Use a fresh `$qa` path for each rehearsal so a previous ELF cannot mask a failed build. The container runs **x86_64 Linux**, not OCI's aarch64 release. For a local start, mount the clean build and pass the example Render variables above to `docker run ... node server.js`; publish the port to `127.0.0.1` only. Supply `Host: signalbound-test.onrender.com` and `X-Forwarded-Proto: https` from a local test client to emulate Render's TLS edge. This does not constitute a public HTTPS/WSS check. The [existing local TLS proxy QA](../README.md) and Render-specific HTTP/WS tests cover the protocol boundary. No AArch64 bundle is used.

## Create the one Free service

1. Push **only** `render-free-playtest`. In Render, sign in normally and inspect the workspace's free hours, bandwidth/pipeline use, billing controls, and any payment or automatic-upgrade setting. Stop if the proposed service cannot remain on Free or a paid charge is required. Do not enter credentials in the repository or chat.
2. Use **New → Blueprint** against this repository and branch, review the `render.yaml` preview, and confirm it proposes exactly **one Free Web Service** and no database, disk, preview environment, or paid component. Alternatively create a single Free **Web Service** manually from this branch using the exact fields in `render.yaml`. Do not create both.
3. Confirm automatic deploys/upgrades to paid compute are off, the health path is `/api/health`, and the initial deploy uses the pinned Node version. Capture the assigned `https://…onrender.com` URL. If Render offers only a paid plan or asks for a charge, stop before Create.
4. Open `URL/api/health`; expect HTTP 200 and four readiness booleans `true`. Run `node scripts/smoke.js URL` locally. Verify `URL/`, `URL/multiplayer`, `URL/dashboard`, and the guest leaderboard. The pages display a **TEMPORARY PUBLIC TEST** notice.
5. In two independent HTTPS browser sessions, create and join by the six-character code, ready both players, start, refresh one browser mid-match, allow one action deadline to fill Idle, finish all eight rounds, inspect results and leaderboard, and start a rematch. Confirm that the browser network connection is `wss://…onrender.com/ws`. Do not claim a phone test until the second device actually uses mobile data.

To replay the test from a phone, disable Wi-Fi, open the same HTTPS URL in the phone browser, select **Multiplayer → Join room**, enter the room code from the laptop, and choose a distinct guest name. Ready both devices, start on the laptop (host), and choose one action per device each round. A refresh with intact browser storage reclaims the same sensor while the service instance and its room are alive.

## Data loss, recovery, redeployment, and shutdown

SQLite is `/tmp/signalbound/matches.sqlite` and is **disposable**. Completed-match rows and leaderboard entries can vanish on a restart, redeploy, or idle spin-down; a newly started instance can show an empty leaderboard. Guest tokens in browser storage cannot restore a room whose ephemeral database disappeared. If only the process restarts and the temporary filesystem survives, an active room is marked **interrupted and unranked** and can reopen; if the filesystem is reset, the room is gone entirely. A running browser should be ready to re-create a room after a cold start. Render Free currently spins down after 15 minutes without inbound HTTP or WebSocket messages; the first visit after idle can take roughly a minute. Do not present this target as persistent or use its leaderboard as a durable record.

Automatic deploys are off to avoid unintended match resets. To redeploy, push a reviewed commit to the test branch, then use **Manual Deploy → Deploy latest commit** in the single Render service. Re-run health, smoke, and a two-device match. For shutdown, suspend or delete that service in the Render dashboard, then remove the dedicated remote test branch when the playtest is over if desired. Deleting the service discards its local SQLite data; no off-service backup is expected for this disposable target. Do not delete the OCI configuration. To move back to a durable single VM, build the correct native CLIs on that VM/architecture, restore `SIGNALBOUND_ENV=production`, loopback host and `TRUST_PROXY=loopback`, set the persistent mounted data path and exact public origin, install TLS/WSS proxy and systemd, and follow the OCI runbook's health and backup checks. The Render test database is not a migration source of record.
