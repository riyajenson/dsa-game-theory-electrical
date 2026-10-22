"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { RoomServer } = require("./room-server");

const ROOT = __dirname;
const DASHBOARD_ROOT = path.join(ROOT, "dashboard");
const GAME_ROOT = path.join(ROOT, "game");
const SIMULATION_CLI = path.join(ROOT, "simulation_cli.exe");
const GAME_CLI = path.join(ROOT, "game_cli.exe");
const MULTIPLAYER_CLI = path.join(ROOT, "multiplayer_cli.exe");
const MAX_BODY_BYTES = 16 * 1024;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ttf": "font/ttf"
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

function validateGameInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).sort().join(",") !== "actions,profile,schemaVersion,seed") {
    return "Only schemaVersion, seed, profile, and actions are accepted.";
  }
  if (input.schemaVersion !== 2) return "Game schemaVersion must be 2.";
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 999999) {
    return "Seed must be an integer from 0 through 999999.";
  }
  if (!["cooperative", "mixed", "selfish"].includes(input.profile)) {
    return "Profile must be cooperative, mixed, or selfish.";
  }
  if (!Array.isArray(input.actions) || input.actions.length > 8 ||
      !input.actions.every((action) =>
        ["TRANSMIT", "RELAY", "SLEEP", "IDLE"].includes(action))) {
    return "Actions must be up to eight valid turn choices.";
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

function runGameProcess(input) {
  return new Promise((resolve, reject) => {
    execFile(GAME_CLI, ["--seed", String(input.seed), "--profile", input.profile,
      "--actions", input.actions.join(",")],
      { cwd: ROOT, timeout: 10000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) { reject(error); return; }
        try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); }
      });
  });
}

function serveStatic(requestPath, response) {
  const dashboard = requestPath === "/dashboard" || requestPath === "/dashboard/" ||
    requestPath.startsWith("/dashboard/");
  const root = dashboard ? DASHBOARD_ROOT : GAME_ROOT;
  const relativePath = dashboard
    ? (requestPath === "/dashboard" || requestPath === "/dashboard/" ? "index.html" : requestPath.slice(11))
    : (requestPath === "/" ? "index.html" :
      requestPath === "/multiplayer" || requestPath === "/multiplayer/" ?
        "multiplayer.html" : requestPath.slice(1));
  const allowed = dashboard ? ["index.html", "styles.css", "app.js"] :
    ["index.html", "multiplayer.html", "multiplayer.css", "multiplayer.js",
      "game.css", "polish.css", "art.js", "audio.js", "game.js",
      "assets/PressStart2P-Regular.ttf",
      "assets/SpaceGrotesk-Regular.ttf"];
  if (!allowed.includes(relativePath)) {
    sendError(response, 404, "NOT_FOUND", "Resource not found.");
    return;
  }
  const resolvedPath = path.join(root, relativePath);
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
  const runGame = options.runGame || runGameProcess;
  const isSimulationReady = options.isSimulationReady ||
    (() => fs.existsSync(SIMULATION_CLI));
  const isGameReady = options.isGameReady || (() => fs.existsSync(GAME_CLI));
  const isMultiplayerReady = options.isMultiplayerReady ||
    (() => fs.existsSync(MULTIPLAYER_CLI));
  const rooms = new RoomServer(options);
  const isStorageReady = options.isStorageReady || (() => {
    rooms.database().db.prepare("SELECT 1").get();
    return true;
  });

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    if (request.method === "POST" &&
        (requestUrl.pathname === "/api/rooms" ||
         /^\/api\/rooms\/[A-Z2-9]{6}\/join$/.test(requestUrl.pathname))) {
      if (!rooms.allowHttp(request.socket.remoteAddress || "unknown")) {
        sendError(response, 429, "RATE_LIMITED", "Too many room requests. Retry soon."); return;
      }
      if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        sendError(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json."); return;
      }
      let body;
      try { body = await readJsonBody(request); }
      catch { sendError(response, 400, "INVALID_JSON", "Invalid JSON body."); return; }
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).join(",") !== "name") {
        sendError(response, 400, "INVALID_INPUT", "Send a name only."); return;
      }
      try {
        const code = requestUrl.pathname.split("/")[3];
        const result = code ? rooms.join(code, body.name) : rooms.create(body.name);
        sendJson(response, code ? 200 : 201, result);
      } catch (error) {
        const status = error.message === "ROOM_NOT_FOUND" ? 404 :
          error.message === "ROOM_CLOSED" ? 409 : 400;
        sendError(response, status, error.message, error.message.replaceAll("_", " "));
      }
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/leaderboard") {
      try { sendJson(response, 200, { schemaVersion: 1, entries: rooms.database().leaderboard() }); }
      catch { sendError(response, 503, "STORAGE_UNAVAILABLE", "Leaderboard unavailable."); }
      return;
    }
    if (request.method === "GET" && /^\/api\/matches\/[a-f0-9-]{36}$/.test(requestUrl.pathname)) {
      try {
        const match = rooms.database().match(requestUrl.pathname.split("/")[3]);
        if (match) sendJson(response, 200, match);
        else sendError(response, 404, "NOT_FOUND", "Match not found.");
      } catch { sendError(response, 503, "STORAGE_UNAVAILABLE", "Match record unavailable."); }
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/game") {
      if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        sendError(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
        return;
      }
      let input;
      try { input = await readJsonBody(request); }
      catch (error) {
        sendError(response, error.code === "BODY_TOO_LARGE" ? 413 : 400,
          error.code === "BODY_TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_JSON", error.message);
        return;
      }
      const invalid = validateGameInput(input);
      if (invalid) { sendError(response, 400, "INVALID_INPUT", invalid); return; }
      try { sendJson(response, 200, await runGame(input)); }
      catch (error) {
        if (error.code === 2) sendError(response, 400, "INVALID_REPLAY", "The action history is not playable.");
        else sendError(response, 503, "GAME_UNAVAILABLE", "The game engine is unavailable.");
      }
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      let storageReady = false;
      try { storageReady = Boolean(isStorageReady()); }
      catch { storageReady = false; }
      const simulationReady = Boolean(isSimulationReady());
      const gameReady = Boolean(isGameReady());
      const multiplayerReady = Boolean(isMultiplayerReady());
      const healthy = simulationReady && gameReady && multiplayerReady && storageReady;
      sendJson(response, healthy ? 200 : 503, {
        status: healthy ? "ok" : "degraded",
        simulationReady, gameReady, multiplayerReady, storageReady
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
  server.on("upgrade", (request, socket, head) => rooms.upgrade(request, socket, head));
  server.on("close", () => rooms.close());
  server.rooms = rooms;
  return server;
}

if (require.main === module) {
  createServer().listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1", () => {
    console.log("Signalbound running");
  });
}

module.exports = {
  createServer,
  runSimulationProcess,
  validateInput,
  validateGameInput
};
