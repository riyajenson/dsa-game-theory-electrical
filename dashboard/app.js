"use strict";

var dashboardData = {
  updatedAt: "Test snapshot",
  metrics: { attemptedPackets: 21, deliveredPackets: 17, deliveryRatio: 80.95, averageResidualEnergy: 54.17, networkLifetimeRound: 2, selfishEventCount: 2 },
  nodes: [
    { id: 1, strategy: "Cooperative", energy: 95, reputation: 0.94, suspicious: false },
    { id: 2, strategy: "Selfish", energy: 14, reputation: 0.38, suspicious: true },
    { id: 3, strategy: "Cooperative", energy: 88, reputation: 0.86, suspicious: false },
    { id: 4, strategy: "Cooperative", energy: 72, reputation: 0.76, suspicious: false },
    { id: 5, strategy: "Cooperative", energy: 64, reputation: 0.81, suspicious: false }
  ],
  routes: [
    { label: "Shortest route", path: [1, 2, 5], cost: 2 },
    { label: "Energy-aware route", path: [1, 3, 4, 5], cost: 4.4 }
  ]
};

var requiredMetricFields = ["attemptedPackets", "deliveredPackets", "deliveryRatio", "averageResidualEnergy", "networkLifetimeRound", "selfishEventCount"];

function getElement(id) {
  return document.getElementById(id);
}

function createElement(tagName, className, text) {
  var element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createSvgElement(tagName) {
  return document.createElementNS
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);
}

function showEmpty(container, message) {
  if (!container) return;
  container.replaceChildren(createElement(container.tagName === "UL" ? "li" : "p", "is-muted", message));
}

function clampPercent(value) {
  var numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
}

function createProgressTrack(trackClass, fillClass, value, label) {
  var progress = createElement("div", trackClass);
  var fill = createElement("span", fillClass);
  var numeric = clampPercent(value);
  progress.style.setProperty("--energy", numeric + "%");
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuenow", String(numeric));
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-label", label);
  progress.append(fill);
  return progress;
}

function formatPercent(value) {
  return clampPercent(value).toFixed(2) + "%";
}

function formatNumber(value) {
  var numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "Unavailable";
}

function hasCompleteMetrics(metrics) {
  return Boolean(metrics && typeof metrics === "object") && requiredMetricFields.every(function (field) {
    return Object.prototype.hasOwnProperty.call(metrics, field) && metrics[field] !== null && metrics[field] !== undefined;
  });
}

function renderMetrics(metrics) {
  var container = getElement("metric-grid");
  if (!container) return;
  if (!hasCompleteMetrics(metrics)) {
    showEmpty(container, "Network metrics are unavailable.");
    return;
  }
  var definitions = [
    ["Delivery ratio", formatPercent(metrics.deliveryRatio), "delivery"],
    ["Residual energy", formatPercent(metrics.averageResidualEnergy), "energy"],
    ["Packets delivered", String(metrics.deliveredPackets), "packets"],
    ["Network lifetime", metrics.networkLifetimeRound < 0 ? "Active" : "Round " + metrics.networkLifetimeRound, "lifetime"],
    ["Selfish events", String(metrics.selfishEventCount), "alerts"]
  ];
  var cards = definitions.map(function (definition) {
    var card = createElement("article", "metric-card metric-" + definition[2]);
    card.append(createElement("p", "metric-label", definition[0]), createElement("p", "metric-value", definition[1]));
    if (definition[2] === "delivery") {
      card.append(
        createElement("p", "packet-delivery-summary", metrics.deliveredPackets + " of " + metrics.attemptedPackets + " packets delivered"),
        createProgressTrack("packet-delivery", "packet-delivery-fill", metrics.deliveryRatio, "Packet delivery " + formatPercent(metrics.deliveryRatio))
      );
    }
    return card;
  });
  container.replaceChildren.apply(container, cards);
}

function renderNodes(nodes) {
  var container = getElement("node-grid");
  if (!container) return;
  if (!Array.isArray(nodes) || !nodes.length) {
    showEmpty(container, "Node state data is unavailable.");
    return;
  }
  var cards = nodes.map(function (node) {
    var energy = clampPercent(node.energy);
    var alert = Boolean(node.suspicious) || energy <= 20;
    var card = createElement("article", "node-card" + (alert ? " is-alert" : ""));
    var top = createElement("div", "node-card-top");
    top.append(
      createElement("span", "node-index", String(node.id).padStart(2, "0")),
      createElement("span", "status-badge" + (alert ? " is-alert" : ""), node.suspicious ? "Suspicious" : (energy <= 20 ? "Low energy" : "Stable"))
    );
    card.append(
      top,
      createElement("h3", "node-title", "Sensor node " + node.id),
      createElement("p", "node-strategy", node.strategy + " strategy"),
      createElement("p", "node-reputation", "Reputation " + formatNumber(node.reputation)),
      createElement("p", "energy-label", formatPercent(energy) + " energy"),
      createProgressTrack("energy-bar" + (energy <= 20 ? " is-alert" : ""), "energy-fill", energy, "Node " + node.id + " energy")
    );
    return card;
  });
  container.replaceChildren.apply(container, cards);
}

