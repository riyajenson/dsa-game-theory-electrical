# End-to-End Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-command local dashboard whose data is produced by the C++ routing, metrics, and new DP-planning code through a dependency-free Node.js API.

**Architecture:** A C++ CLI emits one versioned JSON simulation document. A Node.js HTTP server validates requests, invokes that CLI, and serves the existing dashboard, which renders controls, topology, history, metrics, and planner comparisons from the API response.

**Tech Stack:** C++11 with MinGW g++, Node.js 24 built-ins, HTML5, CSS, and dependency-free browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-10-end-to-end-dashboard-design.md`

## Global Constraints

- The first release is local-only and dependency-free.
- Keep the C++ domain layer independent of HTTP.
- Keep authentication, persistence, background jobs, deployment automation, and elaborate animation out of scope.
- Accept round counts from 1 through 20 and strategy values `cooperative`, `selfish`, or `mixed`.
- Preserve accessible text labels, keyboard operation, responsive layout, and non-color alert cues.

---

### Task 1: Dynamic-Programming Energy Planner

**Files:**
- Create: `src/EnergyPlanner.h`
- Create: `src/EnergyPlanner.cpp`
- Create: `tests/EnergyPlannerTests.cpp`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `SensorNode`, `NodeAction`, `DecisionContext`, and `GameTheoryEngine` from `src/GameTheoryEngine.h`.
- Produces: `EnergyPlan EnergyPlanner::plan(const SensorNode&, const DecisionContext&, int rounds) const` and `EnergyPlan EnergyPlanner::greedy(const SensorNode&, const DecisionContext&, int rounds) const`.

- [ ] **Step 1: Write the failing planner tests**

Create table-driven assertions that zero rounds produce an empty plan, each result has exactly the requested number of actions, residual energy stays within 0..100, total utility equals the chosen transitions, and a low-energy multi-round case gives the DP plan at least as much cumulative utility as greedy selection.

```cpp
EnergyPlanner planner;
EnergyPlan planned = planner.plan(lowEnergyNode, relayContext, 5);
EnergyPlan greedy = planner.greedy(lowEnergyNode, relayContext, 5);
assert(planned.actions.size() == 5);
assert(planned.totalUtility >= greedy.totalUtility);
assert(planned.remainingEnergy >= 0.0 && planned.remainingEnergy <= 100.0);
```

- [ ] **Step 2: Compile and verify the test fails**

Run: `g++ -std=c++11 tests/EnergyPlannerTests.cpp src/EnergyPlanner.cpp src/GameTheoryEngine.cpp -o energy_planner_tests.exe`

Expected: FAIL because `EnergyPlanner.h` and its API do not exist.

- [ ] **Step 3: Implement the minimal memoized planner**

Define:

```cpp
struct EnergyPlan {
    std::vector<NodeAction> actions;
    double totalUtility;
    double remainingEnergy;
};

