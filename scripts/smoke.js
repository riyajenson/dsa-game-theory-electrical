"use strict";
const assert = require("node:assert/strict");
const base = process.argv[2] || "http://127.0.0.1:3000";

async function main() {
  for (const [route, text] of [["/", "Signalbound"],
    ["/multiplayer", "Create a room"], ["/dashboard", "Grid"]]) {
    const response = await fetch(new URL(route, base));
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), new RegExp(text), route);
  }
  const live = await fetch(new URL("/api/live", base));
  const ready = await fetch(new URL("/api/health", base));
  assert.equal(live.status, 200);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, "ok");
  const board = await fetch(new URL("/api/leaderboard", base));
  assert.equal(board.status, 200);
  assert.ok(Array.isArray((await board.json()).entries));
  console.log(`Smoke check passed: ${base}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
