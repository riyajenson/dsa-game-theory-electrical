"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");
const { createServer } = require("../server");
const { engine } = require("../room-server");
const { MatchStore } = require("../match-store");

test("room creation stops at configured public capacity", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-capacity-"));
  const server = createServer({ dbPath: path.join(directory, "matches.sqlite"), maxRooms: 2 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const port = server.address().port;
  assert.equal((await post(port, "/api/rooms", { name: "A" })).status, 201);
  assert.equal((await post(port, "/api/rooms", { name: "B" })).status, 201);
  const blocked = await post(port, "/api/rooms", { name: "C" });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, "ROOM_CAPACITY");
});

test("unauthenticated WebSockets expire", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-ws-idle-"));
  const server = createServer({ dbPath: path.join(directory, "matches.sqlite"),
    authTimeoutMs: 3000, maxPendingSockets: 1 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  t.after(() => socket.close());
  const expired = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Unauthenticated socket remained open")),
      15000);
    socket.addEventListener("error", () => {}, { once: true });
    socket.addEventListener("close", () => { clearTimeout(timer); resolve(); },
      { once: true });
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const second = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  t.after(() => second.close());
  await new Promise((resolve, reject) => {
    second.addEventListener("error", resolve, { once: true });
    second.addEventListener("open", () => reject(new Error("Pending socket cap failed")),
      { once: true });
  });
  await expired;
});

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-room-"));
  const server = createServer({ dbPath: path.join(directory, "matches.sqlite"),
    turnSeconds: 1 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    for (const room of server.rooms.rooms.values())
      for (const player of room.players)
        for (const socket of player.sockets) socket.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { server, port: server.address().port };
}

function post(port, route, body) {
  return new Promise((resolve, reject) => {
    const content = JSON.stringify(body);
    const request = http.request({ hostname: "127.0.0.1", port, path: route,
      method: "POST", headers: { "content-type": "application/json",
        "content-length": Buffer.byteLength(content) } }, (response) => {
      let raw = "";
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(raw) }));
    });
    request.on("error", reject);
    request.end(content);
  });
}

function live(port, code, token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const queue = [], waiters = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (waiters.length) waiters.shift()(message);
      else queue.push(message);
    });
    socket.addEventListener("error", reject, { once: true });
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ v: 1, type: "hello", roomId: code, token, afterSeq: 0 }));
      resolve({ socket, next: () => queue.length ? Promise.resolve(queue.shift()) :
        new Promise((done) => waiters.push(done)), send: (type, extra = {}) =>
        socket.send(JSON.stringify({ v: 1, type, roomId: code, ...extra })) });
    }, { once: true });
  });
}

async function until(client, type) {
  for (let i = 0; i < 40; ++i) {
    const message = await Promise.race([client.next(), new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 3000))]);
    if (message.type === type) return message;
    if (message.type === "error") throw new Error(JSON.stringify(message));
  }
  throw new Error(`No ${type} event`);
}

function get(port, route) {
  return new Promise((resolve, reject) => http.get({ hostname: "127.0.0.1", port,
    path: route }, (response) => {
    let raw = "";
    response.on("data", (part) => { raw += part; });
    response.on("end", () => resolve({ status: response.statusCode,
      body: JSON.parse(raw) }));
  }).on("error", reject));
}