function renderRoutes(routes) {
  var container = getElement("route-list");
  if (!container) return;
  if (!Array.isArray(routes) || !routes.length) {
    showEmpty(container, "Route data is unavailable.");
    return;
  }
  var cards = routes.map(function (route, index) {
    var card = createElement("li", "route-card route-" + index);
    card.append(
      createElement("span", "route-badge", index === 0 ? "Baseline" : "Energy safe"),
      createElement("h3", "route-label", String(route.label)),
      createElement("p", "route-path", Array.isArray(route.path) ? route.path.join(" → ") : "Unavailable"),
      createElement("p", "route-cost", "Cost: " + formatNumber(route.cost))
    );
    return card;
  });
  container.replaceChildren.apply(container, cards);
}

function renderStrategyBars(nodes) {
  var container = getElement("strategy-bars");
  if (!container) return;
  if (!Array.isArray(nodes) || !nodes.length) {
    showEmpty(container, "Strategy comparison data is unavailable.");
    return;
  }
  var groups = {};
  nodes.forEach(function (node) {
    var strategy = node.strategy || "Unknown";
    if (!groups[strategy]) groups[strategy] = { count: 0, energy: 0 };
    groups[strategy].count += 1;
    groups[strategy].energy += clampPercent(node.energy);
  });
  var bars = Object.keys(groups).map(function (strategy) {
    var average = groups[strategy].energy / groups[strategy].count;
    var card = createElement("article", "chart-bar");
    card.append(
      createElement("h3", "strategy-name", strategy),
      createElement("p", "strategy-count", groups[strategy].count + (groups[strategy].count === 1 ? " node" : " nodes")),
      createElement("p", "strategy-average", "Average energy: " + formatPercent(average)),
      createProgressTrack("strategy-track", "strategy-fill", average, strategy + " average energy")
    );
    return card;
  });
  container.replaceChildren.apply(container, bars);
}

function renderTopology(nodes, links) {
  var container = getElement("network-map");
  if (!container) return;
  if (!Array.isArray(nodes) || !nodes.length) {
    showEmpty(container, "Topology data is unavailable.");
    return;
  }
  var positions = { 1: [90, 190], 2: [250, 80], 3: [245, 300], 4: [430, 285], 5: [550, 150] };
  var fragments = [];
  (links || []).forEach(function (link) {
    var first = positions[link.source];
    var second = positions[link.target];
    if (!first || !second) return;
    var line = createSvgElement("line");
    line.setAttribute("class", "map-link");
    line.setAttribute("x1", first[0]);
    line.setAttribute("y1", first[1]);
    line.setAttribute("x2", second[0]);
    line.setAttribute("y2", second[1]);
    var weight = createSvgElement("text");
    weight.setAttribute("class", "map-weight");
    weight.setAttribute("x", (first[0] + second[0]) / 2);
    weight.setAttribute("y", (first[1] + second[1]) / 2 - 8);
    weight.textContent = formatNumber(link.weight);
    fragments.push(line, weight);
  });
  nodes.forEach(function (node) {
    var position = positions[node.id] || [320, 190];
    var group = createSvgElement("g");
    group.setAttribute("class", "map-node" + (node.suspicious || node.energy <= 20 ? " is-alert" : ""));
    group.setAttribute("transform", "translate(" + position[0] + " " + position[1] + ")");
    group.setAttribute("aria-label", "Node " + node.id + ", " + formatPercent(node.energy) + " energy");
    var halo = createSvgElement("circle");
    halo.setAttribute("class", "node-halo");
    halo.setAttribute("r", "35");
    var circle = createSvgElement("circle");
    circle.setAttribute("class", "node-core");
    circle.setAttribute("r", "25");
    var label = createSvgElement("text");
    label.setAttribute("class", "node-map-label");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("y", "5");
    label.textContent = "N" + node.id;
    var detail = createSvgElement("text");
    detail.setAttribute("class", "node-map-energy");
    detail.setAttribute("text-anchor", "middle");
    detail.setAttribute("y", "52");
    detail.textContent = "Node " + node.id + " · " + Math.round(node.energy) + "%";
    group.append(halo, circle, label, detail);
    fragments.push(group);
  });
  container.replaceChildren.apply(container, fragments);
}

function renderHistory(history) {
  var container = getElement("history-list");
  if (!container) return;
  if (!Array.isArray(history) || !history.length) {
    showEmpty(container, "Round history is unavailable.");
    return;
  }
  var cards = history.map(function (round) {
    var card = createElement("article", "history-card");
    card.append(
      createElement("span", "history-round", "Round " + round.round),
      createElement("strong", "history-packets", round.deliveredPackets + " of " + round.attemptedPackets + " delivered"),
      createElement("span", "history-energy", formatPercent(round.averageEnergy) + " avg. energy")
    );
    return card;
  });
  container.replaceChildren.apply(container, cards);
}

