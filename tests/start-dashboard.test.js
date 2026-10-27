"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { compileSimulation } = require("../scripts/start-dashboard");

test("forced compilation invokes g++ with every simulation source", () => {
  let invocation;
  const result = compileSimulation({
    force: true,
    spawnSync(command, args, options) {
      invocation = { command, args, options };
      return { status: 0 };
    }
  });
  assert.equal(result, true);
  assert.equal(invocation.command, "g++");
  assert.ok(invocation.args.includes("src/simulation_cli.cpp"));
  assert.ok(invocation.args.includes("src/SimulationRunner.cpp"));
  assert.ok(invocation.args.includes("src/EnergyPlanner.cpp"));
  assert.equal(invocation.args.at(-1), "simulation_cli.exe");
  assert.equal(invocation.options.stdio, "inherit");
});
