"use strict";

const svgNS = "http://www.w3.org/2000/svg";
const positions = { 1: [102, 208], 2: [257, 92], 3: [258, 311], 4: [435, 294], 5: [548, 179] };
const names = { 1: "SPARK", 2: "DRIFT", 3: "NOVA", 4: "ARC", 5: "TERMINAL" };
const actionInfo = {
  TRANSMIT: { icon: "↗", title: "TRANSMIT", sub: "Send your packet" },
  RELAY: { icon: "⇄", title: "RELAY", sub: "Help a neighbor" },
  SLEEP: { icon: "▣", title: "SLEEP", sub: "Recharge · lose trust" },
  IDLE: { icon: "Ⅱ", title: "IDLE", sub: "Let packet expire" }
};
const actions = [];
let seed = Number(new URLSearchParams(location.search).get("seed"));
if (!Number.isInteger(seed) || seed < 0 || seed > 999999) seed = 17;
let profile = new URLSearchParams(location.search).get("profile") || "mixed";
if (!["cooperative", "mixed", "selfish"].includes(profile)) profile = "mixed";
let state = null;
let selected = null;
let paused = false;
let busy = false;

const byId = (id) => document.getElementById(id);
const svg = (tag, attributes = {}) => {
  const element = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};
const routeText = (route) => route && route.length ? route.map((id) => String(id).padStart(2, "0")).join(" → ") : "NO ROUTE";
const points = (route) => route.map((id) => positions[id].join(",")).join(" ");
const signed = (value, suffix = "") => `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;

async function requestGame(history) {
  const response = await fetch("/api/game", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ schemaVersion: 2, seed, profile, actions: history })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "The engine did not respond.");
  return data;
}

function setStatus(message) {
  byId("packet-goal").textContent = message;
}

function drawMap(data) {
  const map = byId("game-map");
  map.replaceChildren();
  map.append(svg("rect", { x: 0, y: 0, width: 640, height: 416, fill: "#102035" }));
  for (let y = 0; y < 416; y += 32) {
    for (let x = 0; x < 640; x += 32) {
      map.append(svg("rect", { x, y, width: 31, height: 31,
        class: (x / 32 + y / 32) % 3 === 0 ? "map-tile alt" : "map-tile" }));
    }
  }
  for (let i = 0; i < 23; i++) {
    const x = (i * 97 + 26) % 620;
    const y = (i * 53 + 37) % 390;
    map.append(svg("rect", { x, y, width: 8, height: 8, class: "map-decor" }));
  }
  for (const link of data.links) {
    const [x1, y1] = positions[link.source], [x2, y2] = positions[link.target];
    map.append(svg("line", { x1, y1, x2, y2, class: "map-trace" }));
    if (link.interference) map.append(svg("line", { x1, y1, x2, y2, class: "map-danger" }));
  }
  if (data.routes.shortest.length) map.append(svg("polyline", {
    points: points(data.routes.shortest), class: "map-short" }));
  if (data.routes.energyAware.length) map.append(svg("polyline", {
    points: points(data.routes.energyAware), class: "map-aware" }));
  for (const node of data.nodes) {
    const [x, y] = positions[node.id];
    const group = svg("g", { class: `tower ${node.id === 1 ? "tower-player" : node.energy < 12 ? "tower-low" : node.strategy === "selfish" ? "tower-selfish" : ""}` });
    group.append(svg("rect", { x: x - 19, y: y + 14, width: 38, height: 13, class: "tower-shadow" }));
    group.append(svg("rect", { x: x - 18, y: y - 20, width: 36, height: 40, class: "tower-base" }));
    group.append(svg("rect", { x: x - 4, y: y - 28, width: 8, height: 10, fill: "#9eb7b6" }));
    group.append(svg("rect", { x: x - 10, y: y - 7, width: 20, height: 15, class: "tower-core" }));
    group.append(svg("rect", { x: x - 5, y: y - 2, width: 10, height: 5, fill: "#18374b" }));
    const label = svg("text", { x, y: y + 46, "text-anchor": "middle", class: "tower-label" });
    label.textContent = `${String(node.id).padStart(2, "0")} ${names[node.id]}`;
    group.append(label);
    const title = svg("title");
    title.textContent = `${names[node.id]} · ${node.energy.toFixed(1)} energy · ${Math.round(node.reputation * 100)}% trust · ${node.strategy}`;
    group.append(title);
    map.append(group);
  }
  const last = data.history.at(-1);
  if (last?.route?.length > 1) {
    const animationPath = last.route.map((id, index) => {
      const [x, y] = positions[id];
      return `${index ? "L" : "M"}${x},${y}`;
    }).join(" ");
    const packet = svg("rect", { x: -5, y: -5, width: 10, height: 10,
      class: "packet", opacity: last.delivered ? 1 : .55 });
    packet.append(svg("animateMotion", { path: animationPath, dur: "1.15s", fill: "freeze", repeatCount: "1" }));
    map.append(packet);
  }
}

function renderActions(data) {
  const grid = byId("action-grid");
  grid.replaceChildren();
  for (const preview of data.previews) {
    const info = actionInfo[preview.action];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action${selected === preview.action ? " selected" : ""}`;
    button.dataset.action = preview.action;
    button.disabled = !preview.legal || paused || busy;
    button.title = preview.legal ? `${info.title}: ${preview.delivered ? "packet delivered" : "packet expires"}` : preview.reason;
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
}

