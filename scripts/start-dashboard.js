"use strict";

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "simulation_cli.exe");
const SOURCES = [
  "src/simulation_cli.cpp",
  "src/SimulationRunner.cpp",
  "src/EnergyPlanner.cpp",
  "src/GameTheoryEngine.cpp",
  "src/NetworkGraph.cpp",
  "src/SimulationMetrics.cpp"
];

function needsCompilation() {
  if (!fs.existsSync(OUTPUT)) return true;
  const outputTime = fs.statSync(OUTPUT).mtimeMs;
  return SOURCES.some((source) => fs.statSync(path.join(ROOT, source)).mtimeMs > outputTime);
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

function main() {
  if (!compileSimulation()) {
    console.error("Could not compile simulation_cli.exe. Confirm that g++ is installed and on PATH.");
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--check")) {
    console.log("Simulation CLI ready.");
    return;
  }
  const { createServer } = require("../server");
  createServer().listen(3000, "127.0.0.1", () => {
    console.log("Dashboard running at http://127.0.0.1:3000");
  });
}

if (require.main === module) main();

module.exports = { compileSimulation, needsCompilation };
