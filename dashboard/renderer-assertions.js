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
  ["metric-grid", "node-grid", "route-list", "strategy-bars", "last-updated", "empty-state"].forEach(function (id) {
    elements[id] = new FakeElement(id === "route-list" ? "ul" : "div");
  });

  return {
    createElement: function (tagName) {
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
}

function assertStaticDashboardRequirements() {
  var index = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  var readme = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");

  assert.match(index, /<ul id="route-list"/, "route list must keep its stable ID on semantic list markup");
  assert.match(index, /deterministic local snapshot data/i, "no-script copy must describe local deterministic data");
  assert.match(styles, /main\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "desktop main needs two columns");
  assert.match(styles, /@media \(max-width: 42rem\)[\s\S]*main\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "narrow main needs one column");
  assert.match(styles, /\.energy-fill,[\s\S]*?\.strategy-fill\s*\{[^}]*position:\s*absolute/s, "bright fills must occupy their tracks without covering labels");
  assert.ok(!/\bnpx\b/i.test(readme), "dashboard docs must not suggest a tool-installing preview command");
}

assertRendererBehavior();
assertStaticDashboardRequirements();
console.log("Dashboard renderer/static assertions passed.");
