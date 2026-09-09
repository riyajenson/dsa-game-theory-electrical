"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createServer } = require("../server");

function request(server, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const payload = body === undefined
        ? undefined
        : (typeof body === "string" ? body : JSON.stringify(body));
      const requestHeaders = Object.assign({}, headers);
      if (payload !== undefined) {
        if (!requestHeaders["content-type"]) {
          requestHeaders["content-type"] = "application/json";
        }
        requestHeaders["content-length"] = Buffer.byteLength(payload);
      }
      const req = http.request({
        host: "127.0.0.1",
        port: address.port,
        method,
        path,
        headers: requestHeaders
      }, (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { text += chunk; });
        response.on("end", () => {
          server.close(() => {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              text,
              body: response.headers["content-type"]?.includes("json")
                ? JSON.parse(text)
                : text
            });
          });
        });
      });
      req.on("error", reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  });
}

test("health reports injected runner readiness", async () => {
  const server = createServer({
    isSimulationReady: () => true,
    runSimulation: async () => ({ schemaVersion: 1 })
  });
  const response = await request(server, "GET", "/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok", simulationReady: true });
});

test("simulation endpoint validates and forwards complete input", async () => {
  const server = createServer({
    isSimulationReady: () => true,
    runSimulation: async (input) => ({ schemaVersion: 1, input })
  });
  const response = await request(server, "POST", "/api/simulations", {
    rounds: 3,
    strategy: "mixed"
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.input, { rounds: 3, strategy: "mixed" });
});

test("invalid simulation inputs return stable error responses", async () => {
  const cases = [
    { body: "{", status: 400, code: "INVALID_JSON" },
    { body: { rounds: 0, strategy: "mixed" }, status: 400, code: "INVALID_INPUT" },
    { body: { rounds: 2, strategy: "mixed", extra: true }, status: 400, code: "INVALID_INPUT" }
  ];
  for (const entry of cases) {
    const server = createServer({
      isSimulationReady: () => true,
      runSimulation: async () => ({ schemaVersion: 1 })
    });
    const response = await request(server, "POST", "/api/simulations", entry.body);
    assert.equal(response.status, entry.status);
    assert.equal(response.body.error.code, entry.code);
  }
});

test("non-json simulation request is rejected", async () => {
  const server = createServer({
    isSimulationReady: () => true,
    runSimulation: async () => ({ schemaVersion: 1 })
  });
  const response = await request(
    server,
    "POST",
    "/api/simulations",
    "rounds=3",
    { "content-type": "text/plain" }
  );
  assert.equal(response.status, 415);
  assert.equal(response.body.error.code, "UNSUPPORTED_MEDIA_TYPE");
});

test("runner failures become controlled service errors", async () => {
  const server = createServer({
    isSimulationReady: () => true,
    runSimulation: async () => { throw new Error("process failed"); }
  });
  const response = await request(server, "POST", "/api/simulations", {
    rounds: 3,
    strategy: "mixed"
  });
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, "SIMULATION_FAILED");
  assert.doesNotMatch(response.text, /process failed/);
});

test("serves dashboard and rejects unknown paths", async () => {
  const options = {
    isSimulationReady: () => true,
    runSimulation: async () => ({ schemaVersion: 1 })
  };
  const indexResponse = await request(createServer(options), "GET", "/");
  assert.equal(indexResponse.status, 200);
  assert.match(indexResponse.text, /Energy-Aware Sensor Network/);

  const missingResponse = await request(createServer(options), "GET", "/missing");
  assert.equal(missingResponse.status, 404);
});
