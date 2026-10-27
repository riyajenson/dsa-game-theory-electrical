"use strict";
const { spawnSync } = require("node:child_process");
const cases = [
  ["energy_planner", "EnergyPlannerTests", "EnergyPlanner", "GameTheoryEngine"],
  ["network_graph", "NetworkGraphTests", "GameTheoryEngine", "NetworkGraph"],
  ["simulation_metrics", "SimulationMetricsTests", "GameTheoryEngine", "SimulationMetrics"],
  ["simulation_runner", "SimulationRunnerTests", "SimulationRunner", "EnergyPlanner",
    "GameTheoryEngine", "NetworkGraph", "SimulationMetrics"],
  ["game_session", "GameSessionTests", "GameSession", "GameTheoryEngine", "NetworkGraph"],
  ["game_balance", "GameBalanceTests", "GameSession", "GameTheoryEngine", "NetworkGraph"],
  ["multiplayer", "MultiplayerSessionTests", "MultiplayerSession", "GameTheoryEngine",
    "NetworkGraph"]
];
for (const [name, test, ...sources] of cases) {
  if (process.argv[2] && process.argv[2] !== name) continue;
  const output = `${name}_tests.exe`;
  const args = ["-std=c++11", `tests/${test}.cpp`,
    ...sources.map((source) => `src/${source}.cpp`), "-o", output];
  if (spawnSync("g++", args, { stdio: "inherit" }).status !== 0 ||
      spawnSync(`./${output}`, [], { stdio: "inherit", shell: false }).status !== 0)
    process.exit(1);
}
