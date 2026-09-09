"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

function FakeElement(tagName) {
  this.tagName = tagName.toUpperCase();
  this.className = "";
  this.children = [];
  this.attributes = {};
  this.hidden = false;
  this._text = "";
  this.style = {
    values: {},
    setProperty: function (name, value) {
      this.values[name] = value;
    }
  };
}

Object.defineProperty(FakeElement.prototype, "textContent", {
  get: function () {
    return this._text + this.children.map(function (child) {
      return child.textContent;
    }).join("");
  },
  set: function (value) {
    this._text = String(value);
    this.children = [];
  }
});

FakeElement.prototype.append = function () {
  this.children.push.apply(this.children, arguments);
};

FakeElement.prototype.replaceChildren = function () {
  this.children = Array.prototype.slice.call(arguments);
  this._text = "";
};

FakeElement.prototype.setAttribute = function (name, value) {
  this.attributes[name] = String(value);
};

function createDocument() {
  var elements = {};
  [
    "metric-grid",
    "node-grid",
    "route-list",
    "strategy-bars",
    "last-updated",
    "empty-state",
    "network-map",
    "history-list",
    "planner-comparison",
    "simulation-status",
    "run-simulation"
  ].forEach(function (id) {
    elements[id] = new FakeElement(
      id === "route-list" ? "ul" : (id === "network-map" ? "svg" : "div")
    );
  });

  return {
    createElement: function (tagName) {
      return new FakeElement(tagName);
    },
    createElementNS: function (namespace, tagName) {
      return new FakeElement(tagName);
    },
    getElementById: function (id) {
      return elements[id] || null;
    },
    addEventListener: function () {},
    elements: elements
  };
}

function findAll(element, predicate, found) {
  var matches = found || [];
  if (predicate(element)) {
    matches.push(element);
  }
  element.children.forEach(function (child) {
    findAll(child, predicate, matches);
  });
  return matches;
}

function hasClass(element, className) {
  return element.className.split(/\s+/).indexOf(className) !== -1;
}

function loadRenderer() {
  var document = createDocument();
  var context = vm.createContext({ document: document });
  var appPath = path.join(__dirname, "app.js");
  vm.runInContext(fs.readFileSync(appPath, "utf8"), context, { filename: appPath });
  return { document: document, renderer: context };
}

function assertRendererBehavior() {
  var loaded = loadRenderer();
  var renderer = loaded.renderer;
  var elements = loaded.document.elements;

  renderer.renderNodes([{ id: 9, strategy: "Selfish", energy: 14, reputation: 0.38, suspicious: true }]);
  var nodeCard = elements["node-grid"].children[0];
  assert.ok(hasClass(nodeCard, "is-alert"), "low-energy suspicious nodes need an is-alert card class");
  var badges = findAll(nodeCard, function (element) {
    return hasClass(element, "status-badge");
  });
  assert.strictEqual(badges.length, 1, "nodes need one visible status badge");
  assert.match(badges[0].textContent, /Suspicious/, "suspicious status must remain text");
  var energyBars = findAll(nodeCard, function (element) {
    return hasClass(element, "energy-bar");
  });
  assert.strictEqual(energyBars[0].attributes["aria-valuenow"], "14", "energy ARIA value must be preserved");
  assert.strictEqual(findAll(nodeCard, function (element) {
    return hasClass(element, "energy-label");
  }).length, 1, "energy labels must render outside the fill");

  renderer.renderMetrics(renderer.dashboardData.metrics);
  assert.match(elements["metric-grid"].textContent, /80\.95%/, "delivery percentage needs percent formatting");
  var deliveryBars = findAll(elements["metric-grid"], function (element) {
    return hasClass(element, "packet-delivery");
  });
  assert.strictEqual(deliveryBars.length, 1, "delivery metric needs an accessible bar");
  assert.strictEqual(deliveryBars[0].attributes["aria-valuenow"], "80.95", "delivery bar needs deterministic ARIA value");
  assert.match(elements["metric-grid"].textContent, /17 of 21 packets delivered/, "delivery bar needs clear text");

  renderer.renderRoutes(renderer.dashboardData.routes);
  assert.match(elements["route-list"].textContent, /Cost: 2\.00/, "route costs need two decimals");
  assert.strictEqual(elements["route-list"].children[0].tagName, "LI", "route renderer must retain semantic list items");

  renderer.renderStrategyBars(renderer.dashboardData.nodes);
  var strategyTrack = findAll(elements["strategy-bars"], function (element) {
    return hasClass(element, "strategy-track");
  })[0];
  assert.ok(strategyTrack, "strategy comparison needs a separate track");
  assert.strictEqual(strategyTrack.style.values["--energy"], "79.75%", "strategy fill needs proportional average energy");
  assert.strictEqual(strategyTrack.attributes["aria-valuenow"], "79.75", "strategy bar needs ARIA value");

  renderer.renderNodes([]);
  renderer.renderRoutes([]);
  renderer.renderStrategyBars([]);
  assert.match(elements["node-grid"].textContent, /unavailable/, "node empty state must remain safe");
  assert.match(elements["route-list"].textContent, /unavailable/, "route empty state must remain safe");
  assert.strictEqual(elements["route-list"].children[0].tagName, "LI", "route empty state must retain semantic list items");
  assert.match(elements["strategy-bars"].textContent, /unavailable/, "strategy empty state must remain safe");

  renderer.renderTopology(
    renderer.dashboardData.nodes,
    [
      { source: 1, target: 2, weight: 1 },
      { source: 2, target: 5, weight: 1 }
    ]
  );
  assert.match(elements["network-map"].textContent, /Node 1/, "topology needs visible node labels");
  assert.match(elements["network-map"].textContent, /1\.00/, "topology needs visible link weights");

  renderer.renderHistory([
    { round: 1, attemptedPackets: 5, deliveredPackets: 4, averageEnergy: 70.25 }
  ]);
  assert.match(elements["history-list"].textContent, /Round 1/, "history needs round labels");
  assert.match(elements["history-list"].textContent, /4 of 5/, "history needs packet outcomes");

  renderer.renderPlannerComparison({
    planned: {
      actions: ["RELAY", "SLEEP"],
      totalUtility: 12.5,
      remainingEnergy: 42
    },
    greedy: {
      actions: ["RELAY", "RELAY"],
      totalUtility: 10,
      remainingEnergy: 39
    },
    recommendation: "DP plan"
  });
  assert.match(elements["planner-comparison"].textContent, /DP plan/, "planner recommendation must be text");
  assert.match(elements["planner-comparison"].textContent, /12\.50/, "planner totals need two decimals");
}

