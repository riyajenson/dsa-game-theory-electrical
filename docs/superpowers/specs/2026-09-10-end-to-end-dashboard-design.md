# End-to-End Dashboard Design

## Goal

Turn the existing C++ game-theory, routing, metrics, and static-dashboard work into a local end-to-end application. A user starts one local service, opens the dashboard, configures a deterministic sensor-network run, and sees results produced by the C++ simulation rather than an embedded JavaScript snapshot.

The first release is optimized for a fast local demonstration and straightforward future cloud deployment. Authentication, persistent storage, multi-user operation, deployment automation, and elaborate animation are outside this version.

## Architecture

The system has three small layers:

1. A C++ simulation executable owns the domain logic. It adds the missing dynamic-programming energy planner, runs a deterministic multi-round scenario, and writes one JSON result to standard output.
2. A dependency-free Node.js service owns HTTP concerns. It validates requests, invokes the C++ executable, returns its JSON result, and serves the dashboard assets.
3. The browser dashboard owns user input and presentation. It calls the local API and renders the returned network state, routes, round history, metrics, alerts, and greedy-versus-DP comparison.

The boundary between layers is a versioned JSON document. This keeps the C++ engine independent from HTTP and makes it possible to replace the local process runner with background jobs later without changing the dashboard.

## Simulation and DP Planner

The DP planner compares actions across a finite number of rounds using round and remaining-energy state. It maximizes cumulative utility while preserving enough energy for future actions. The simulation reports the greedy and planned action sequences, total utility, remaining energy, and an explicit recommended strategy.

The end-to-end scenario reuses the existing five-node topology and game-theory model. User controls are intentionally small: number of rounds and strategy mode. Inputs are range checked by both the service and executable. Results include the final node snapshot, standard and energy-aware routes, per-round observations, aggregate Phase 4 metrics, and planner comparison.

## HTTP Interface

- GET /api/health reports service readiness and whether the simulation executable is available.
- POST /api/simulations accepts a round count and cooperative, selfish, or mixed strategy, then returns the versioned simulation document.
- Static files under dashboard/ are served at /.

The service accepts local requests only, limits request size, validates content type and fields, applies an execution timeout, and returns structured error objects. It keeps no server-side state.

## Dashboard

The dashboard retains its accessible responsive layout and adds a compact simulation control bar, loading and error feedback, a network topology view, a per-round timeline, and a greedy-versus-DP comparison. Existing metric, node, route, and strategy cards are populated from API data. The last successful result stays visible if a later request fails.

The topology is rendered with dependency-free HTML/SVG. Suspicious and low-energy nodes use both text and color cues. All charts retain visible values and accessible labels.

## Error Handling

Invalid user input is rejected before execution and described beside the controls. Compile or executable failures, timeouts, malformed JSON, and unexpected service errors use stable error codes and human-readable messages. The C++ executable writes diagnostics to standard error and reserves standard output for JSON.

## Verification

- Deterministic C++ tests cover DP state transitions, greedy comparison, input bounds, and stable simulation output.
- Node tests cover validation, API success, error mapping, static serving, and process-runner failures without third-party packages.
- Dashboard assertions cover controls, loading/error states, dynamic rendering, topology, timeline, and comparison output.
- A final smoke test starts the service, requests health and a real simulation, and verifies the dashboard in a browser at narrow and desktop widths.

## Documentation and Phase 6

The README will contain one-command local launch instructions plus explicit build and test commands. Phase checklists and result analysis will be updated, and the finished dashboard will be suitable for screenshots and presentation use.
