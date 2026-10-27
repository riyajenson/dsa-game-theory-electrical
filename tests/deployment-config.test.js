"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadConfig, trustedRequest } = require("../deployment-config");
const { createServer } = require("../server");

const production = { SIGNALBOUND_ENV: "production", HOST: "127.0.0.1", PORT: "3000",
  PUBLIC_ORIGIN: "https://signal.example.org", ALLOWED_ORIGINS: "https://signal.example.org",
  TRUST_PROXY: "loopback", SIGNALBOUND_DB_PATH: "/srv/signalbound/data/matches.sqlite",
  SIGNALBOUND_DATA_DIR: "/srv/signalbound/data",
  COOKIE_MODE: "none", LOG_LEVEL: "info" };

const renderTest = { SIGNALBOUND_ENV: "render-test", RENDER: "true",
  RENDER_EXTERNAL_URL: "https://signalbound-test.onrender.com",
  HOST: "0.0.0.0", PORT: "10000", TRUST_PROXY: "render",
  SIGNALBOUND_DATA_DIR: "/tmp/signalbound", COOKIE_MODE: "none" };

test("Render test uses only its assigned HTTPS origin and temporary data directory", () => {
  const config = loadConfig(renderTest);
  assert.equal(config.mode, "render-test");
  assert.equal(config.publicOrigin, renderTest.RENDER_EXTERNAL_URL);
  assert.deepEqual(config.allowedOrigins, [renderTest.RENDER_EXTERNAL_URL]);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 10000);
  assert.equal(config.dbPath, path.join("/tmp/signalbound", "matches.sqlite"));
  for (const bad of [
    { RENDER: undefined }, { RENDER_EXTERNAL_URL: "http://signalbound-test.onrender.com" },
    { RENDER_EXTERNAL_URL: "https://other.example.org" },
    { HOST: "127.0.0.1" }, { PORT: undefined }, { TRUST_PROXY: "loopback" },
    { SIGNALBOUND_DATA_DIR: "data" }, { SIGNALBOUND_DATA_DIR: "/srv/signalbound" },
    { PUBLIC_ORIGIN: "https://wrong.onrender.com" },
    { ALLOWED_ORIGINS: "https://wrong.onrender.com" }, { COOKIE_MODE: "insecure" }
  ]) assert.throws(() => loadConfig({ ...renderTest, ...bad }));
});

test("Render test accepts only forwarded HTTPS for its own host", () => {
  const config = loadConfig(renderTest);
  const req = (headers) => ({ headers, socket: { remoteAddress: "10.0.0.4" } });
  assert.equal(trustedRequest(req({ host: "signalbound-test.onrender.com",
    "x-forwarded-proto": "https" }), config), true);
  for (const headers of [
    { host: "signalbound-test.onrender.com" },
    { host: "wrong.onrender.com", "x-forwarded-proto": "https" },
    { host: "signalbound-test.onrender.com", "x-forwarded-proto": "http" },
    { host: "signalbound-test.onrender.com", "x-forwarded-proto": "https",
      "x-forwarded-host": "wrong.onrender.com" }
  ]) assert.equal(trustedRequest(req(headers), config), false);
});

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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-config-"));
  const server = createServer({ config, dbPath: path.join(directory, "matches.sqlite"),
    isSimulationReady: () => true,
    isGameReady: () => true, isMultiplayerReady: () => true,
    isStorageReady: () => true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.rooms.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true }); });
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
