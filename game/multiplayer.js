"use strict";
const $ = (id) => document.getElementById(id);
const show = (id, yes) => $(id).classList.toggle("hidden", !yes);
const sessionKey = "signalbound.multiplayer.session.v1";
const names = { TRANSMIT: "Send your packet", RELAY: "Forward teammates' packets",
  SLEEP: "Restore 1.5 · lose trust", IDLE: "Hold position" };
let session = null, socket = null, room = null, lastSeq = 0, reconnectDelay = 500;
let reconnectTimer = null, activeAnimation = null, animationTimer = null;
let intentionallyClosed = false;

function notice(message) { $("notice").textContent = message; show("notice", Boolean(message)); }
function status(message) { $("connection-state").textContent = message; }
function saveSession(value) {
  session = value;
  if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
  else localStorage.removeItem(sessionKey);
}
function send(type, fields = {}) {
  if (socket?.readyState !== WebSocket.OPEN || !session) {
    notice("Connection is recovering. Your turn remains open on the server."); return;
  }
  socket.send(JSON.stringify({ v: 1, type, roomId: session.roomId, ...fields }));
}
async function request(route, body) {
  const response = await fetch(route, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Request failed.");
  return result;
}
async function enter(create) {
  const name = $("guest-name").value.trim();
  if (!name) { notice("Enter your name first."); $("guest-name").focus(); return; }
  const code = $("room-code").value.trim().toUpperCase();
  if (!create && !/^[A-Z2-9]{6}$/.test(code)) {
    notice("Enter a six-character room code."); return;
  }
  try {
    notice("");
    const result = await request(create ? "/api/rooms" : `/api/rooms/${code}/join`, { name });
    localStorage.setItem("signalbound.multiplayer.name", name);
    saveSession(result);
    history.replaceState(null, "", `/multiplayer?room=${result.roomId}`);
    connect();
  } catch (error) { notice(error.message); }
}
function connect() {
  if (!session) return;
  clearTimeout(reconnectTimer);
  intentionallyClosed = false;
  status("CONNECTING");
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener("open", () => {
    status("LIVE"); notice(""); reconnectDelay = 500;
    send("hello", { token: session.token, afterSeq: lastSeq });
  });
  socket.addEventListener("message", (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    receive(message);
  });
  socket.addEventListener("close", () => {
    if (intentionallyClosed || !session) return;
    status("RECONNECTING");
    notice("Connection lost. Rejoining your sensor…");
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 5000);
  });
}
function receive(message) {
  if (message.v !== 1) return;
  if (message.type === "error") {
    const code = message.data?.code || message.code;
    if (code === "NOT_MEMBER") { leaveLocal(); notice("This guest session is no longer valid."); }
    else notice(code?.replaceAll("_", " ") || "Room error.");
    return;
  }
  if (message.type === "snapshot") {
    room = { ...message.data, roomId: message.roomId, matchId: message.matchId,
      myNode: message.data.nodeId, seq: message.seq };
    lastSeq = message.seq;
    render(); return;
  }
  if (!room || message.roomId !== session?.roomId) return;
  if (message.type !== "accepted" && message.seq > lastSeq + 1) {
    socket?.close(); return;
  }
  if (message.type !== "accepted" && message.seq <= lastSeq) return;
  lastSeq = Math.max(lastSeq, message.seq);
  room.matchId = message.matchId;
  const data = message.data || {};
  if (message.type === "joined") room.players.push({ name: data.name, nodeId: data.nodeId,
    ready: false, connected: false, left: false, submitted: false });
  if (message.type === "presence") {
    const player = room.players.find((p) => p.nodeId === data.nodeId);
    if (player) player.connected = data.connected;
  }
  if (message.type === "ready" || message.type === "rematch_ready") {
    const player = room.players.find((p) => p.nodeId === data.nodeId);
    if (player) player.ready = message.type === "rematch_ready" ? true : data.ready;
  }
  if (message.type === "settings") room.settings.turnSeconds = data.turnSeconds;
  if (message.type === "left") {
    room.players = data.players;
    room.hostNodeId = data.hostNodeId;
    if (room.status === "lobby") send("hello", { token: session.token, afterSeq: lastSeq });
  }
  if (message.type === "match_started") {
    room.status = "playing"; room.state = data.state; room.deadline = null;
    room.players.forEach((p) => { p.ready = false; p.submitted = false; });
    activeAnimation = null;
  }
  if (message.type === "round_started") {
    room.status = "playing"; room.state = data.state; room.deadline = data.deadline;
    room.players = data.players;
    room.ownAction = null;
  }
  if (message.type === "accepted") room.ownAction = data.action;
  if (message.type === "submitted") {
    const player = room.players.find((p) => p.nodeId === data.nodeId);
    if (player) player.submitted = true;
  }
  if (message.type === "round_resolved") {
    room.state = data.state;
    activeAnimation = data.state.history.at(-1);
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => { activeAnimation = null; renderMap(); }, 1600);
  }
  if (message.type === "match_finished") {
    room.status = "finished"; room.state = data.state;
    room.ranking = data.ranking; room.eligible = data.eligible;
    room.persisted = data.persisted;
    room.players.forEach((p) => { p.ready = false; p.submitted = false; });
    loadLeaderboard();
  }
  if (message.type === "lobby_open") {
    room.status = "lobby"; room.state = null; room.players = data.players;
    room.hostNodeId = data.hostNodeId; room.matchId = null;
    room.deadline = null; room.ranking = null;
    send("hello", { token: session.token, afterSeq: lastSeq });
  }
  if (message.type === "abandoned") { room.status = "abandoned";
    notice("This match ended because all players were inactive."); }
  if (message.type === "engine_retry") notice(data.message);
  if (message.type === "record_saved") { room.persisted = true; loadLeaderboard(); }
  render();
}
function renderRoster(id, players, playing) {
  const list = $(id); list.replaceChildren();
  for (const player of players) {
    const item = document.createElement("li");
    const identity = document.createElement("span");
    identity.textContent = `NODE ${String(player.nodeId).padStart(2, "0")} · ${player.name}${player.nodeId === room.myNode ? " (YOU)" : ""}`;
    const state = document.createElement("span");
    state.textContent = player.left ? "LEFT / AUTO IDLE" : playing ?
      `${player.submitted ? "SUBMITTED" : "CHOOSING"} · ${player.connected ? "ONLINE" : "OFFLINE"}` :
      `${player.ready ? "READY" : "WAITING"} · ${player.connected ? "ONLINE" : "OFFLINE"}`;
    item.append(identity, state); list.append(item);
  }
}
function renderLobby() {
  $("lobby-code").textContent = room.roomId;
  renderRoster("lobby-players", room.players, false);
  const me = room.players.find((p) => p.nodeId === room.myNode);
  const isHost = room.hostNodeId === room.myNode;
  $("ready-button").textContent = me?.ready ? "NOT READY" : "READY";
  $("start-button").disabled = !isHost || room.players.length < 2 ||
    !room.players.every((p) => p.ready);
  $("start-button").title = isHost ? "Everyone must be ready" : "Only the host can start";
  const select = $("turn-seconds");
  if (![...select.options].some((option) => option.value === String(room.settings.turnSeconds))) {
    const option = document.createElement("option");
    option.value = String(room.settings.turnSeconds);
    option.textContent = `${room.settings.turnSeconds} seconds`;
    select.append(option);
  }
  select.value = String(room.settings.turnSeconds);
  $("turn-seconds").disabled = !isHost;
}
function renderMap() {
  if (!room?.state) return;
  window.SignalArt.drawMultiplayer(room.state, room.players, activeAnimation);
}
function renderActions() {
  const box = $("multi-actions"); box.replaceChildren();
  if (!room.state || room.status !== "playing") return;
  const player = room.state.players[room.myNode - 1];
  for (const action of Object.keys(names)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action${room.ownAction === action ? " selected" : ""}`;
    const title = document.createElement("strong"); title.textContent = action;
    const detail = document.createElement("small"); detail.textContent = names[action];
    button.append(title, detail);
    button.disabled = Boolean(room.ownAction) || !player?.legal[action] || !room.deadline;
    button.addEventListener("click", () => {
      send("action", { matchId: room.matchId,
        round: room.state.round + 1, action });
      button.disabled = true;
    });
    box.append(button);
  }
  $("turn-status").textContent = room.ownAction ? `LOCKED: ${room.ownAction}` :
    room.deadline ? "CHOOSE YOUR ACTION" : "RESOLVING";
}
function renderReport() {
  const turn = room.state?.history?.at(-1);
  if (!turn) return;
  const effects = turn.actions.map((_, i) => {
    const signed = (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
    return `${room.players[i]?.name || `Node ${i + 1}`}: battery ${signed(turn.energyDelta[i])}, ` +
      `trust ${signed(turn.reputationDelta[i] * 100)}%, score ${turn.scoreDelta[i] >= 0 ? "+" : ""}${turn.scoreDelta[i]}`;
  });
  $("round-report").textContent = `ROUND ${turn.round} · ${turn.actions.map((a, i) =>
    `${room.players[i]?.name || `Node ${i + 1}`}: ${a}`).join(" · ")}. ` +
    `Effects: ${effects.join("; ")}.${turn.routeChanged ?
      " Routes changed for the next round." : ""}`;
  const list = $("packet-report"); list.replaceChildren();
  if (!turn.packets.length) {
    const line = document.createElement("li"); line.textContent = "No sensor transmitted. No packet delivered.";
    list.append(line);
  }
  for (const packet of turn.packets) {
    const line = document.createElement("li");
    line.textContent = `Node ${packet.source}: ${packet.reason} Route ${packet.route.join(" → ") || "unavailable"}.`;
    list.append(line);
  }
}
function renderMatch() {
  const state = room.state;
  if (!state) return;
  $("team-delivered").textContent = `${state.delivered} / ${state.target}`;
  $("match-round").textContent = `${Math.min(state.round + 1, 8)} / 8`;
  $("match-code").textContent = room.roomId;
  const player = state.players[room.myNode - 1];
  if (player) {
    $("my-node").textContent = `NODE ${String(player.nodeId).padStart(2, "0")}`;
    $("my-position").textContent = `Position: sensor ${player.nodeId} in the shared route grid`;
    $("my-energy").textContent = `${player.energy.toFixed(1)} / 100`;
    $("my-energy-bar").style.width = `${player.energy}%`;
    $("my-reputation").textContent = `${Math.round(player.reputation * 100)}%`;
    $("my-reputation-bar").style.width = `${player.reputation * 100}%`;
    $("my-own").textContent = player.ownDelivered;
    $("my-relayed").textContent = player.relayed;
    $("my-score").textContent = player.score;
  }
  renderRoster("match-players", room.players, true);
  renderActions(); renderMap(); renderReport(); updateTimer();
}
function renderResults() {
  const state = room.state;
  $("result-heading").textContent = room.status === "abandoned" ? "Match abandoned" :
    state?.status === "won" ? "Network secured" : "Network fell short";
  $("result-summary").textContent = `${state?.delivered ?? 0} / ${state?.target ?? 6} packets delivered. ${room.eligible ?
    "This completed match counts toward the leaderboard." :
    "This inactive match does not count toward the leaderboard."}${room.persisted === false ?
    " Saving the result is retrying." : ""}`;
  const box = $("result-ranking"); box.replaceChildren();
  for (const [index, player] of (room.ranking || []).entries()) {
    const line = document.createElement("div"); line.className = "ranking-row";
    for (const value of [`#${index + 1}`, `${player.name} · Node ${player.nodeId}`,
      `${player.score} pts`, `${player.ownDelivered} own`, `${player.relayed} relayed`]) {
      const cell = document.createElement(value.includes("pts") ? "strong" : "span");
      cell.textContent = value; line.append(cell);
    }
    const detail = document.createElement("small");
    detail.className = "ranking-detail";
    detail.textContent = `${player.cooperativeRounds} helpful rounds · ${Math.round(player.reputation * 100)}% trust · ${player.energy.toFixed(1)} battery · ${player.selfishSleeps} sleeps`;
    line.append(detail);
    box.append(line);
  }
  $("rematch-button").disabled = room.status === "abandoned" ||
    Boolean(room.players.find((p) => p.nodeId === room.myNode)?.ready);
  $("rematch-button").textContent = room.status === "abandoned" ? "MATCH CLOSED" :
    $("rematch-button").disabled ? "WAITING FOR REMATCH" : "READY FOR REMATCH →";
  const host = room.players.find((p) => p.nodeId === room.hostNodeId);
  $("reopen-button").disabled = room.myNode !== room.hostNodeId && Boolean(host?.connected);
}
function render() {
  show("entry-panel", !room);
  show("lobby-panel", room?.status === "lobby" || room?.status === "starting");
  show("match-panel", room?.status === "playing");
  show("results-panel", room?.status === "finished" || room?.status === "abandoned");
  if (room?.status === "lobby" || room?.status === "starting") renderLobby();
  if (room?.status === "playing") renderMatch();
  if (room?.status === "finished" || room?.status === "abandoned") renderResults();
}
function updateTimer() {
  if (!room || room.status !== "playing") return;
  const remaining = room.deadline ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)) : 0;
  $("timer").textContent = room.deadline ? `${remaining}s` : "RESOLVING";
}
async function loadLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    const data = await response.json();
    if (!response.ok) throw new Error("Unavailable");
    const list = $("leaderboard-list"); list.replaceChildren();
    if (!data.entries.length) { const item = document.createElement("li");
      item.textContent = "No eligible matches yet."; list.append(item); }
    for (const entry of data.entries) { const item = document.createElement("li");
      item.textContent = `${entry.name} · ${entry.score} pts · ${entry.ownDelivered} own · ${entry.relayed} relayed`;
      list.append(item); }
  } catch { $("leaderboard-list").textContent = "Leaderboard temporarily unavailable."; }
}
function leaveLocal() {
  intentionallyClosed = true;
  socket?.close(); saveSession(null); room = null; lastSeq = 0;
  history.replaceState(null, "", "/multiplayer"); render(); status("OFFLINE");
}
$("create-room").addEventListener("click", () => enter(true));
$("join-room").addEventListener("click", () => enter(false));
$("ready-button").addEventListener("click", () => {
  const me = room?.players.find((p) => p.nodeId === room.myNode);
  if (me) send("ready", { ready: !me.ready });
});
$("start-button").addEventListener("click", () => send("start"));
$("turn-seconds").addEventListener("change", (event) =>
  send("settings", { turnSeconds: Number(event.target.value) }));
for (const id of ["leave-button", "results-leave"]) $(id).addEventListener("click", () => {
  send("leave"); leaveLocal();
});
$("rematch-button").addEventListener("click", () => send("rematch"));
$("reopen-button").addEventListener("click", () => send("reopen"));
$("guest-name").value = localStorage.getItem("signalbound.multiplayer.name") || "";
$("room-code").value = new URLSearchParams(location.search).get("room") || "";
try {
  const saved = JSON.parse(localStorage.getItem(sessionKey) || "null");
  if (saved?.roomId && saved?.token) { session = saved; connect(); }
} catch { localStorage.removeItem(sessionKey); }
setInterval(updateTimer, 250);
loadLeaderboard();
render();
