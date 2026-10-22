"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { MatchStore } = require("./match-store");

const ROOT = __dirname;
const ACTION_CODE = { TRANSMIT: "T", RELAY: "R", SLEEP: "S", IDLE: "I" };
const MAX_MESSAGE = 4096;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  return Array.from(crypto.randomBytes(6), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
function hash(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
function exact(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === keys.sort().join(",");
}
function engine(seed, count, history) {
  return new Promise((resolve, reject) => execFile(path.join(ROOT, "multiplayer_cli.exe"),
    ["--seed", String(seed), "--players", String(count), "--rounds", history.join(",")],
    { cwd: ROOT, timeout: 10000, windowsHide: true, maxBuffer: 1024 * 1024 },
    (error, stdout) => {
      if (error) reject(error);
      else { try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); } }
    }));
}

class WireSocket {
  constructor(socket, onMessage, onClose) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.rate = [];
    socket.on("data", (chunk) => this.read(chunk, onMessage));
    socket.on("close", () => { this.closed = true; onClose(); });
    socket.on("error", () => { this.closed = true; });
  }
  send(body) {
    if (this.closed || this.socket.destroyed) return;
    const content = Buffer.from(JSON.stringify(body));
    const header = content.length < 126 ? Buffer.from([0x81, content.length]) :
      Buffer.from([0x81, 126, content.length >> 8, content.length & 255]);
    this.socket.write(Buffer.concat([header, content]));
  }
  close() {
    if (!this.closed) { this.closed = true; this.socket.end(Buffer.from([0x88, 0])); }
  }
  read(chunk, onMessage) {
    if (this.buffer.length + chunk.length > 64 * 1024) { this.close(); return; }
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const opcode = this.buffer[0] & 15;
      const final = Boolean(this.buffer[0] & 0x80);
      const masked = Boolean(this.buffer[1] & 0x80);
      let size = this.buffer[1] & 127, offset = 2;
      if (size === 126) {
        if (this.buffer.length < 4) return;
        size = this.buffer.readUInt16BE(2); offset = 4;
      } else if (size === 127) { this.close(); return; }
      if (size > MAX_MESSAGE || !masked || !final) { this.close(); return; }
      if (this.buffer.length < offset + 4 + size) return;
      const mask = this.buffer.subarray(offset, offset + 4);
      const content = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + size));
      this.buffer = this.buffer.subarray(offset + 4 + size);
      for (let i = 0; i < size; ++i) content[i] ^= mask[i % 4];
      if (opcode === 8) { this.close(); return; }
      if (opcode === 9) {
        this.socket.write(Buffer.from([0x8a, content.length, ...content]));
        continue;
      }
      if (opcode !== 1) { this.close(); return; }
      const now = Date.now();
      this.rate = this.rate.filter((stamp) => now - stamp < 10000);
      this.rate.push(now);
      if (this.rate.length > 30) { this.close(); return; }
      try { onMessage(JSON.parse(content.toString("utf8"))); }
      catch { this.send({ v: 1, type: "error", code: "INVALID_JSON" }); }
    }
  }
}