function assertStaticDashboardRequirements() {
  var index = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  var readme = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");

  assert.match(index, /<ul id="route-list"/, "route list must keep its stable ID on semantic list markup");
  assert.match(index, /id="simulation-form"/, "dashboard needs a simulation form");
  assert.match(index, /id="rounds"/, "dashboard needs a rounds input");
  assert.match(index, /id="strategy"/, "dashboard needs a strategy selector");
  assert.match(index, /id="simulation-status"/, "dashboard needs a live status region");
  assert.match(index, /<svg[^>]+id="network-map"/, "dashboard needs an accessible topology canvas");
  assert.match(index, /id="history-list"/, "dashboard needs round history");
  assert.match(index, /id="planner-comparison"/, "dashboard needs planner comparison");
  assert.match(index, /local simulation API/i, "no-script copy must describe the local API requirement");
  assert.match(styles, /main\s*\{[^}]*grid-template-columns:[^;]+\s+[^;]+;/s, "desktop main needs two columns");
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*main\s*\{[^}]*grid-template-columns:\s*1fr/, "narrow main needs one column");
  assert.match(styles, /\.energy-fill,[\s\S]*?\.strategy-fill\s*\{[^}]*position:\s*absolute/s, "bright fills must occupy their tracks without covering labels");
  assert.ok(!/\bnpx\b/i.test(readme), "dashboard docs must not suggest a tool-installing preview command");
}

async function assertRequestBehavior() {
  var loaded = loadRenderer();
  var renderer = loaded.renderer;
  var elements = loaded.document.elements;
  var requestInput;
  var releaseResponse;
  var pending = renderer.requestSimulation(
    { rounds: 3, strategy: "mixed" },
    function (url, options) {
      requestInput = JSON.parse(options.body);
      return new Promise(function (resolve) {
        releaseResponse = resolve;
      });
    }
  );
  assert.deepStrictEqual(requestInput, { rounds: 3, strategy: "mixed" }, "request must forward selected controls");
  assert.strictEqual(elements["run-simulation"].disabled, true, "run button must disable while busy");
  releaseResponse({
    ok: true,
    json: async function () {
      return Object.assign({}, renderer.dashboardData, {
        links: [],
        history: [],
        plannerComparison: null
      });
    }
  });
  await pending;
  assert.strictEqual(elements["run-simulation"].disabled, false, "run button must re-enable after success");

  var previousMetrics = elements["metric-grid"].textContent;
  await renderer.requestSimulation(
    { rounds: 2, strategy: "selfish" },
    function () {
      return Promise.reject(new Error("engine offline"));
    }
  ).catch(function () {});
  assert.strictEqual(elements["metric-grid"].textContent, previousMetrics, "failed requests must preserve prior results");
  assert.match(elements["simulation-status"].textContent, /engine offline/, "request errors must remain visible");
}

(async function () {
  assertRendererBehavior();
  assertStaticDashboardRequirements();
  await assertRequestBehavior();
  console.log("Dashboard renderer/static assertions passed.");
}()).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