function updatePreview() {
  const preview = state?.previews.find((item) => item.action === selected);
  const text = byId("preview-text");
  if (!preview) text.textContent = "Select an action to inspect its outcome.";
  else text.textContent = `${preview.delivered ? "PACKET DELIVERED" : "PACKET LOST"} · Battery ${signed(preview.energyDelta)} · Trust ${signed(preview.reputationDelta * 100, "%")}${preview.route.length ? ` · Route ${routeText(preview.route)}` : ""}`;
  byId("confirm-action").disabled = !preview || paused || busy;
}

function render(data) {
  state = data;
  const player = data.nodes[0];
  byId("seed-value").textContent = String(data.seed).padStart(4, "0");
  byId("round-value").textContent = Math.min(data.round + 1, data.maxRounds);
  byId("goal-count").textContent = `${data.deliveredPackets} / ${data.objective.deliver}`;
  byId("energy-value").textContent = `${player.energy.toFixed(1)} / 100`;
  byId("reputation-value").textContent = `${Math.round(player.reputation * 100)}%`;
  byId("energy-bar").style.width = `${player.energy}%`;
  byId("reputation-bar").style.width = `${player.reputation * 100}%`;
  byId("delivered-value").textContent = data.deliveredPackets;
  byId("ratio-value").textContent = `${Math.round(data.deliveryRatio)}%`;
  byId("score-value").textContent = String(data.score).padStart(3, "0");
  byId("short-route").textContent = routeText(data.routes.shortest);
  byId("aware-route").textContent = routeText(data.routes.energyAware);
  drawMap(data);
  renderActions(data);
  const events = byId("event-list");
  events.replaceChildren();
  if (!data.history.length) {
    const li = document.createElement("li"); li.textContent = "Awaiting your first decision."; events.append(li);
  }
  for (const turn of [...data.history].reverse()) {
    const li = document.createElement("li");
    li.textContent = `R${turn.round} · ${turn.action} — ${turn.message} (${signed(turn.energyDelta)} battery, ${signed(turn.reputationDelta * 100, "%")} trust)`;
    events.append(li);
  }
  if (data.status === "playing") {
    setStatus(data.currentPacket.relayRequest
      ? `Node ${String(data.currentPacket.destination).padStart(2, "0")} awaits your packet. A neighbor requests relay from ${String(data.currentPacket.relaySource).padStart(2, "0")} to ${String(data.currentPacket.relayDestination).padStart(2, "0")}. Inspect the engine preview.`
      : `Node ${String(data.currentPacket.destination).padStart(2, "0")} awaits your packet. Neighbor relay requests arrive on even rounds. Inspect the engine preview.`);
  } else showResult(data);
}

function showResult(data) {
  const won = data.status === "won";
  byId("result-title").textContent = won ? "Network secured" : "Signal lost";
  const player = data.nodes[0];
  byId("result-reason").textContent = won
    ? "You kept trust and delivery alive through the crisis."
    : player.energy <= 0 ? "Your battery reached zero before the mission ended."
      : `The mission needed ${data.objective.deliver} deliveries and ${Math.round(data.objective.minimumReputation * 100)}% trust.`;
  const stats = [
    ["SCORE", data.score], ["PACKETS", `${data.deliveredPackets} / ${data.attemptedPackets}`],
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
  byId("restart-button").focus();
}

async function commitAction() {
  if (!selected || !state || paused || busy || state.status !== "playing") return;
  busy = true;
  byId("confirm-action").disabled = true;
  try {
    const next = await requestGame([...actions, selected]);
    actions.push(selected);
    selected = null;
    render(next);
  } catch (error) {
    setStatus(error.message);
  } finally {
    busy = false;
    if (state?.status === "playing") renderActions(state);
  }
}

async function restart(newSeed = false) {
  if (newSeed) seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  actions.length = 0;
  selected = null;
  paused = false;
  byId("pause-overlay").classList.add("hidden");
  byId("result-overlay").classList.add("hidden");
  history.replaceState(null, "", `/?seed=${seed}&profile=${profile}`);
  try { render(await requestGame(actions)); }
  catch (error) { setStatus(`Engine unavailable: ${error.message}`); }
}

byId("confirm-action").addEventListener("click", commitAction);
byId("begin-button").addEventListener("click", () => { byId("tutorial").classList.add("hidden"); byId("confirm-action").focus(); });
function setPaused(value) {
  if (state?.status !== "playing" || !byId("tutorial").classList.contains("hidden")) return;
  paused = value;
  byId("pause-overlay").classList.toggle("hidden", !paused);
  renderActions(state);
  if (paused) byId("resume-button").focus();
}
byId("pause-button").addEventListener("click", () => setPaused(!paused));
byId("resume-button").addEventListener("click", () => setPaused(false));
byId("restart-button").addEventListener("click", () => restart());
byId("restart-current").addEventListener("click", () => restart());
byId("fresh-button").addEventListener("click", () => restart(true));
byId("new-seed").addEventListener("click", () => restart(true));
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p") { setPaused(!paused); return; }
  if (paused || !byId("tutorial").classList.contains("hidden") || state?.status !== "playing") return;
  const choice = ["TRANSMIT", "RELAY", "SLEEP", "IDLE"][Number(event.key) - 1];
  if (choice) { selectAction(choice); return; }
  if (event.key === "Enter" && document.activeElement?.tagName !== "BUTTON") commitAction();
});
restart();