function renderPlannerComparison(comparison) {
  var container = getElement("planner-comparison");
  if (!container) return;
  if (!comparison || !comparison.planned || !comparison.greedy) {
    showEmpty(container, "Planner comparison is unavailable.");
    return;
  }
  function planCard(label, plan, recommended) {
    var card = createElement("article", "plan-card" + (recommended ? " is-recommended" : ""));
    card.append(
      createElement("span", "plan-tag", recommended ? "Recommended" : "Benchmark"),
      createElement("h3", "plan-name", label),
      createElement("p", "plan-utility", formatNumber(plan.totalUtility) + " utility"),
      createElement("p", "plan-energy", formatPercent(plan.remainingEnergy) + " remaining"),
      createElement("p", "plan-actions", (plan.actions || []).join(" → "))
    );
    return card;
  }
  var recommendation = createElement("p", "recommendation", comparison.recommendation + " recommended for this horizon");
  var grid = createElement("div", "plan-grid");
  grid.append(
    planCard("DP horizon plan", comparison.planned, comparison.recommendation === "DP plan"),
    planCard("Greedy plan", comparison.greedy, comparison.recommendation === "Greedy plan")
  );
  container.replaceChildren(recommendation, grid);
}

function renderDashboard(data) {
  var snapshot = data && typeof data === "object" ? data : {};
  renderMetrics(snapshot.metrics);
  renderNodes(snapshot.nodes);
  renderRoutes(snapshot.routes);
  renderStrategyBars(snapshot.nodes);
  renderTopology(snapshot.nodes, snapshot.links);
  renderHistory(snapshot.history);
  renderPlannerComparison(snapshot.plannerComparison);
  var updated = getElement("last-updated");
  var emptyState = getElement("empty-state");
  if (updated) updated.textContent = snapshot.updatedAt || "Simulation complete";
  if (emptyState) emptyState.hidden = true;
}

function setRequestState(isBusy, message, isError) {
  var button = getElement("run-simulation");
  var status = getElement("simulation-status");
  if (button) {
    button.disabled = isBusy;
    button.textContent = isBusy ? "Running simulation…" : "Run simulation →";
  }
  if (status) {
    status.textContent = message;
    status.className = "status-line" + (isError ? " is-error" : "");
  }
}

async function requestSimulation(input, request) {
  var send = request || fetch;
  setRequestState(true, "C++ engine is calculating routes and decisions…", false);
  try {
    var response = await send("/api/simulations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    var payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error && payload.error.message ? payload.error.message : "Simulation failed.");
    }
    renderDashboard(payload);
    setRequestState(false, "Simulation complete: " + input.rounds + " rounds, " + input.strategy + " strategy.", false);
    return payload;
  } catch (error) {
    setRequestState(false, error.message || "The simulation could not be completed.", true);
    throw error;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var form = getElement("simulation-form");
    var rounds = getElement("rounds");
    var strategy = getElement("strategy");
    if (!form || !rounds || !strategy) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      requestSimulation({
        rounds: Number(rounds.value),
        strategy: strategy.value
      }).catch(function () {});
    });

    requestSimulation({ rounds: 5, strategy: "mixed" }).catch(function () {});
  });
}

function renderDashboard(data) {
  var snapshot = data && typeof data === "object" ? data : {};
  renderMetrics(snapshot.metrics);
  renderNodes(snapshot.nodes);
  renderRoutes(snapshot.routes);
  renderStrategyBars(snapshot.nodes);
  renderTopology(snapshot.nodes, snapshot.links);
  renderHistory(snapshot.history);
  renderPlannerComparison(snapshot.plannerComparison);
  var updatedAt = getElement("last-updated");
  if (updatedAt) updatedAt.textContent = snapshot.updatedAt || "Simulation complete";
  var emptyState = getElement("empty-state");
  if (emptyState) emptyState.hidden = true;
}

function setBusy(busy, message, isError) {
  var button = getElement("run-simulation");
  var status = getElement("simulation-status");
  if (button) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
  }
  if (status) {
    status.textContent = message;
    status.className = "status-line" + (isError ? " is-error" : "");
  }
}

async function runSimulation(input, request) {
  var doRequest = request || function (payload) {
    return fetch("/api/simulations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  };
  setBusy(true, "Running C++ simulation…", false);
  try {
    var response = await doRequest(input);
    var body = await response.json();
    if (!response.ok) throw new Error(body && body.error ? body.error.message : "Simulation failed.");
    renderDashboard(body);
    setBusy(false, "Simulation complete. Dashboard updated.", false);
    return body;
  } catch (error) {
    setBusy(false, error.message || "Simulation failed.", true);
    throw error;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var form = getElement("simulation-form");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      runSimulation({
        rounds: Number(getElement("rounds").value),
        strategy: getElement("strategy").value
      }).catch(function () {});
    });
    runSimulation({ rounds: 5, strategy: "mixed" }).catch(function () {});
  });
}
