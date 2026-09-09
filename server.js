"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = __dirname;
const DASHBOARD_ROOT = path.join(ROOT, "dashboard");
const SIMULATION_CLI = path.join(ROOT, "simulation_cli.exe");
const MAX_BODY_BYTES = 16 * 1024;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store"
  });
  response.end(payload);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "Request body must be a JSON object.";
  }
  const keys = Object.keys(input).sort();
  if (keys.length !== 2 || keys[0] !== "rounds" || keys[1] !== "strategy") {
    return "Only rounds and strategy are accepted.";
  }
  if (!Number.isInteger(input.rounds) || input.rounds < 1 || input.rounds > 20) {
    return "Rounds must be an integer from 1 through 20.";
  }
  if (!["cooperative", "selfish", "mixed"].includes(input.strategy)) {
    return "Strategy must be cooperative, selfish, or mixed.";
  }
  return null;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), {
          code: "BODY_TOO_LARGE"
        }));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body is not valid JSON."), {
          code: "INVALID_JSON"
        }));
      }
    });
    request.on("error", reject);
  });
}

function runSimulationProcess(input) {
  return new Promise((resolve, reject) => {
    execFile(
      SIMULATION_CLI,
      ["--rounds", String(input.rounds), "--strategy", input.strategy],
      { cwd: ROOT, timeout: 10000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

function serveStatic(requestPath, response) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const resolvedPath = path.resolve(DASHBOARD_ROOT, relativePath);
  if (
    !resolvedPath.startsWith(DASHBOARD_ROOT + path.sep) ||
    !["index.html", "styles.css", "app.js"].includes(relativePath)
  ) {
    sendError(response, 404, "NOT_FOUND", "Resource not found.");
    return;
  }
  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      sendError(response, 404, "NOT_FOUND", "Resource not found.");
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[path.extname(resolvedPath)] ||
        "application/octet-stream",
      "content-length": content.length,
      "x-content-type-options": "nosniff"
    });
    response.end(content);
  });
}

function createServer(options = {}) {
  const runSimulation = options.runSimulation || runSimulationProcess;
  const isSimulationReady = options.isSimulationReady ||
    (() => fs.existsSync(SIMULATION_CLI));

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        simulationReady: Boolean(isSimulationReady())
      });
      return;
    }

    if (request.method === "POST" &&
        requestUrl.pathname === "/api/simulations") {
      if (!String(request.headers["content-type"] || "")
          .toLowerCase()
          .startsWith("application/json")) {
        sendError(
          response,
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Use application/json."
        );
        return;
      }
      let input;
      try {
        input = await readJsonBody(request);
      } catch (error) {
        const tooLarge = error.code === "BODY_TOO_LARGE";
        sendError(
          response,
          tooLarge ? 413 : 400,
          tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON",
          error.message
        );
        return;
      }
      const validationError = validateInput(input);
      if (validationError) {
        sendError(response, 400, "INVALID_INPUT", validationError);
        return;
      }
      try {
        sendJson(response, 200, await runSimulation(input));
      } catch {
        sendError(
          response,
          503,
          "SIMULATION_FAILED",
          "The simulation could not be completed."
        );
      }
      return;
    }

    if (request.method === "GET" && !requestUrl.pathname.startsWith("/api/")) {
      serveStatic(requestUrl.pathname, response);
      return;
    }

    sendError(response, 404, "NOT_FOUND", "Resource not found.");
  });
}

if (require.main === module) {
  createServer().listen(3000, "127.0.0.1", () => {
    console.log("Dashboard running at http://127.0.0.1:3000");
  });
}

module.exports = {
  createServer,
  runSimulationProcess,
  validateInput
};
