# Phase 5 Dashboard

This dashboard is a dependency-free static frontend for the energy-aware sensor network project. It displays a deterministic snapshot of the Phase 2 routing results and Phase 4 simulation metrics.

## Local Preview

For a no-install local preview, open `dashboard/index.html` directly in a browser.

If an already-installed local static-file server is preferred, point it at the `dashboard` directory. The dashboard itself does not require Node.js, a package manager, or a build step.

## Current Data Scope

The displayed data is deterministic and mirrors the Phase 2 route output and Phase 4 simulation-metrics output. It does not fetch data or require a backend, package installation, or build step.

Future live-data integration is not implemented. Persistent simulation data, backend integration, and deployment are deferred work.
