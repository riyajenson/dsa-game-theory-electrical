"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { loadConfig } = require("../deployment-config");
const { createServer } = require("../server");

const production = { SIGNALBOUND_ENV: "production", HOST: "127.0.0.1", PORT: "3000",
  PUBLIC_ORIGIN: "https://signal.example.org", ALLOWED_ORIGINS: "https://signal.example.org",
  TRUST_PROXY: "loopback", SIGNALBOUND_DB_PATH: "/srv/signalbound/data/matches.sqlite",
  COOKIE_MODE: "none", LOG_LEVEL: "info" };

test("production configuration requires a single HTTPS origin, loopback and persistent path", () => {
  assert.equal(loadConfig(production).publicOrigin, "https://signal.example.org");
  for (const env of [
    { ...production, PUBLIC_ORIGIN: "http://signal.example.org" },
    { ...production, HOST: "0.0.0.0" },
    { ...production, ALLOWED_ORIGINS: "https://evil.example.org" },
    { ...production, TRUST_PROXY: "none" },
    { ...production, SIGNALBOUND_DB_PATH: "data/matches.sqlite" },
    { ...production, COOKIE_MODE: "insecure" }
  ]) assert.throws(() => loadConfig(env));
});

test("production rejects direct requests and accepts forwarded HTTPS on its public host", async (t) => {
  const config = loadConfig(production);
  const server = createServer({ config, isSimulationReady: () => true,
    isGameReady: () => true, isMultiplayerReady: () => true,
    isStorageReady: () => true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
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
});
