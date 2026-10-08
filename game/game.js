"use strict";

const actionInfo = {
  TRANSMIT: { icon: "↗", title: "TRANSMIT", sub: "Send your packet" },
  RELAY: { icon: "⇄", title: "RELAY", sub: "Help a neighbor" },
  SLEEP: { icon: "▣", title: "SLEEP", sub: "Recharge · lose trust" },
  IDLE: { icon: "Ⅱ", title: "IDLE", sub: "Let packet expire" }
};
const actions = [];
let seed = Number(new URLSearchParams(location.search).get("seed") ?? 17);
if (!Number.isInteger(seed) || seed < 0 || seed > 999999) seed = 17;
let profile = new URLSearchParams(location.search).get("profile") || "mixed";
if (!["cooperative", "mixed", "selfish"].includes(profile)) profile = "mixed";
let state = null;
let selected = null;
let paused = false;
let busy = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const visible = (id, show) => byId(id).classList.toggle("hidden", !show);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const byId = (id) => document.getElementById(id);
const routeText = (route) => route && route.length ? route.map((id) => String(id).padStart(2, "0")).join(" → ") : "NO ROUTE";
const signed = (value, suffix = "") => `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;

async function requestGame(history) {
  const response = await fetch("/api/game", {
    method: "POST", headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ schemaVersion: 2, seed, profile, actions: history })
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error("The engine returned an unreadable response. Retry the turn."); }
  if (!response.ok) throw new Error(data.error?.message || "The engine did not respond.");
  return data;
}

function setStatus(message) {
  byId("packet-goal").textContent = message;
}

function connectionError(error) {
  byId("connection-message").textContent = `Engine unavailable: ${error.message}`;
  visible("connection-banner", true);
  setStatus("Connection lost. Your current turn is safe; retry to continue.");
}

function drawMap(data) { window.SignalArt.draw(data); }

function renderActions(data) {
  const grid = byId("action-grid");
  grid.replaceChildren();
  for (const preview of data.previews) {
    const info = actionInfo[preview.action];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action${selected === preview.action ? " selected" : ""}`;
    button.dataset.action = preview.action;
    button.disabled = !preview.legal || paused || busy || !byId("title-screen").classList.contains("hidden") || !byId("tutorial").classList.contains("hidden");
    button.title = preview.legal ? `${info.title}: ${preview.outcome}` : preview.reason;
    const icon = document.createElement("span");
    icon.className = "action-icon";
    icon.textContent = info.icon;
    const labels = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${data.previews.indexOf(preview) + 1} ${info.title}`;
    const small = document.createElement("small");
    small.textContent = preview.legal ? info.sub : preview.reason;
    labels.append(strong, small);
    button.append(icon, labels);
    button.addEventListener("click", () => selectAction(preview.action));
    grid.append(button);
  }
  updatePreview();
}

function selectAction(action) {
  if (!state || paused || busy || state.status !== "playing") return;
  const preview = state.previews.find((item) => item.action === action);
  if (!preview?.legal) return;
  selected = action;
  renderActions(state);
  window.SignalAudio.play("select");
}

function updatePreview() {
  const preview = state?.previews.find((item) => item.action === selected);
  const text = byId("preview-text");
  text.textContent = preview
    ? `${preview.outcome} · Battery ${signed(preview.energyDelta)} · Trust ${signed(preview.reputationDelta * 100, "%")}${preview.route.length ? ` · Route ${routeText(preview.route)}` : ""}`
    : "Select an action to inspect the engine's exact next turn.";
  byId("confirm-action").disabled = !preview || paused || busy;
}

function render(data) {
  state = data;
  const player = data.nodes[0];
  byId("seed-value").textContent = String(data.seed).padStart(4, "0");
  byId("round-value").textContent = Math.min(data.round + 1, data.maxRounds);
  byId("rounds-left").textContent = data.maxRounds - data.round;
  byId("goal-count").textContent = `${data.deliveredPackets} / ${data.objective.deliver}`;
  byId("trust-goal").textContent = `${Math.round(data.objective.minimumReputation * 100)}%+`;
  byId("title-seed-value").textContent = String(data.seed).padStart(4, "0");
  byId("energy-value").textContent = `${player.energy.toFixed(1)} / 100`;
  byId("reputation-value").textContent = `${Math.round(player.reputation * 100)}%`;
  byId("energy-bar").style.width = `${player.energy}%`;
  byId("reputation-bar").style.width = `${player.reputation * 100}%`;
  byId("player-status").textContent = player.energy < 10 ? "● LOW BATTERY" : player.reputation < data.objective.minimumReputation ? "● LOW TRUST" : "● ONLINE";
  byId("player-status").classList.toggle("warning", player.energy < 10 || player.reputation < data.objective.minimumReputation);
  byId("delivered-value").textContent = data.deliveredPackets;
  byId("ratio-value").textContent = `${Math.round(data.deliveryRatio)}%`;
  byId("score-value").textContent = String(data.score).padStart(3, "0");
  byId("short-route").textContent = routeText(data.routes.shortest);
  byId("aware-route").textContent = routeText(data.routes.energyAware);
  byId("surge-chip").textContent = data.currentPacket?.surge ? "⚡ SIGNAL SURGE" : "NORMAL SIGNAL";
  byId("surge-chip").classList.toggle("surging", !!data.currentPacket?.surge);
  drawMap(data);
  renderActions(data);
  const events = byId("event-list");
  events.replaceChildren();
  if (!data.history.length) {
    const li = document.createElement("li"); li.textContent = "Awaiting your first decision."; events.append(li);
  }
  for (const turn of [...data.history].reverse()) {
    const li = document.createElement("li");
    li.textContent = `R${turn.round} · ${turn.action} — ${turn.message} (${signed(turn.energyDelta)} battery, ${signed(turn.reputationDelta * 100, "%")} trust, ${signed(turn.scoreDelta)} score).${turn.routeChanged ? " Safer route changed." : ""} AI: ${turn.aiActions.map((action, index) => `${String(index + 2).padStart(2, "0")} ${action}`).join(" · ")}`;
    events.append(li);
  }
  if (data.status === "playing") {
    setStatus(data.currentPacket.relayRequest
      ? `Node ${String(data.currentPacket.destination).padStart(2, "0")} awaits your packet. A neighbor requests relay from ${String(data.currentPacket.relaySource).padStart(2, "0")} to ${String(data.currentPacket.relayDestination).padStart(2, "0")}. Inspect the engine preview.`
      : `Node ${String(data.currentPacket.destination).padStart(2, "0")} awaits your packet. Neighbor relay requests arrive on even rounds. Inspect the engine preview.`);
  }
}

function showResolution(turn) {
  if (!turn) return;
  byId("resolution-title").textContent = turn.delivered ? "PACKET DELIVERED" : turn.action === "SLEEP" ? "SYSTEM RECHARGED" : turn.action === "IDLE" ? "PACKET EXPIRED" : "SIGNAL BLOCKED";
  byId("resolution-icon").textContent = turn.delivered ? "✦" : turn.action === "SLEEP" ? "Z" : "!";
  byId("resolution-message").textContent = turn.message + (turn.routeChanged ? " Safer route updated for the next round." : "");
  byId("resolution-effects").textContent = `BATTERY ${signed(turn.energyDelta)} • TRUST ${signed(turn.reputationDelta * 100, "%")} • SCORE ${signed(turn.scoreDelta)}`;
  byId("turn-resolution").classList.toggle("success", turn.delivered);
  visible("turn-resolution", true);
  window.SignalAudio.play(turn.delivered ? "deliver" : turn.action.toLowerCase());
}

function showResult(data) {
  const won = data.status === "won";
  byId("result-badge").textContent = won ? "MISSION COMPLETE / NETWORK ONLINE" : "MISSION FAILED / FINAL REPORT";
  byId("result-glyph").textContent = won ? "✦" : "⚡";
  byId("result-title").textContent = won ? "Network secured" : "Signal lost";
  const player = data.nodes[0];
  byId("result-reason").textContent = won
    ? "You kept trust and delivery alive through the crisis."
    : player.energy <= 0 ? "Your battery reached zero before the mission ended."
      : `The mission needed ${data.objective.deliver} deliveries and ${Math.round(data.objective.minimumReputation * 100)}% trust.`;
  const stats = [
    ["SCORE", data.score], ["PACKETS", `${data.deliveredPackets} / ${data.attemptedPackets}`],
    ["YOUR DELIVERIES", data.ownDeliveredPackets],
    ["FINAL TRUST", `${Math.round(player.reputation * 100)}%`],
    ["DELIVERY RATIO", `${Math.round(data.deliveryRatio)}%`],
    ["BATTERY LEFT", player.energy.toFixed(1)], ["ROUNDS SURVIVED", data.round],
    ["SELFISH MOVES", data.selfishDecisions]
  ];
  const box = byId("result-stats"); box.replaceChildren();
  for (const [label, value] of stats) {
    const cell = document.createElement("div");
    const heading = document.createElement("span"); heading.textContent = label;
    const amount = document.createElement("strong"); amount.textContent = value;
    cell.append(heading, amount); box.append(cell);
  }
  byId("result-overlay").classList.remove("hidden");
  window.SignalAudio.play(won ? "win" : "loss");
  byId("restart-button").focus();
}

async function commitAction() {
  if (!selected || !state || paused || busy || state.status !== "playing") return;
  busy = true;
  renderActions(state);
  visible("connection-banner", false);
  try {
    const next = await requestGame([...actions, selected]);
    actions.push(selected);
    selected = null;
    render(next);
    if (innerWidth <= 620) byId("world-heading").scrollIntoView({ behavior: "instant", block: "start" });
    showResolution(next.history.at(-1));
    await delay(reducedMotion.matches ? 100 : 1450);
    visible("turn-resolution", false);
    if (next.status !== "playing") showResult(next);
  } catch (error) {
    connectionError(error);
  } finally {
    busy = false;
    if (state?.status === "playing") renderActions(state);
  }
}

async function restart(newSeed = false) {
  if (busy) return;
  if (newSeed) seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  actions.length = 0;
  selected = null;
  state = null;
  byId("action-grid").replaceChildren();
  byId("confirm-action").disabled = true;
  paused = false;
  busy = true;
  for (const id of ["pause-overlay", "result-overlay", "turn-resolution", "connection-banner"]) visible(id, false);
  setStatus("Connecting to the relay grid…");
  history.replaceState(null, "", `/?seed=${seed}&profile=${profile}`);
  try { render(await requestGame(actions)); }
  catch (error) { connectionError(error); }
  finally { busy = false; if (state?.status === "playing") renderActions(state); }
}

byId("confirm-action").addEventListener("click", commitAction);
byId("title-start").addEventListener("click", async () => {
  if (busy) return;
  profile = document.querySelector('input[name="profile"]:checked').value;
  await restart();
  if (!byId("connection-banner").classList.contains("hidden")) return;
  visible("title-screen", false);
  visible("tutorial", true);
  byId("begin-button").focus();
});
byId("begin-button").addEventListener("click", () => {
  visible("tutorial", false);
  renderActions(state);
  byId("action-grid").querySelector("button:not(:disabled)")?.focus();
});
function setPaused(value) {
  if (busy || state?.status !== "playing" || !byId("tutorial").classList.contains("hidden") || !byId("title-screen").classList.contains("hidden")) return;
  paused = value;
  byId("pause-overlay").classList.toggle("hidden", !paused);
  renderActions(state);
  if (paused) byId("resume-button").focus();
  else byId("pause-button").focus({ preventScroll: true });
}
function returnToTitle() {
  visible("pause-overlay", false);
  visible("result-overlay", false);
  visible("tutorial", false);
  visible("title-screen", true);
  paused = false;
  byId("title-start").focus();
}
byId("pause-button").addEventListener("click", () => setPaused(!paused));
byId("resume-button").addEventListener("click", () => setPaused(false));
byId("restart-button").addEventListener("click", () => restart());
byId("restart-current").addEventListener("click", () => restart());
byId("fresh-button").addEventListener("click", () => restart(true));
byId("new-seed").addEventListener("click", () => restart(true));
byId("pause-title-button").addEventListener("click", returnToTitle);
byId("result-title-button").addEventListener("click", returnToTitle);
byId("retry-button").addEventListener("click", () => selected && state ? commitAction() : restart());
byId("audio-mute").addEventListener("click", () => window.SignalAudio.toggle());
byId("audio-volume").addEventListener("input", (event) => window.SignalAudio.volume(Number(event.target.value) / 100));
document.querySelector(`input[name="profile"][value="${profile}"]`).checked = true;
document.addEventListener("keydown", (event) => {
  const modal = document.querySelector('.overlay:not(.hidden)');
  if (event.key === "Tab" && modal) {
    const controls = [...modal.querySelectorAll('button:not(:disabled), input, a[href]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (!modal.contains(document.activeElement) || document.activeElement === first)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (!modal.contains(document.activeElement) || document.activeElement === last)) {
      event.preventDefault(); first?.focus();
    }
    return;
  }
  if (event.key.toLowerCase() === "p") { setPaused(!paused); return; }
  if (event.key === "Escape" && paused) { setPaused(false); return; }
  if (paused || busy || !byId("tutorial").classList.contains("hidden") || !byId("title-screen").classList.contains("hidden") || state?.status !== "playing") return;
  const choice = ["TRANSMIT", "RELAY", "SLEEP", "IDLE"][Number(event.key) - 1];
  if (choice) { selectAction(choice); return; }
  if (event.key === "Enter" && (document.activeElement?.classList.contains("action") || document.activeElement?.tagName !== "BUTTON")) {
    event.preventDefault(); commitAction();
  }
});
window.SignalAudio.init();
restart();
