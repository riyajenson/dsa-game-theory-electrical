# Phase 5 Dashboard Design

## Goal

Add a dependency-free browser dashboard that makes the existing Phase 4 deterministic simulation and Phase 2 routing results visible without changing the C++ engines.

## Scope

The dashboard will provide:

- A node-state grid showing node ID, strategy, energy, reputation, and suspicious status.
- Energy bars with low-energy styling.
- Route cards for the standard shortest route and the energy-aware route.
- Metric cards for attempted packets, delivered packets, delivery ratio, residual energy, network lifetime, and selfish events.
- A compact SVG-free CSS/HTML chart area rendered with accessible HTML bars for strategy energy comparison and packet delivery.
- Suspicious-node highlighting based on the existing Phase 4 selfish-event data.

The first dashboard uses a deterministic data snapshot matching the Phase 4 demo. It does not add persistence, a backend, a build system, a charting dependency, live C++ output parsing, or deployment configuration.

## Architecture

`dashboard/index.html` supplies semantic sections and stable element IDs. `dashboard/styles.css` owns the responsive dark visual system, cards, bars, route pills, and alert states. `dashboard/app.js` owns one immutable `dashboardData` object and pure-ish render functions that map data into the DOM.

The data model mirrors existing project concepts rather than inventing a second simulation: nodes use `id`, `strategy`, `energy`, `reputation`, and `suspicious`; routes use `label`, `path`, and `cost`; metrics use the Phase 4 aggregate names. The UI is static but structured so a later phase can replace the data object with fetched results.

## Accessibility and behavior

- Use semantic headings, lists, tables/figures where appropriate, and visible labels.
- Energy bars expose `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Suspicious status is conveyed with text and color, never color alone.
- The layout must remain usable on narrow screens without horizontal page scrolling.
- Missing arrays or values must render safe empty states rather than throw during startup.

## Verification

- `node --check dashboard/app.js` must pass.
- Static checks must find all required dashboard sections and data labels.
- The existing Phase 1–4 C++ builds, tests, and demo must continue to pass.
- No network requests or external assets are permitted.