test("two guests resolve private simultaneous actions and recover a snapshot", async (t) => {
  const { port } = await fixture(t);
  const host = await post(port, "/api/rooms", { name: "Ada" });
  assert.equal(host.status, 201);
  assert.match(host.body.roomId, /^[A-Z2-9]{6}$/);
  const guest = await post(port, `/api/rooms/${host.body.roomId}/join`, { name: "Lin" });
  assert.equal(guest.status, 200);
  assert.notEqual(guest.body.token, host.body.token);
  const a = await live(port, host.body.roomId, host.body.token);
  const b = await live(port, host.body.roomId, guest.body.token);
  t.after(() => { a.socket.close(); b.socket.close(); });
  assert.equal((await a.next()).type, "snapshot");
  assert.equal((await b.next()).type, "snapshot");
  b.send("start");
  assert.equal((await until(b, "error")).data.code, "CANNOT_START");
  a.send("ready", { ready: true });
  b.send("ready", { ready: true });
  let readyCount = 0;
  while (readyCount < 2) {
    const message = await a.next();
    if (message.type === "ready") readyCount++;
  }
  a.send("start");
  // Flush ordered lobby events until the round starts.
  const started = await until(a, "round_started");
  assert.ok(started);
  const matchId = started.matchId;
  a.send("action", { matchId, round: 1, action: "TRANSMIT", nodeId: 2 });
  assert.equal((await until(a, "error")).data.code, "INVALID_ACTION");
  a.send("action", { matchId, round: 1, action: "TRANSMIT" });
  const submitted = await until(b, "submitted");
  assert.ok(submitted);
  assert.equal(JSON.stringify(submitted).includes("TRANSMIT"), false);
  b.send("action", { matchId, round: 1, action: "RELAY" });
  const resolved = await until(a, "round_resolved");
  assert.equal(resolved.data.state.delivered, 1);
  a.socket.close();
  const rejoined = await live(port, host.body.roomId, host.body.token);
  t.after(() => rejoined.socket.close());
  const snapshot = await rejoined.next();
  assert.equal(snapshot.type, "snapshot");
  assert.equal(snapshot.data.state.round, 1);
  b.socket.close(); rejoined.socket.close();
});

test("a departing player does not trap rematch in a closed room", async (t) => {
  const { server, port } = await fixture(t);
  server.rooms.defaultTurnSeconds = 0.2;
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const guest = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  const a = await live(port, host.roomId, host.token);
  const b = await live(port, host.roomId, guest.token);
  t.after(() => { a.socket.close(); b.socket.close(); });
  await a.next(); await b.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start");
  await until(a, "round_started");
  b.send("leave");
  await until(a, "match_finished");
  a.send("rematch");
  const reopened = await until(a, "lobby_open");
  assert.equal(reopened.data.players.length, 1);
  const replacement = await post(port, `/api/rooms/${host.roomId}/join`, { name: "Kai" });
  assert.equal(replacement.status, 200);
  assert.equal(replacement.body.nodeId, 2);
});

test("a disconnected player can be replaced after the match", async (t) => {
  const { server, port } = await fixture(t);
  server.rooms.defaultTurnSeconds = 0.2;
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const guest = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  const a = await live(port, host.roomId, host.token);
  const b = await live(port, host.roomId, guest.token);
  t.after(() => { a.socket.close(); b.socket.close(); });
  await a.next(); await b.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start"); await until(a, "round_started");
  b.socket.close();
  await until(a, "match_finished");
  a.send("reopen");
  const lobby = await until(a, "lobby_open");
  assert.equal(lobby.data.players.length, 1);
  assert.equal((await post(port, `/api/rooms/${host.roomId}/join`, { name: "Kai" })).status, 200);
});

test("rematch reassigns surviving guests to consecutive nodes", async (t) => {
  const { server, port } = await fixture(t);
  server.rooms.defaultTurnSeconds = 0.2;
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const middle = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  const last = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Kai" })).body;
  const a = await live(port, host.roomId, host.token);
  const b = await live(port, host.roomId, middle.token);
  const c = await live(port, host.roomId, last.token);
  t.after(() => { a.socket.close(); b.socket.close(); c.socket.close(); });
  await a.next(); await b.next(); await c.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  c.send("ready", { ready: true });
  for (let i = 0; i < 3; ++i) await until(a, "ready");
  a.send("start"); const firstRound = await until(a, "round_started");
  b.send("leave");
  await until(a, "match_finished");
  a.send("rematch"); c.send("rematch");
  let snapshot;
  for (let i = 0; i < 45; ++i) {
    const event = await c.next();
    if (event.type === "snapshot" && event.matchId !== firstRound.matchId) {
      snapshot = event; break;
    }
  }
  assert.ok(snapshot);
  assert.equal(snapshot.data.nodeId, 2);
  assert.equal(snapshot.data.players.length, 2);
});