class RoomServer {
  constructor(options = {}) {
    this.rooms = new Map();
    this.runEngine = options.runMultiplayer || engine;
    this.dbPath = options.dbPath || process.env.SIGNALBOUND_DB_PATH ||
      path.join(ROOT, "data", "matches.sqlite");
    this.store = null;
    this.httpRate = new Map();
    this.defaultTurnSeconds = options.turnSeconds || Number(process.env.TURN_SECONDS || 30);
    this.allowedOrigins = (options.allowedOrigins || process.env.ALLOWED_ORIGINS || "").split(",")
      .map((value) => value.trim()).filter(Boolean);
    this.requireOrigin = Boolean(options.requireOrigin);
    this.sweeper = setInterval(() => this.sweep(), 60000);
    this.sweeper.unref?.();
  }
  database() { return this.store ||= new MatchStore(this.dbPath); }
  allowHttp(address) {
    const now = Date.now();
    const times = (this.httpRate.get(address) || []).filter((time) => now - time < 60000);
    times.push(now);
    this.httpRate.set(address, times);
    return times.length <= 20;
  }
  player(name, nodeId) {
    if (typeof name !== "string" || name.length < 1 || name.length > 20 ||
        !/^[\x20-\x7e]+$/.test(name.trim())) throw new Error("INVALID_NAME");
    const token = crypto.randomBytes(32).toString("hex");
    return { token, member: { name: name.trim(), nodeId, tokenHash: hash(token),
      ready: false, left: false, sockets: new Set(), acceptedCount: 0 } };
  }
  create(name) {
    const { token, member } = this.player(name, 1);
    let id;
    do { id = randomCode(); } while (this.rooms.has(id));
    const room = { id, players: [member], hostHash: member.tokenHash,
      status: "lobby", seq: 0, matchId: null, seed: null, history: [],
      actions: new Map(), deadline: null, timer: null, turnSeconds: this.defaultTurnSeconds,
      state: null, lastActivity: Date.now(), idleRounds: 0, resolving: false };
    this.rooms.set(id, room);
    return { roomId: id, token, nodeId: 1 };
  }
  join(id, name) {
    const room = this.rooms.get(id);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    if (room.status !== "lobby" || room.players.length >= 4) throw new Error("ROOM_CLOSED");
    const { token, member } = this.player(name, room.players.length + 1);
    room.players.push(member);
    room.lastActivity = Date.now();
    this.emit(room, "joined", { nodeId: member.nodeId, name: member.name });
    return { roomId: id, token, nodeId: member.nodeId };
  }
  publicState(room) {
    return { status: room.status, hostNodeId: room.players.find((p) =>
      p.tokenHash === room.hostHash)?.nodeId || null,
      players: room.players.map((p) => ({ name: p.name, nodeId: p.nodeId,
        ready: p.ready, connected: p.sockets.size > 0, left: p.left,
        submitted: room.actions.has(p.nodeId) })),
      settings: { turnSeconds: room.turnSeconds, maxRounds: 8, target: 6 },
      seed: room.seed, deadline: room.deadline, state: room.state,
      history: room.history.join(","), ranking: room.ranking || null,
      eligible: room.eligible || false, persisted: room.persisted ?? null };
  }
  envelope(room, type, data, seq = room.seq) {
    return { v: 1, type, roomId: room.id, matchId: room.matchId,
      seq, round: room.state?.round || 0, data };
  }
  emit(room, type, data) {
    room.seq++;
    const event = this.envelope(room, type, data);
    for (const player of room.players) for (const socket of player.sockets) socket.send(event);
    return event;
  }
  snapshot(room, player, socket) {
    socket.send(this.envelope(room, "snapshot", { ...this.publicState(room),
      nodeId: player.nodeId, ownAction: room.actions.get(player.nodeId) || null }));
  }
  error(socket, room, code) { socket.send(room ? this.envelope(room, "error", { code }) :
    { v: 1, type: "error", code }); }
  async start(room) {
    room.seed = crypto.randomInt(0, 1000000);
    room.matchId = crypto.randomUUID();
    room.history = [];
    room.actions.clear();
    room.idleRounds = 0;
    room.hadInactiveStreak = false;
    room.ranking = null;
    room.eligible = false;
    room.persisted = null;
    room.players.forEach((player) => { player.ready = false; player.acceptedCount = 0; });
    room.state = await this.runEngine(room.seed, room.players.length, room.history);
    room.status = "playing";
    this.emit(room, "match_started", { state: room.state });
    this.beginRound(room);
  }
  beginRound(room) {
    room.actions.clear();
    room.deadline = Date.now() + room.turnSeconds * 1000;
    clearTimeout(room.timer);
    room.timer = setTimeout(() => this.resolve(room), room.turnSeconds * 1000);
    room.timer.unref?.();
    this.emit(room, "round_started", { deadline: room.deadline,
      state: room.state, players: this.publicState(room).players });
    for (const player of room.players) for (const socket of player.sockets)
      this.snapshot(room, player, socket);
  }
  async resolve(room) {
    if (room.status !== "playing" || room.resolving) return;
    room.resolving = true;
    clearTimeout(room.timer);
    const row = room.players.map((player) => ACTION_CODE[room.actions.get(player.nodeId) || "IDLE"]).join("");
    try {
      const next = await this.runEngine(room.seed, room.players.length,
        [...room.history, row]);
      room.history.push(row);
      room.state = next;
      room.deadline = null;
      if (!room.actions.size) room.idleRounds++;
      else room.idleRounds = 0;
      if (room.idleRounds >= 2) room.hadInactiveStreak = true;
      this.emit(room, "round_resolved", { state: next, record: row });
      if (next.status !== "playing") {
        room.status = "finished";
        const eligible = room.players.length >= 2 && room.players.every((p) =>
          p.acceptedCount > 0) && !room.hadInactiveStreak;
        room.eligible = eligible;
        room.ranking = this.ranking(room, next);
        let persisted = false;
        try { this.database().save(room, next, eligible); persisted = true; }
        catch { this.retrySave(room); }
        room.persisted = persisted;
        this.emit(room, "match_finished", { state: next, eligible,
          ranking: room.ranking, persisted });
      } else if (room.idleRounds >= 2 && room.players.every((p) => p.sockets.size === 0 || p.left)) {
        room.status = "abandoned";
        try { this.database().save(room, next, false, "abandoned"); }
        catch { this.retrySave(room); }
        this.emit(room, "abandoned", { reason: "All players inactive." });
      } else this.beginRound(room);
    } catch {
      room.timer = setTimeout(() => this.resolve(room), 1000);
      room.timer.unref?.();
      this.emit(room, "engine_retry", { message: "Round resolution is retrying." });
    } finally { room.resolving = false; }
  }
  ranking(room, state) {
    return state.players.map((result, i) => ({ name: room.players[i].name,
      nodeId: result.nodeId, score: result.score, ownDelivered: result.ownDelivered,
      relayed: result.relayed, cooperativeRounds: result.cooperativeRounds,
      selfishSleeps: result.selfishSleeps, energy: result.energy,
      reputation: result.reputation })).sort((a, b) =>
      b.score - a.score || b.ownDelivered - a.ownDelivered || b.relayed - a.relayed ||
      b.reputation - a.reputation || a.nodeId - b.nodeId);
  }
  openLobby(room, players) {
    room.players = players;
    room.players.forEach((p, i) => { p.nodeId = i + 1; p.ready = false; });
    if (!room.players.some((p) => p.tokenHash === room.hostHash))
      room.hostHash = room.players[0]?.tokenHash || null;
    room.status = "lobby";
    room.matchId = null; room.seed = null; room.state = null;
    room.history = []; room.deadline = null;
    room.ranking = null; room.eligible = false;
    room.lastActivity = Date.now();
    this.emit(room, "lobby_open", { players: this.publicState(room).players,
      hostNodeId: room.players.find((p) => p.tokenHash === room.hostHash)?.nodeId || null });
  }
  retrySave(room) {
    const record = { id: room.id, matchId: room.matchId, seed: room.seed,
      history: [...room.history], players: room.players.map((p) => ({
        name: p.name, tokenHash: p.tokenHash })) };
    const state = room.state;
    const eligible = room.status === "finished" && room.eligible;
    const attempt = () => {
      try {
        this.database().save(record, state, eligible,
          eligible || state.status !== "playing" ? state.status : "abandoned");
        if (room.matchId === record.matchId) {
          room.persisted = true;
          this.emit(room, "record_saved", { matchId: record.matchId });
        }
      } catch {
        const timer = setTimeout(attempt, 5000);
        timer.unref?.();
        room.saveTimers ||= new Set();
        room.saveTimers.add(timer);
      }
    };
    const timer = setTimeout(attempt, 5000);
    timer.unref?.();
    room.saveTimers ||= new Set();
    room.saveTimers.add(timer);
  }
  handle(socket, message) {
    if (!message || typeof message !== "object" || Array.isArray(message) || message.v !== 1 ||
        typeof message.type !== "string" || typeof message.roomId !== "string") {
      return this.error(socket, null, "INVALID_MESSAGE");
    }
    if (message.type === "hello") {
      if (!exact(message, ["v", "type", "roomId", "token", "afterSeq"]) ||
          !Number.isSafeInteger(message.afterSeq) || message.afterSeq < 0 ||
          !/^[a-f0-9]{64}$/.test(message.token)) return this.error(socket, null, "INVALID_MESSAGE");
      const room = this.rooms.get(message.roomId);
      const player = room?.players.find((p) => p.tokenHash === hash(message.token) && !p.left);
      if (!player) return this.error(socket, null, "NOT_MEMBER");
      if (socket.player) socket.player.sockets.delete(socket);
      socket.room = room; socket.player = player;
      player.sockets.add(socket);
      room.lastActivity = Date.now();
      this.snapshot(room, player, socket);
      this.emit(room, "presence", { nodeId: player.nodeId, connected: true });
      return;
    }
    const room = socket.room, player = socket.player;
    if (!room || !player || room.id !== message.roomId || player.left)
      return this.error(socket, room, "NOT_MEMBER");
    room.lastActivity = Date.now();
    const host = player.tokenHash === room.hostHash;
    if (message.type === "ready") {
      if (!exact(message, ["v", "type", "roomId", "ready"]) ||
          typeof message.ready !== "boolean" || room.status !== "lobby")
        return this.error(socket, room, "INVALID_STATE");
      player.ready = message.ready;
      this.emit(room, "ready", { nodeId: player.nodeId, ready: player.ready });
    } else if (message.type === "settings") {
      if (!exact(message, ["v", "type", "roomId", "turnSeconds"]) || !host ||
          room.status !== "lobby" || !Number.isInteger(message.turnSeconds) ||
          message.turnSeconds < 20 || message.turnSeconds > 90)
        return this.error(socket, room, "INVALID_SETTINGS");
      room.turnSeconds = message.turnSeconds;
      this.emit(room, "settings", { turnSeconds: room.turnSeconds });
    } else if (message.type === "start") {
      if (!exact(message, ["v", "type", "roomId"]) || !host ||
          room.status !== "lobby" || room.players.length < 2 ||
          !room.players.every((p) => p.ready)) return this.error(socket, room, "CANNOT_START");
      room.status = "starting";
      this.start(room).catch(() => {
        room.status = "lobby";
        this.emit(room, "engine_retry", { message: "Engine unavailable. Try start again." });
      });
    } else if (message.type === "action") {
      if (!exact(message, ["v", "type", "roomId", "matchId", "round", "action"]) ||
          room.status !== "playing" || room.resolving ||
          message.matchId !== room.matchId || message.round !== room.state.round + 1 ||
          !(message.action in ACTION_CODE)) return this.error(socket, room, "INVALID_ACTION");
      if (room.actions.has(player.nodeId)) return this.error(socket, room, "DUPLICATE_ACTION");
      if (!room.state.players[player.nodeId - 1].legal[message.action])
        return this.error(socket, room, "ILLEGAL_ACTION");
      room.actions.set(player.nodeId, message.action);
      player.acceptedCount++;
      socket.send(this.envelope(room, "accepted", { round: message.round, action: message.action }));
      this.emit(room, "submitted", { nodeId: player.nodeId,
        submitted: true, count: room.actions.size });
      if (room.actions.size === room.players.length) this.resolve(room);
    } else if (message.type === "leave") {
      if (!exact(message, ["v", "type", "roomId"])) return this.error(socket, room, "INVALID_MESSAGE");
      player.left = true;
      if (room.status === "lobby") {
        room.players.splice(room.players.indexOf(player), 1);
        room.players.forEach((p, i) => { p.nodeId = i + 1; });
        if (host) room.hostHash = room.players[0]?.tokenHash || null;
        if (!room.players.length) this.rooms.delete(room.id);
      }
      this.emit(room, "left", { nodeId: player.nodeId,
        hostNodeId: room.players.find((p) => p.tokenHash === room.hostHash)?.nodeId || null,
        players: this.publicState(room).players });
      socket.close();
    } else if (message.type === "rematch") {
      if (!exact(message, ["v", "type", "roomId"]) || room.status !== "finished")
        return this.error(socket, room, "INVALID_STATE");
      player.ready = true;
      this.emit(room, "rematch_ready", { nodeId: player.nodeId });
      if (room.players.every((p) => p.ready || p.left)) {
        room.players = room.players.filter((p) => !p.left);
        room.players.forEach((p, i) => { p.nodeId = i + 1; });
        if (!room.players.some((p) => p.tokenHash === room.hostHash))
          room.hostHash = room.players[0]?.tokenHash || null;
        if (room.players.length < 2) {
          this.openLobby(room, room.players);
          return;
        }
        room.status = "starting";
        this.start(room).catch(() => { room.status = "finished"; });
      }
    } else if (message.type === "reopen") {
      const hostPlayer = room.players.find((p) => p.tokenHash === room.hostHash);
      if (!exact(message, ["v", "type", "roomId"]) ||
          !["finished", "abandoned"].includes(room.status) ||
          (!host && hostPlayer?.sockets.size))
        return this.error(socket, room, "CANNOT_REOPEN");
      this.openLobby(room, room.players.filter((p) => !p.left && p.sockets.size > 0));
    } else this.error(socket, room, "INVALID_MESSAGE");
  }
  upgrade(request, socket, head) {
    const url = new URL(request.url, "http://localhost");
    const origin = request.headers.origin;
    const originAllowed = (!this.requireOrigin && !origin) || (origin && (this.allowedOrigins.length ?
      this.allowedOrigins.includes(origin) : (() => {
        try { return new URL(origin).host === request.headers.host; }
        catch { return false; }
      })()));
    if (url.pathname !== "/ws" || !originAllowed ||
        request.headers.upgrade?.toLowerCase() !== "websocket" ||
        !/^[A-Za-z0-9+/]{22}==$/.test(request.headers["sec-websocket-key"] || "")) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return;
    }
    const accept = crypto.createHash("sha1").update(request.headers["sec-websocket-key"] +
      "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n" +
      "Connection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
    const wire = new WireSocket(socket, (message) => this.handle(wire, message), () => {
      if (wire.player) {
        wire.player.sockets.delete(wire);
        this.emit(wire.room, "presence", { nodeId: wire.player.nodeId,
          connected: wire.player.sockets.size > 0 });
      }
    });
    if (head.length) wire.read(head, (message) => this.handle(wire, message));
  }
  sweep() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      if (["lobby", "finished", "abandoned"].includes(room.status) &&
          now - room.lastActivity > 30 * 60 * 1000) {
        this.rooms.delete(room.id);
        clearTimeout(room.timer);
        for (const player of room.players) for (const socket of player.sockets) socket.close();
      }
    }
    for (const [address, times] of this.httpRate)
      if (times.every((time) => now - time >= 60000)) this.httpRate.delete(address);
  }
  close() {
    clearInterval(this.sweeper);
    for (const room of this.rooms.values()) {
      clearTimeout(room.timer);
      for (const timer of room.saveTimers || []) clearTimeout(timer);
      for (const player of room.players) for (const socket of player.sockets) socket.close();
    }
    this.store?.db.close();
  }
}
module.exports = { RoomServer, engine };
