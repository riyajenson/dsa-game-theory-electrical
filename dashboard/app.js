"use strict";

function freezeSnapshot(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.keys(value).forEach(function (key) {
      freezeSnapshot(value[key]);
    });
    Object.freeze(value);
  }

  return value;
}

var dashboardData = freezeSnapshot({
  updatedAt: "Phase 4 deterministic snapshot",
  metrics: {
    attemptedPackets: 21,
    deliveredPackets: 17,
    deliveryRatio: 80.95,
    averageResidualEnergy: 54.17,
    networkLifetimeRound: 2,
    selfishEventCount: 2
  },
  nodes: [
    { id: 1, strategy: "Cooperative", energy: 95, reputation: 0.94, suspicious: false },
    { id: 2, strategy: "Selfish", energy: 14, reputation: 0.38, suspicious: true },
    { id: 3, strategy: "Cooperative", energy: 88, reputation: 0.86, suspicious: false },
    { id: 4, strategy: "Cooperative", energy: 72, reputation: 0.76, suspicious: false },
    { id: 5, strategy: "Cooperative", energy: 64, reputation: 0.81, suspicious: false }
  ],
  routes: [
    { label: "Shortest route", path: [1, 2, 5], cost: 2.0 },
    { label: "Energy-aware route", path: [1, 3, 4, 5], cost: 4.4 }
  ]
});

var requiredMetricFields = [
  "attemptedPackets",
  "deliveredPackets",
  "deliveryRatio",
  "averageResidualEnergy",
  "networkLifetimeRound",
  "selfishEventCount"
];

function getElement(id) {
  return document.getElementById(id);
}

function createElement(tagName, className, text) {
  var element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function showEmpty(container, message) {
  if (!container) {
    return;
  }

  container.replaceChildren(createElement("p", "is-muted", message));
}

function clampEnergy(energy) {
  var numericEnergy = Number(energy);

  if (!Number.isFinite(numericEnergy)) {
    return 0;
  }

  return Math.min(100, Math.max(0, numericEnergy));
}

function hasCompleteMetrics(metrics) {
  return Boolean(metrics && typeof metrics === "object") && requiredMetricFields.every(function (field) {
    return Object.prototype.hasOwnProperty.call(metrics, field) && metrics[field] !== null && metrics[field] !== undefined;
  });
}

function renderMetrics(metrics) {
  var container = getElement("metric-grid");
  var definitions = [
    ["Attempted packets", "attemptedPackets"],
    ["Delivered packets", "deliveredPackets"],
    ["Delivery ratio", "deliveryRatio"],
    ["Average residual energy", "averageResidualEnergy"],
    ["Network lifetime round", "networkLifetimeRound"],
    ["Selfish event count", "selfishEventCount"]
  ];

  if (!container) {
    return;
  }

  if (!hasCompleteMetrics(metrics)) {
    showEmpty(container, "Network metrics are unavailable.");
    return;
  }

  var cards = definitions.map(function (definition) {
    var card = createElement("article", "metric-card");
    var label = createElement("p", "metric-label", definition[0]);
    var value = createElement("p", "metric-value", String(metrics[definition[1]] ?? "Unavailable"));
    card.append(label, value);
    return card;
  });

  container.replaceChildren.apply(container, cards);
}

function renderNodes(nodes) {
  var container = getElement("node-grid");

  if (!container) {
    return;
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    showEmpty(container, "Node state data is unavailable.");
    return;
  }

  var cards = nodes.map(function (node) {
    var card = createElement("article", "node-card");
    var energy = clampEnergy(node && node.energy);
    var energyBar = createElement("div", "energy-bar");
    energyBar.style.setProperty("--energy", String(energy) + "%");
    energyBar.setAttribute("role", "progressbar");
    energyBar.setAttribute("aria-valuenow", String(energy));
    energyBar.setAttribute("aria-valuemin", "0");
    energyBar.setAttribute("aria-valuemax", "100");
    energyBar.setAttribute("aria-label", "Node " + String(node && node.id) + " energy");
    energyBar.textContent = String(energy) + "% energy";

    card.append(
      createElement("h3", "node-title", "Node " + String(node && node.id)),
      createElement("p", "node-strategy", "Strategy: " + String(node && node.strategy)),
      createElement("p", "node-reputation", "Reputation: " + String(node && node.reputation)),
      createElement("p", "node-suspicious", "Suspicious: " + (node && node.suspicious ? "Yes" : "No")),
      energyBar
    );
    return card;
  });

  container.replaceChildren.apply(container, cards);
}

function renderRoutes(routes) {
  var container = getElement("route-list");

  if (!container) {
    return;
  }

  if (!Array.isArray(routes) || routes.length === 0) {
    showEmpty(container, "Route data is unavailable.");
    return;
  }

  var cards = routes.map(function (route) {
    var card = createElement("article", "route-card");
    var path = Array.isArray(route && route.path) ? route.path.join(" → ") : "Unavailable";
    card.append(
      createElement("h3", "route-label", String(route && route.label)),
      createElement("p", "route-path", path),
      createElement("p", "route-cost", "Cost: " + String(route && route.cost))
    );
    return card;
  });

  container.replaceChildren.apply(container, cards);
}

function renderStrategyBars(nodes) {
  var container = getElement("strategy-bars");

  if (!container) {
    return;
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    showEmpty(container, "Strategy comparison data is unavailable.");
    return;
  }

  var strategies = {};
  nodes.forEach(function (node) {
    var strategy = node && node.strategy ? String(node.strategy) : "Unknown";
    if (!strategies[strategy]) {
      strategies[strategy] = { count: 0, energyTotal: 0 };
    }
    strategies[strategy].count += 1;
    strategies[strategy].energyTotal += clampEnergy(node && node.energy);
  });

  var bars = Object.keys(strategies).map(function (strategy) {
    var summary = strategies[strategy];
    var averageEnergy = summary.energyTotal / summary.count;
    var bar = createElement("article", "chart-bar");
    bar.append(
      createElement("h3", "strategy-name", strategy),
      createElement("p", "strategy-count", String(summary.count) + " node" + (summary.count === 1 ? "" : "s")),
      createElement("p", "strategy-average", "Average energy: " + averageEnergy.toFixed(2) + "%")
    );
    return bar;
  });

  container.replaceChildren.apply(container, bars);
}

function renderDashboard(data) {
  var snapshot = data && typeof data === "object" ? data : {};
  var updatedAt = getElement("last-updated");
  var emptyState = getElement("empty-state");
  var hasUsableData = Boolean(
    hasCompleteMetrics(snapshot.metrics) ||
    (Array.isArray(snapshot.nodes) && snapshot.nodes.length) ||
    (Array.isArray(snapshot.routes) && snapshot.routes.length)
  );

  renderMetrics(snapshot.metrics);
  renderNodes(snapshot.nodes);
  renderRoutes(snapshot.routes);
  renderStrategyBars(snapshot.nodes);

  if (updatedAt) {
    updatedAt.textContent = snapshot.updatedAt ? String(snapshot.updatedAt) : "No update available";
  }

  if (emptyState) {
    emptyState.hidden = hasUsableData;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    renderDashboard(dashboardData);
  });
}
