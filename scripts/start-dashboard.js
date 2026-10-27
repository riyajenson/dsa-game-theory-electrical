"use strict";

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "simulation_cli.exe");
const GAME_OUTPUT = path.join(ROOT, "game_cli.exe");
const SOURCES = [
  "src/simulation_cli.cpp",
  "src/SimulationRunner.cpp",
  "src/EnergyPlanner.cpp",
  "src/GameTheoryEngine.cpp",
  "src/NetworkGraph.cpp",
  "src/SimulationMetrics.cpp"
];
const GAME_SOURCES = [
  "src/game_cli.cpp", "src/GameSession.cpp", "src/GameTheoryEngine.cpp",
  "src/NetworkGraph.cpp"
];
const SIMULATION_HEADERS = ["src/SimulationRunner.h", "src/EnergyPlanner.h",
  "src/GameTheoryEngine.h", "src/NetworkGraph.h", "src/SimulationMetrics.h"];
const GAME_HEADERS = ["src/GameSession.h", "src/GameTheoryEngine.h", "src/NetworkGraph.h"];

function needsCompilation() {
  if (!fs.existsSync(OUTPUT)) return true;
  const outputTime = fs.statSync(OUTPUT).mtimeMs;
  return [...SOURCES, ...SIMULATION_HEADERS].some((source) =>
    fs.statSync(path.join(ROOT, source)).mtimeMs > outputTime);
}

function compileSimulation(options = {}) {
  if (!options.force && !needsCompilation()) return true;
  const spawnSync = options.spawnSync || childProcess.spawnSync;
  const args = ["-std=c++11"].concat(SOURCES, ["-o", "simulation_cli.exe"]);
  const result = spawnSync("g++", args, {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true
  });
  return result.status === 0;
}

function compileGame(options = {}) {
  const stale = !fs.existsSync(GAME_OUTPUT) || [...GAME_SOURCES, ...GAME_HEADERS].some((source) =>
    fs.statSync(path.join(ROOT, source)).mtimeMs > fs.statSync(GAME_OUTPUT).mtimeMs);
  if (!options.force && !stale) return true;
  const spawnSync = options.spawnSync || childProcess.spawnSync;
  const result = spawnSync("g++", ["-std=c++11", ...GAME_SOURCES, "-o", "game_cli.exe"], {
    cwd: ROOT, stdio: "inherit", windowsHide: true
  });
  return result.status === 0;
}

function main() {
  if (!compileSimulation() || !compileGame()) {
    console.error("Could not compile the C++ CLIs. Confirm that g++ is installed and on PATH.");
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--check")) {
    console.log("Game and simulation CLIs ready.");
    return;
  }
  const { createServer } = require("../server");
  createServer().listen(3000, "127.0.0.1", () => {
    console.log("Signalbound running at http://127.0.0.1:3000");
  });
}

if (require.main === module) main();

module.exports = { compileSimulation, compileGame, needsCompilation };
