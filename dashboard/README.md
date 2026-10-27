# GridMind Dashboard

The dashboard loads simulation results from `POST /api/simulations`. Opening `index.html` directly is unsupported because a file URL has no simulation API.

In PowerShell, run `npm.cmd start` from the repository root and open `http://127.0.0.1:3000/dashboard`. The game is at `/`.

The interface includes scenario controls, live telemetry, a weighted topology map, shortest and energy-aware routes, node health, DP-versus-greedy planning, strategy energy bars, and round history. It has no runtime frontend dependencies.