test("deadline fills idle, duplicate actions fail, and final scores persist once", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-persist-"));
  const dbPath = path.join(directory, "matches.sqlite");
  const server = createServer({ dbPath, turnSeconds: 0.5 });
  let a, b, restarted;
  t.after(async () => {
    a?.socket.close(); b?.socket.close();
    for (const active of [server, restarted]) if (active?.listening)
      await new Promise((resolve) => active.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const guest = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  a = await live(port, host.roomId, host.token);
  b = await live(port, host.roomId, guest.token);
  await a.next(); await b.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start");
  const started = await until(a, "round_started");
  a.send("action", { matchId: started.matchId, round: 1, action: "IDLE" });
  a.send("action", { matchId: started.matchId, round: 1, action: "TRANSMIT" });
  assert.equal((await until(a, "error")).data.code, "DUPLICATE_ACTION");
  b.send("action", { matchId: started.matchId, round: 1, action: "IDLE" });
  const finished = await until(a, "match_finished");
  assert.equal(finished.data.state.round, 8);
  assert.equal(finished.data.eligible, false);
  assert.equal(finished.data.state.history[1].actions[0], "IDLE");
  const board = await get(port, "/api/leaderboard");
  assert.equal(board.body.entries.length, 0);
  const record = await get(port, `/api/matches/${started.matchId}`);
  assert.equal(record.body.actions.split(",").length, 8);
  a.socket.close(); b.socket.close();
  await new Promise((resolve) => server.close(resolve));
  restarted = createServer({ dbPath });
  await new Promise((resolve) => restarted.listen(0, "127.0.0.1", resolve));
  assert.equal((await get(restarted.address().port, "/api/leaderboard")).body.entries.length, 0);
  await new Promise((resolve) => restarted.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
});

test("eligible complete match ranks guests once and rematches with a new match id", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-ranked-"));
  const dbPath = path.join(directory, "matches.sqlite");
  const server = createServer({ dbPath, turnSeconds: 1 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let a, b;
  t.after(async () => {
    a?.socket.close(); b?.socket.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const guest = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  a = await live(port, host.roomId, host.token);
  b = await live(port, host.roomId, guest.token);
  await a.next(); await b.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start");
  let start = await until(a, "round_started");
  const firstMatch = start.matchId;
  for (let round = 1; round <= 8; ++round) {
    a.send("action", { matchId: firstMatch, round, action: "IDLE" });
    b.send("action", { matchId: firstMatch, round, action: "IDLE" });
    assert.equal((await until(a, "round_resolved")).data.state.round, round);
    if (round < 8) start = await until(a, "round_started");
  }
  const result = await until(a, "match_finished");
  assert.equal(result.data.eligible, true);
  assert.equal(result.data.ranking.length, 2);
  assert.equal((await get(port, "/api/leaderboard")).body.entries.length, 2);
  const saved = (await get(port, `/api/matches/${firstMatch}`)).body;
  assert.deepEqual(await engine(saved.seed, saved.player_count,
    saved.actions.split(",")), saved.result);
  assert.equal(server.rooms.database().save(server.rooms.rooms.get(host.roomId),
    saved.result, true), false);
  assert.equal((await get(port, "/api/leaderboard")).body.entries.length, 2);
  a.send("rematch"); b.send("rematch");
  const rematch = await until(a, "round_started");
  assert.notEqual(rematch.matchId, firstMatch);
  assert.equal(rematch.data.state.round, 0);
});

test("an inactive streak stays ineligible even after later active rounds", async (t) => {
  const { server, port } = await fixture(t);
  server.rooms.defaultTurnSeconds = 0.5;
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const guest = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  const a = await live(port, host.roomId, host.token);
  const b = await live(port, host.roomId, guest.token);
  t.after(() => { a.socket.close(); b.socket.close(); });
  await a.next(); await b.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start");
  const started = await until(a, "round_started");
  for (let round = 1; round <= 8; ++round) {
    if (![2, 3].includes(round)) {
      a.send("action", { matchId: started.matchId, round, action: "IDLE" });
      b.send("action", { matchId: started.matchId, round, action: "IDLE" });
    }
    await until(a, "round_resolved");
    if (round < 8) await until(a, "round_started");
  }
  assert.equal((await until(a, "match_finished")).data.eligible, false);
  assert.equal((await get(port, "/api/leaderboard")).body.entries.length, 0);
});

test("room creation and WebSocket payloads enforce rate and size limits", async (t) => {
  const { port } = await fixture(t);
  let first;
  for (let i = 0; i < 20; ++i) {
    const response = await post(port, "/api/rooms", { name: "Ada" });
    assert.equal(response.status, 201);
    first ||= response.body;
  }
  const limited = await post(port, "/api/rooms", { name: "Ada" });
  assert.equal(limited.status, 429);
  const client = await live(port, first.roomId, first.token);
  await client.next();
  const closed = new Promise((resolve) => client.socket.addEventListener("close", resolve,
    { once: true }));
  client.socket.send("x".repeat(4100));
  await Promise.race([closed, new Promise((_, reject) => setTimeout(() =>
    reject(new Error("Oversized WebSocket frame remained open")), 3000))]);
});

test("a room with everyone gone becomes an unranked abandoned record", async (t) => {
  const { server, port } = await fixture(t);
  server.rooms.defaultTurnSeconds = 0.2;
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const guest = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  const a = await live(port, host.roomId, host.token);
  const b = await live(port, host.roomId, guest.token);
  await a.next(); await b.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start"); const started = await until(a, "round_started");
  a.socket.close(); b.socket.close();
  for (let i = 0; i < 30; ++i) {
    if (server.rooms.rooms.get(host.roomId).status === "abandoned") break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(server.rooms.rooms.get(host.roomId).status, "abandoned");
  const saved = await get(port, `/api/matches/${started.matchId}`);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.outcome, "abandoned");
  assert.equal(saved.body.eligible, 0);
});

test("restart terminates an active match visibly without ranking it", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-restart-"));
  const dbPath = path.join(directory, "matches.sqlite");
  let server = createServer({ dbPath, turnSeconds: 20 });
  let recovered;
  t.after(async () => {
    recovered?.socket.close();
    server.rooms.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const host = (await post(port, "/api/rooms", { name: "Ada" })).body;
  const guest = (await post(port, `/api/rooms/${host.roomId}/join`, { name: "Lin" })).body;
  const a = await live(port, host.roomId, host.token);
  const b = await live(port, host.roomId, guest.token);
  await a.next(); await b.next();
  a.send("ready", { ready: true }); b.send("ready", { ready: true });
  await until(a, "ready"); await until(a, "ready");
  a.send("start"); const started = await until(a, "round_started");
  a.send("action", { matchId: started.matchId, round: 1, action: "IDLE" });
  await until(a, "accepted");
  a.socket.close(); b.socket.close();
  server.rooms.close();
  await new Promise((resolve) => server.close(resolve));
  server = createServer({ dbPath, turnSeconds: 20 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const nextPort = server.address().port;
  recovered = await live(nextPort, host.roomId, host.token);
  const snapshot = await until(recovered, "snapshot");
  assert.equal(snapshot.matchId, started.matchId);
  assert.equal(snapshot.data.status, "interrupted");
  assert.match(snapshot.data.reason, /restart/i);
  assert.equal(snapshot.data.ownAction, null);
  assert.equal((await get(nextPort, "/api/leaderboard")).body.entries.length, 0);
  recovered.send("reopen");
  assert.equal((await until(recovered, "lobby_open")).data.players.length, 1);
  recovered.socket.close();
});

test("expired interrupted room removes its persisted guest roster", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-expiry-"));
  const dbPath = path.join(directory, "matches.sqlite");
  const store = new MatchStore(dbPath);
  store.saveActive({ id: "ABC234", matchId: "match-expiry", seed: 17,
    history: [], turnSeconds: 30, players: [{ name: "Ada", nodeId: 1,
      tokenHash: "hash" }] }, { round: 0 });
  store.db.close();
  const server = createServer({ dbPath });
  t.after(() => { server.rooms.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  server.rooms.database();
  server.rooms.rooms.get("ABC234").lastActivity = Date.now() - 31 * 60 * 1000;
  server.rooms.sweep();
  assert.equal(server.rooms.database().db.prepare(
    "SELECT count(*) AS n FROM active_rooms").get().n, 0);
});
