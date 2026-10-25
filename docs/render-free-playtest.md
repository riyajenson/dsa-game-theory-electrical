# Render Free multiplayer playtest

This is a disposable public test target, separate from the persistent OCI pilot. One Render **Free Web Service** runs one Node process, the three locally built C++ CLIs, and SQLite under `/tmp/signalbound`. The only deploy source is the dedicated `render-free-playtest` branch. No disk, database service, paid compute, PR, or OCI change belongs to this target.

## Design and acceptance

1. `render.yaml` declares exactly one native Node web service, `plan: free`, one instance, a pinned Node version, native `npm run check` build, `node server.js` start, and `/api/health` readiness. The build compiles C++ on Render's actual Linux CPU; no AArch64 release archive is transferred. A clean local Debian 12 container follows the same commands before push.
2. `SIGNALBOUND_ENV=render-test` requires Render's `RENDER=true` and assigned `RENDER_EXTERNAL_URL`, a public `0.0.0.0:$PORT` listener, `TRUST_PROXY=render`, and an absolute temporary SQLite directory. The origin is the exact assigned HTTPS origin and becomes the sole allowed browser and WSS origin. Existing `production` remains loopback-only for OCI; `local` remains local.
3. The edge terminates TLS; Node checks the forwarded HTTPS protocol and public Host. Guest bearer tokens remain scoped to room members in browser local storage. There are no cookies to misconfigure. Existing room limits, message validation, and one-action-per-player checks remain in effect. A visible test banner on Solo, multiplayer, and dashboard warns that scores and rooms may disappear.
4. Active matches interrupted by a process restart remain unranked if the ephemeral database survives. If Render discards the filesystem on restart, even the interrupted marker and completed leaderboard disappear. Neither case awards a completed result for the interrupted match.
5. Verification: focused configuration/proxy/banner tests first; native and Node suite; clean Linux build/start and smoke; local TLS/WSS two-client round flow; then only this branch is pushed. The Render dashboard must show Free, one service, no disk/database, and no paid upgrade before creation. Public HTTPS/WSS checks follow deployment, with the phone-on-mobile-data step left to the user.

## Operational notes

Render's [Free limits](https://render.com/docs/free) include idle spin-down and loss of local files on restart, redeploy, or spin-down. On 25 October 2026, Render documents a 15-minute idle window; an incoming HTTP request or WebSocket message can keep the instance active. Cold start can take about a minute. Usage and billing limits are account-specific; inspect the workspace before creation. Render's [web service docs](https://render.com/docs/web-services), [WebSocket docs](https://render.com/docs/websocket), [runtime tools](https://render.com/docs/native-runtimes), and [default environment variables](https://render.com/docs/environment-variables) are the sources for this design.
