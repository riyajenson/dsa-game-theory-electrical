"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadConfig } = require("../deployment-config");
const { createServer } = require("../server");

const origin = "https://signalbound-test.onrender.com";
const config = loadConfig({ SIGNALBOUND_ENV: "render-test", RENDER: "true",
  RENDER_EXTERNAL_URL: origin, HOST: "0.0.0.0", PORT: "10000",
  TRUST_PROXY: "render", SIGNALBOUND_DATA_DIR: "/tmp/signalbound" });

function request(port, route, method = "GET", body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body && JSON.stringify(body);
    const call = http.request({ host: "127.0.0.1", port, path: route, method,
      headers: { host: "signalbound-test.onrender.com", "x-forwarded-proto": "https",
        ...(payload && { "content-type": "application/json",
          "content-length": Buffer.byteLength(payload) }), ...headers } },
    (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, text }));
    });
    call.on("error", reject);
    call.end(payload);
  });
}

function upgrade(port, originHeader) {
  return new Promise((resolve, reject) => {
    const headers = { host: "signalbound-test.onrender.com",
      "x-forwarded-proto": "https", upgrade: "websocket", connection: "Upgrade",
      "sec-websocket-key": crypto.randomBytes(16).toString("base64"),
      "sec-websocket-version": "13" };
    if (originHeader) headers.origin = originHeader;
    const call = http.request({ host: "127.0.0.1", port, path: "/ws", headers });
    call.on("upgrade", (_response, socket) => { socket.destroy(); resolve(101); });
    call.on("response", (response) => {
      response.resume(); response.on("end", () => resolve(response.statusCode));
    });
    call.on("error", (error) => {
      if (originHeader === origin) reject(error);
      else if (error.code === "ECONNRESET") resolve(403);
      else reject(error);
    });
    call.end();
  });
}

test("Render test serves all modes with a data-loss notice and strict origins", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-render-"));
  const server = createServer({ config, dbPath: path.join(directory, "matches.sqlite"),
    isSimulationReady: () => true, isGameReady: () => true,
    isMultiplayerReady: () => true, isStorageReady: () => true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.rooms.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true }); });
  const port = server.address().port;
  for (const route of ["/", "/multiplayer", "/dashboard"]) {
    const response = await request(port, route);
    assert.equal(response.status, 200, route);
    assert.match(response.text, /TEMPORARY PUBLIC TEST/);
    assert.match(response.text, /leaderboard can disappear/);
  }
  assert.equal((await request(port, "/api/health")).status, 200);
  assert.equal((await request(port, "/", "GET", undefined,
    { "x-forwarded-proto": "http" })).status, 403);
  assert.equal((await request(port, "/api/rooms", "POST", { name: "Ada" },
    { origin: "https://wrong.onrender.com" })).status, 403);
  assert.equal((await request(port, "/api/rooms", "POST", { name: "Ada" },
    { origin })).status, 201);
  assert.equal(await upgrade(port), 403);
  assert.equal(await upgrade(port, "https://wrong.onrender.com"), 403);
  assert.equal(await upgrade(port, origin), 101);
});
