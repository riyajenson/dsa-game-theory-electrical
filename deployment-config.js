"use strict";
const path = require("node:path");

function loadConfig(env = process.env) {
  const mode = env.SIGNALBOUND_ENV || "local";
  if (!["local", "production", "render-test"].includes(mode))
    throw new Error("Invalid SIGNALBOUND_ENV");
  const host = env.HOST || "127.0.0.1";
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const dataDir = env.SIGNALBOUND_DATA_DIR || path.join(__dirname, "data");
  const dbPath = env.SIGNALBOUND_DB_PATH || path.join(dataDir, "matches.sqlite");
  const publicOrigin = mode === "render-test" ? env.RENDER_EXTERNAL_URL :
    (env.PUBLIC_ORIGIN || null);
  const allowedOrigins = mode === "render-test" ? [publicOrigin] :
    (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const trustProxy = env.TRUST_PROXY || "none";
  const cookieMode = env.COOKIE_MODE || "none";
  const logLevel = env.LOG_LEVEL || "info";
  const turnSeconds = Number(env.TURN_SECONDS || 30);
  if (!["none", "loopback", "render"].includes(trustProxy) || cookieMode !== "none" ||
      !["info", "warn", "error"].includes(logLevel) ||
      !Number.isFinite(turnSeconds) || turnSeconds < 0.1 || turnSeconds > 90)
    throw new Error("Invalid deployment setting");
  if (mode === "production") {
    let origin;
    try { origin = new URL(publicOrigin); }
    catch { throw new Error("PUBLIC_ORIGIN must be an HTTPS origin"); }
    if (origin.protocol !== "https:" || origin.origin !== publicOrigin ||
        !origin.hostname.includes(".") ||
        !["127.0.0.1", "::1"].includes(host) || trustProxy !== "loopback" ||
        allowedOrigins.length !== 1 || allowedOrigins[0] !== publicOrigin ||
        !env.SIGNALBOUND_DATA_DIR || !path.isAbsolute(dbPath) ||
        !path.isAbsolute(dataDir) || path.relative(dataDir, dbPath).startsWith("..") ||
        turnSeconds < 20)
      throw new Error("Unsafe production configuration");
  }
  if (mode === "render-test") {
    let origin;
    try { origin = new URL(publicOrigin); }
    catch { throw new Error("Invalid Render test origin"); }
    if (env.RENDER !== "true" || origin.protocol !== "https:" ||
        origin.origin !== publicOrigin ||
        !origin.hostname.endsWith(".onrender.com") ||
        origin.hostname === ".onrender.com" ||
        (env.PUBLIC_ORIGIN && env.PUBLIC_ORIGIN !== publicOrigin) ||
        (env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS !== publicOrigin) ||
        host !== "0.0.0.0" || !env.PORT || trustProxy !== "render" ||
        dataDir !== "/tmp/signalbound" ||
        dbPath !== path.join(dataDir, "matches.sqlite") || turnSeconds < 20)
      throw new Error("Unsafe Render test configuration");
  }
  return { mode, host, port, dataDir, dbPath, publicOrigin, allowedOrigins,
    trustProxy, cookieMode, logLevel, turnSeconds };
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" ||
    address === "::ffff:127.0.0.1";
}

function trustedRequest(request, config) {
  if (config.mode === "local") return true;
  if (config.mode === "production" && !isLoopback(request.socket.remoteAddress))
    return false;
  if (request.headers.host !== new URL(config.publicOrigin).host) return false;
  if (request.headers["x-forwarded-proto"] !== "https") return false;
  const forwardedHost = request.headers["x-forwarded-host"];
  return !forwardedHost || forwardedHost === request.headers.host;
}

function logEvent(config, level, event, fields = {}) {
  const rank = { info: 0, warn: 1, error: 2 };
  if (rank[level] < rank[config.logLevel]) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

module.exports = { loadConfig, trustedRequest, logEvent };
