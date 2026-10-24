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

  container.replaceChildren(createElement(container.tagName === "UL" ? "li" : "p", "is-muted", message));
}

function clampEnergy(energy) {
  var numericEnergy = Number(energy);

  if (!Number.isFinite(numericEnergy)) {
    return 0;
  }

  return Math.min(100, Math.max(0, numericEnergy));
}

function createProgressTrack(trackClass, fillClass, value, label) {
  var progress = createElement("div", trackClass);
  var fill = createElement("span", fillClass);
  var numericValue = clampEnergy(value);

  progress.style.setProperty("--energy", String(numericValue) + "%");
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuenow", String(numericValue));
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-label", label);
  progress.append(fill);
  return progress;
}

function formatDeliveryRatio(value) {
  return clampEnergy(value).toFixed(2) + "%";
}

function formatRouteCost(cost) {
  var numericCost = Number(cost);

  return Number.isFinite(numericCost) ? numericCost.toFixed(2) : "Unavailable";
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
    var metricValue = metrics[definition[1]];
    var value = createElement(
      "p",
      "metric-value",
      definition[1] === "deliveryRatio" ? formatDeliveryRatio(metricValue) : String(metricValue ?? "Unavailable")
    );
    card.append(label, value);

    if (definition[1] === "deliveryRatio") {
      card.append(
        createElement(
          "p",
          "packet-delivery-summary",
          String(metrics.deliveredPackets) + " of " + String(metrics.attemptedPackets) + " packets delivered"
        ),
        createProgressTrack("packet-delivery", "packet-delivery-fill", metricValue, "Packet delivery " + formatDeliveryRatio(metricValue))
      );
    }

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
    var energy = clampEnergy(node && node.energy);
    var isSuspicious = Boolean(node && node.suspicious);
    var isLowEnergy = energy <= 20;
    var isAlert = isSuspicious || isLowEnergy;
    var card = createElement("article", "node-card" + (isAlert ? " is-alert" : ""));
    var statusText = isSuspicious ? "Status: Suspicious" : (isLowEnergy ? "Status: Low energy" : "Status: Stable");
    var energyBar = createProgressTrack(
      "energy-bar" + (isLowEnergy ? " is-alert" : ""),
      "energy-fill",
      energy,
      "Node " + String(node && node.id) + " energy"
    );

    card.append(
      createElement("h3", "node-title", "Node " + String(node && node.id)),
      createElement("p", "node-strategy", "Strategy: " + String(node && node.strategy)),
      createElement("p", "node-reputation", "Reputation: " + String(node && node.reputation)),
      createElement("p", "status-badge" + (isAlert ? " is-alert" : ""), statusText),
      createElement("p", "energy-label", String(energy) + "% energy"),
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
    var card = createElement("li", "route-card");
    var path = Array.isArray(route && route.path) ? route.path.join(" → ") : "Unavailable";
    card.append(
      createElement("h3", "route-label", String(route && route.label)),
      createElement("p", "route-path", path),
      createElement("p", "route-cost", "Cost: " + formatRouteCost(route && route.cost))
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
      createElement("p", "strategy-average", "Average energy: " + averageEnergy.toFixed(2) + "%"),
      createProgressTrack("strategy-track", "strategy-fill", averageEnergy, strategy + " average energy")
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
