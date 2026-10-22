"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const test = require("node:test");
const { loadConfig } = require("../deployment-config");
const { createServer } = require("../server");

const production = { SIGNALBOUND_ENV: "production", HOST: "127.0.0.1", PORT: "3000",
  PUBLIC_ORIGIN: "https://signal.example.org", ALLOWED_ORIGINS: "https://signal.example.org",
  TRUST_PROXY: "loopback", SIGNALBOUND_DB_PATH: "/srv/signalbound/data/matches.sqlite",
  SIGNALBOUND_DATA_DIR: "/srv/signalbound/data",
  COOKIE_MODE: "none", LOG_LEVEL: "info" };

test("production configuration requires a single HTTPS origin, loopback and persistent path", () => {
  assert.equal(loadConfig(production).publicOrigin, "https://signal.example.org");
  for (const env of [
    { ...production, PUBLIC_ORIGIN: "http://signal.example.org" },
    { ...production, HOST: "0.0.0.0" },
    { ...production, ALLOWED_ORIGINS: "https://evil.example.org" },
    { ...production, TRUST_PROXY: "none" },
    { ...production, SIGNALBOUND_DB_PATH: "data/matches.sqlite" },
    { ...production, SIGNALBOUND_DATA_DIR: undefined },
    { ...production, SIGNALBOUND_DB_PATH: "/tmp/matches.sqlite" },
    { ...production, COOKIE_MODE: "insecure" }
  ]) assert.throws(() => loadConfig(env));
});

test("production rejects direct requests and accepts forwarded HTTPS on its public host", async (t) => {
  const config = loadConfig(production);
  const server = createServer({ config, isSimulationReady: () => true,
    isGameReady: () => true, isMultiplayerReady: () => true,
    isStorageReady: () => true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.rooms.close(); return new Promise((resolve) => server.close(resolve)); });
  const request = (headers, path = "/api/live") => new Promise((resolve, reject) => {
    const call = http.get({ hostname: "127.0.0.1", port: server.address().port,
      path, headers }, (response) => { response.resume(); response.on("end", () =>
      resolve(response.statusCode)); });
    call.on("error", reject);
  });
  assert.equal(await request({ host: "signal.example.org" }, "/"), 403);
  assert.equal(await request({ host: "signal.example.org",
    "x-forwarded-proto": "https" }, "/"), 200);
  assert.equal(await request({ host: "wrong.example.org",
    "x-forwarded-proto": "https" }, "/"), 403);
  assert.equal(await request({ host: "signal.example.org" }), 200);
  const upgrade = (origin) => new Promise((resolve) => {
    let upgraded = false;
    const headers = { host: "signal.example.org", "x-forwarded-proto": "https",
      upgrade: "websocket", connection: "Upgrade",
      "sec-websocket-key": crypto.randomBytes(16).toString("base64"),
      "sec-websocket-version": "13" };
    if (origin) headers.origin = origin;
    const call = http.request({ hostname: "127.0.0.1", port: server.address().port,
      path: "/ws", headers });
    call.on("upgrade", (_, socket) => {
      upgraded = true;
      socket.on("error", () => {});
      socket.on("close", () => resolve(101));
      socket.write(Buffer.from([0x88, 0x80, 0, 0, 0, 0]));
    });
    call.on("response", (response) => { response.resume(); resolve(response.statusCode); });
    call.on("error", () => { if (!upgraded) resolve(403); });
    call.end();
  });
  assert.equal(await upgrade(undefined), 403);
  assert.equal(await upgrade("https://wrong.example.org"), 403);
});