class EnergyPlanner {
public:
    EnergyPlan plan(const SensorNode&, const DecisionContext&, int rounds) const;
    EnergyPlan greedy(const SensorNode&, const DecisionContext&, int rounds) const;
};
```

Use memoization keyed by round and integer energy units. For every action, read its immediate utility from `calculateUtilities`, simulate its energy transition through `applyActionResult`, reject transitions below zero energy, and select the highest immediate-plus-future value. Use action enum order as the deterministic tie-breaker. Clamp rounds to 0..20 and energy to 0..100.

- [ ] **Step 4: Compile and run the planner tests**

Run: `g++ -std=c++11 tests/EnergyPlannerTests.cpp src/EnergyPlanner.cpp src/GameTheoryEngine.cpp -o energy_planner_tests.exe; .\energy_planner_tests.exe`

Expected: `Energy planner tests passed.`

- [ ] **Step 5: Commit the planner**

```powershell
git add .gitignore src/EnergyPlanner.h src/EnergyPlanner.cpp tests/EnergyPlannerTests.cpp
git commit -m "feat: add dynamic programming energy planner"
```

### Task 2: JSON Simulation CLI

**Files:**
- Create: `src/SimulationRunner.h`
- Create: `src/SimulationRunner.cpp`
- Create: `src/simulation_cli.cpp`
- Create: `tests/SimulationRunnerTests.cpp`

**Interfaces:**
- Consumes: `EnergyPlanner`, `NetworkGraph`, `SimulationMetrics`, and the existing five-node deterministic topology.
- Produces: `SimulationResult runSimulation(int rounds, const std::string& strategy)`, `std::string simulationToJson(const SimulationResult&)`, and CLI usage `simulation_cli.exe --rounds 5 --strategy mixed`.

- [ ] **Step 1: Write failing simulation contract tests**

Assert invalid rounds and strategies throw `std::invalid_argument`; a three-round run contains five final nodes and three history entries; routes are reachable; attempted packets are not below delivered packets; and serialized JSON contains `schemaVersion`, `metrics`, `nodes`, `routes`, `history`, and `plannerComparison`.

```cpp
SimulationResult result = runSimulation(3, "mixed");
assert(result.nodes.size() == 5);
assert(result.history.size() == 3);
std::string json = simulationToJson(result);
assert(json.find("\"schemaVersion\":1") != std::string::npos);
```

- [ ] **Step 2: Compile and verify failure**

Run: `g++ -std=c++11 tests/SimulationRunnerTests.cpp src/SimulationRunner.cpp src/EnergyPlanner.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o simulation_runner_tests.exe`

Expected: FAIL because the runner API is absent.

- [ ] **Step 3: Implement deterministic simulation and JSON output**

Create focused result structs for node state, route summaries, round summaries, metrics, and planner comparison. Recreate the known graph, apply the requested strategy mode, run one decision per node per round, update node state, record metrics, calculate routes, compare DP and greedy plans, and escape every JSON string through one `jsonEscape` helper. Keep stdout JSON-only in `simulation_cli.cpp`; send validation errors to stderr and return exit code 2.

- [ ] **Step 4: Verify the contract and real CLI**

Run: `g++ -std=c++11 tests/SimulationRunnerTests.cpp src/SimulationRunner.cpp src/EnergyPlanner.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o simulation_runner_tests.exe; .\simulation_runner_tests.exe`

Run: `g++ -std=c++11 src/simulation_cli.cpp src/SimulationRunner.cpp src/EnergyPlanner.cpp src/GameTheoryEngine.cpp src/NetworkGraph.cpp src/SimulationMetrics.cpp -o simulation_cli.exe; .\simulation_cli.exe --rounds 3 --strategy mixed | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const x=JSON.parse(s);if(x.history.length!==3)process.exit(1);console.log('CLI JSON valid')})"`

Expected: tests pass and the JSON probe prints `CLI JSON valid`.

- [ ] **Step 5: Commit the simulation CLI**

```powershell
git add src/SimulationRunner.h src/SimulationRunner.cpp src/simulation_cli.cpp tests/SimulationRunnerTests.cpp
git commit -m "feat: expose deterministic simulation JSON"
```

### Task 3: Local API and Static Server

**Files:**
- Create: `server.js`
- Create: `tests/server.test.js`
- Create: `package.json`

**Interfaces:**
- Consumes: `simulation_cli.exe --rounds <n> --strategy <mode>`.
- Produces: `createServer(options)`, GET `/api/health`, POST `/api/simulations`, and static dashboard responses.

- [ ] **Step 1: Write failing Node API tests**

Use `node:test` with a fake `runSimulation` function. Verify health output, successful POST forwarding, 400 responses for malformed JSON and invalid fields, 415 for non-JSON requests, 404 for unknown paths, and safe dashboard static serving.

```js
const server = createServer({ runSimulation: async (input) => ({ schemaVersion: 1, input }) });
const response = await request(server, "POST", "/api/simulations", {
  rounds: 3,
  strategy: "mixed"
});
assert.equal(response.status, 200);
assert.equal(response.body.input.rounds, 3);
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/server.test.js`

Expected: FAIL because `server.js` is absent.

- [ ] **Step 3: Implement the dependency-free server**

Use `node:http`, `node:fs`, `node:path`, and `node:child_process`. Limit request bodies to 16 KiB, accept only exact input keys, run the CLI with `execFile` and a 10-second timeout, parse stdout as JSON, and return errors shaped as `{"error":{"code":"...","message":"..."}}`. Normalize and containment-check static paths against `dashboard/`. Listen on `127.0.0.1:3000` when launched directly.

- [ ] **Step 4: Run API tests and real smoke requests**

Run: `node --test tests/server.test.js`

Run: start `node server.js`, then GET `http://127.0.0.1:3000/api/health` and POST a mixed three-round JSON request. Parse both responses and assert HTTP 200 with `schemaVersion: 1`.

Expected: all tests pass and both smoke responses parse.

- [ ] **Step 5: Commit the local server**

```powershell
git add server.js tests/server.test.js package.json
git commit -m "feat: add local simulation API"
```

### Task 4: Interactive End-to-End Dashboard

