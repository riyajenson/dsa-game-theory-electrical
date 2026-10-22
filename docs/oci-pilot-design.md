# OCI pilot preparation design and plan

## Scope and deployment shape

This is a reviewable, single-VM foundation. No OCI resources, public DNS, or TLS certificates are created in this milestone. One Ubuntu 24.04 Arm VM runs Node 24 and locally compiled C++ CLIs behind Caddy on loopback. The SQLite WAL database lives on a separately attached persistent block volume. Solo, multiplayer, and `/dashboard` share one process. The VM and database are one failure domain; a second process requires a new shared room coordinator.

## Configuration and trust

Local defaults stay loopback HTTP on port 3000. Production requires `SIGNALBOUND_ENV=production`, `PUBLIC_ORIGIN=https://<dns-name>`, `TRUST_PROXY=loopback`, explicit `ALLOWED_ORIGINS`, an absolute persistent `SIGNALBOUND_DB_PATH`, and a private loopback `HOST`. Production rejects direct or improperly forwarded requests. Caddy supplies the external Host, `X-Forwarded-Proto: https`, and WebSocket Upgrade. Browser WebSocket and HTTP use the same origin. Guest tokens remain browser-local bearer tokens; the app issues no cookies. If cookies are introduced later, they must be Secure, HttpOnly, and SameSite. Logs go to stdout/stderr under journald and omit tokens and request bodies.

## Restart policy

Started room ID, match ID, roster token hashes, and last resolved C++ state are stored in a new SQLite table. A server restart changes any unfinished match to `interrupted` before accepting traffic. Reconnecting members see the last resolved state and an explicit interruption reason. Unsubmitted and accepted actions in the interrupted round are discarded; no round is resolved after restart. Interrupted matches never enter `matches` or the leaderboard. A finished match insertion and removal of its active marker happen in the same SQLite transaction, so a crash around completion cannot manufacture or lose an eligible result. A guest may reopen an interrupted room as a fresh lobby with a new match ID. Lobby-only rooms are ephemeral and a reconnect sees that its session expired.

## Infrastructure and operations

Pinned OCI provider configuration describes one VCN, public subnet and internet gateway, one A1 Flex VM, one attached block volume, and ingress 80/443 plus SSH from a supplied CIDR. The app port stays loopback. Cloud-init installs only base tools; operator steps install a pinned Node 24 release, build on Arm, mount the volume, and start the pinned release. Caddy obtains TLS once DNS resolves. The runbook uses SQLite's online backup API and a restore integrity check; a raw WAL-mode file copy is prohibited. Infrastructure state, credentials, and volume contents stay outside Git. Actual image OCID, tenancy quota, capacity, pricing, and plan need OCI access at the later gate.

## Sequential implementation checks

1. Add portable native build/test scripts and Arm CI; run local tests and commit.
2. Add production configuration, forwarded-origin checks, liveness/readiness, and proxy tests; run focused/full tests and commit.
3. Add the interruption migration and restart UI, test crash/restart and leaderboard exclusion, commit.
4. Add SQLite backup/restore tooling and test restoration, commit.
5. Add pinned OCI configuration, Caddy/systemd/cloud-init templates, runbook, local validation and final tests, commit.
