"use strict";
// Run only against the disposable local TLS container named on the command line.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

const base = process.argv[2];
const container = process.argv[3];
if (base !== "https://127.0.0.1:3443" || !/^signalbound-rehearsal$/.test(container || ""))
  throw new Error("Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/rehearse-local.js https://127.0.0.1:3443 signalbound-rehearsal");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(route, body) {
  const response = await fetch(new URL(route, base), body && {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await request("/api/health")).status === 200) return; }
    catch { /* restarting */ }
    await delay(100);
  }
  throw new Error("Release did not become ready");
}
async function connect(roomId, token) {
  const ws = new WebSocket("wss://127.0.0.1:3443/ws");
  const events = [];
  ws.addEventListener("message", (event) => events.push(JSON.parse(event.data)));
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const send = (type, data = {}) => ws.send(JSON.stringify({ v: 1, type, roomId, ...data }));
  send("hello", { token, afterSeq: 0 });
  return { ws, events, send };
}
async function until(client, type, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const message = client.events.shift();
    if (!message) { await delay(20); continue; }
    if (message.type === "error") throw new Error(JSON.stringify(message));
    if (message.type === type) return message;
  }
  throw new Error(`Timed out waiting for ${type}`);
}
async function start(a, b) {
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start");
  return (await until(a, "round_started")).matchId;
}

async function main() {
  await ready();
  const host = await request("/api/rooms", { name: "Release Ada" });
  assert.equal(host.status, 201);
  const code = host.data.roomId;
  const guest = await request(`/api/rooms/${code}/join`, { name: "Release Lin" });
  assert.equal(guest.status, 200);
  let a = await connect(code, host.data.token);
  let b = await connect(code, guest.data.token);
  await until(a, "snapshot"); await until(b, "snapshot");
  const matchId = await start(a, b);
  for (let round = 1; round <= 8; round++) {
    if (round > 1) await until(a, "round_started");
    a.send("action", { matchId, round,
      action: round === 8 ? "SLEEP" : "TRANSMIT" });
    if (round !== 2) b.send("action", { matchId, round,
      action: round === 8 ? "TRANSMIT" : "RELAY" });
    const resolved = await until(a, "round_resolved");
    assert.equal(resolved.round, round);
  }
  const finished = await until(a, "match_finished");
  assert.equal(finished.data.eligible, true);
  assert.equal(finished.data.state.status, "won");
  assert.equal(finished.data.state.delivered, 7);
  const before = await request("/api/leaderboard");
  assert.equal(before.status, 200);
  assert.equal(before.data.entries.filter((entry) => entry.matchId === matchId).length, 2);
  assert.equal((await request(`/api/matches/${matchId}`)).status, 200);
  a.send("rematch"); b.send("rematch");
  const rematch = (await until(a, "round_started")).matchId;
  assert.notEqual(rematch, matchId);
  a.send("action", { matchId: rematch, round: 1, action: "TRANSMIT" });
  await until(a, "accepted");
  execFileSync("docker", ["stop", container], { stdio: "inherit" });
  execFileSync("docker", ["start", container], { stdio: "inherit" });
  await ready();
  a.ws.close(); b.ws.close();
  a = await connect(code, host.data.token);
  b = await connect(code, guest.data.token);
  const recovered = await until(a, "snapshot");
  await until(b, "snapshot");
  assert.equal(recovered.data.status, "interrupted");
  assert.match(recovered.data.reason, /Server restarted.*No result was ranked/);
  assert.equal(recovered.data.eligible, false);
  assert.equal((await request(`/api/matches/${rematch}`)).status, 404);
  const after = await request("/api/leaderboard");
  assert.deepEqual(after.data.entries, before.data.entries);
  a.ws.close(); b.ws.close();
  console.log(`Local HTTPS/WSS rehearsal passed: ${code}, complete ${matchId}, interrupted ${rematch}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