**Files:**
- Modify: `dashboard/index.html`
- Modify: `dashboard/styles.css`
- Modify: `dashboard/app.js`
- Modify: `dashboard/renderer-assertions.js`

**Interfaces:**
- Consumes: POST `/api/simulations` and the Task 2 JSON contract.
- Produces: `runSimulation(input)`, `renderTopology(nodes, links)`, `renderHistory(history)`, `renderPlannerComparison(comparison)`, and existing metric/node/route renderers driven by live data.

- [ ] **Step 1: Extend assertions before markup or renderer changes**

Assert the HTML contains the simulation form, round input, strategy select, status region, topology SVG, history container, and planner comparison container. In fake-DOM tests, assert submitted input reaches the request function, busy state disables the button, API errors remain visible without clearing prior cards, and topology/history/planner data render visible text and accessible labels.

- [ ] **Step 2: Run and verify dashboard assertions fail**

Run: `node dashboard/renderer-assertions.js`

Expected: FAIL on missing simulation controls and new renderer functions.

- [ ] **Step 3: Implement the live UI**

Replace the embedded snapshot as the primary data source with `fetch("/api/simulations")`. Default to five mixed rounds and automatically run once on page load. Add a compact control panel; an SVG node-link diagram with route emphasis; horizontal history cards; planner totals, action sequences, remaining energy, and recommendation; and clear loading/error states. Preserve the last successful DOM on request failure.

- [ ] **Step 4: Apply presentation polish and responsive behavior**

Use the existing palette and card system. Add a dashboard-wide summary band, connected topology layout, two-column analysis section, visible focus states, reduced-motion behavior, and a one-column narrow layout. Ensure suspicious nodes, route selection, and the planner recommendation are expressed with text as well as color.

- [ ] **Step 5: Run dashboard and full regression tests**

Run: `node dashboard/renderer-assertions.js`

Run all C++ test executables and `node --test tests/server.test.js`.

Expected: all renderer, planner, routing, metrics, simulation, and API tests pass.

- [ ] **Step 6: Commit the interactive dashboard**

```powershell
git add dashboard/index.html dashboard/styles.css dashboard/app.js dashboard/renderer-assertions.js
git commit -m "feat: connect interactive dashboard to simulation API"
```

### Task 5: One-Command Launch, Phase 6 Documentation, and Browser Verification

**Files:**
- Create: `scripts/start-dashboard.js`
- Create: `docs/phase-3-checklist.md`
- Create: `docs/phase-6-checklist.md`
- Create: `docs/result-analysis.md`
- Modify: `README.md`
- Modify: `src/README.md`
- Modify: `dashboard/README.md`
- Modify: `docs/phase-roadmap.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: source and tests from Tasks 1 through 4.
- Produces: `npm start`, `npm test`, complete phase records, result analysis, and screenshot-ready local dashboard.

- [ ] **Step 1: Write launch-script checks**

Add a `--check` mode that verifies g++ and Node availability, compiles `simulation_cli.exe` only when sources are newer, and exits nonzero with a precise message when compilation fails. Add an npm test command that compiles and runs every C++ suite before Node assertions.

- [ ] **Step 2: Implement the one-command launcher**

Use `node:child_process.spawnSync` with explicit argument arrays to compile the CLI, then require `server.js`. Print exactly one usable URL, `http://127.0.0.1:3000`, and avoid opening an external browser automatically.

- [ ] **Step 3: Complete Phase 3 and Phase 6 documentation**

Document the implemented DP state, recurrence, deterministic tie-breaker, comparison limits, test evidence, end-to-end architecture, launch workflow, known local-only constraints, and analysis of delivery ratio, residual energy, network lifetime, selfish events, routes, and DP-versus-greedy output.

- [ ] **Step 4: Run the complete automated verification**

Run: `npm test`

Run: `node scripts/start-dashboard.js --check`

Expected: every C++ and Node test passes and the launch check reports the CLI ready.

- [ ] **Step 5: Verify the real browser flow**

Start `npm start`, open `http://127.0.0.1:3000`, run a five-round mixed simulation, then a three-round cooperative simulation. Verify controls, topology, history, metrics, routes, planner comparison, and no browser console errors at desktop and 390px widths.

- [ ] **Step 6: Commit the finished project**

```powershell
git add scripts/start-dashboard.js package.json README.md src/README.md dashboard/README.md docs/phase-roadmap.md docs/phase-3-checklist.md docs/phase-6-checklist.md docs/result-analysis.md
git commit -m "docs: finish end-to-end dashboard project"
```
