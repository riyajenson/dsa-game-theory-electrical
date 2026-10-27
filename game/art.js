"use strict";

// Original SVG pixel art. Every map outcome and path comes from the C++ response.
window.SignalArt = (() => {
  const ns = "http://www.w3.org/2000/svg";
  const pos = { 1: [102, 208], 2: [257, 92], 3: [258, 311], 4: [435, 294], 5: [548, 179] };
  const names = { 1: "SPARK-01", 2: "DRIFT-02", 3: "NOVA-03", 4: "ARC-04", 5: "GATE-05" };
  const el = (tag, attributes = {}) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  };
  const block = (parent, x, y, width, height, className) =>
    parent.append(el("rect", { x, y, width, height, class: className }));
  const linePath = (ids) => ids.map((id, index) =>
    `${index ? "L" : "M"}${pos[id][0]},${pos[id][1]}`).join(" ");

  function terrain(map, seed) {
    block(map, 0, 0, 640, 416, "ground-base");
    for (let y = 0; y < 416; y += 16) {
      for (let x = 0; x < 640; x += 16) {
        const n = (x * 13 + y * 7 + seed * 3) % 11;
        block(map, x, y, 16, 16, n < 2 ? "ground-tile bright" : "ground-tile");
        if (n === 4) block(map, x + 4, y + 5, 3, 3, "ground-spark");
      }
    }
    // Dark terrain islands and signal ruins keep the map spatial, not chart-like.
    for (const [x, y, w, h] of [[19, 32, 118, 58], [333, 32, 91, 73],
      [24, 322, 147, 54], [473, 313, 111, 64]]) {
      block(map, x, y, w, h, "terrain-island");
      block(map, x + 8, y + 8, w - 16, 4, "terrain-ridge");
    }
    for (const [x, y] of [[45, 50], [365, 59], [69, 346], [511, 343]]) {
      block(map, x, y, 12, 20, "ruin-post");
      block(map, x + 3, y - 5, 6, 5, "ruin-cap");
      block(map, x + 23, y + 8, 5, 5, "ground-spark");
    }
    const zone = el("path", { d: "M 293 184 L 349 200 L 382 248 L 326 269 Z", class: "interference-fog" });
    map.append(zone);
  }

  function cable(map, link) {
    const [x1, y1] = pos[link.source], [x2, y2] = pos[link.target];
    map.append(el("line", { x1, y1, x2, y2, class: "cable-shadow" }));
    map.append(el("line", { x1, y1, x2, y2,
      class: link.interference ? "cable-core cable-danger" : "cable-core" }));
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    if (link.interference) {
      const hazard = el("g", { class: "hazard-zone" });
      block(hazard, midX - 20, midY - 14, 40, 28, "hazard-back");
      block(hazard, midX - 12, midY - 20, 4, 7, "hazard-spark");
      block(hazard, midX + 9, midY + 13, 4, 7, "hazard-spark");
      const mark = el("text", { x: midX, y: midY + 6, "text-anchor": "middle", class: "hazard-mark" });
      mark.textContent = "!";
      hazard.append(mark);
      map.append(hazard);
    }
  }

  function sprite(map, node) {
    const [x, y] = pos[node.id];
    const group = el("g", { class: `sensor sensor-${node.id}${node.strategy === "selfish" ? " is-unreliable" : ""}${node.suspicious ? " is-suspicious" : ""}${node.energy < 10 ? " is-low" : ""}` });
    const anchor = el("g", { transform: `translate(${x - 21} ${y - 30})` });
    const body = el("g", { class: "sprite-body" });
    block(body, 5, 52, 34, 7, "sprite-shadow");
    if (node.id === 5) {
      block(body, 0, 13, 42, 40, "terminal-wall");
      block(body, 5, 5, 32, 12, "terminal-top");
      block(body, 12, 24, 18, 18, "terminal-door");
      block(body, 16, 27, 10, 7, "terminal-light");
      block(body, 18, -8, 6, 15, "terminal-aerial");
      block(body, 12, -13, 18, 5, "terminal-signal");
    } else {
      // Each sensor has a distinct face, chassis, antenna, and color story.
      block(body, 18, -4, 6, 13, "sprite-antenna");
      block(body, 14, -10, 14, 7, "sprite-beacon");
      block(body, node.id === 2 ? 4 : 1, 12, node.id === 2 ? 34 : 40, 31, "sprite-shell");
      block(body, 9, 16, 24, 19, "sprite-face");
      block(body, node.id === 4 ? 12 : 13, 23, 5, 6, "sprite-eye");
      block(body, node.id === 4 ? 24 : 25, 23, 5, 6, "sprite-eye");
      block(body, 15, 44, 8, 7, "sprite-foot");
      block(body, 27, 44, 8, 7, "sprite-foot");
      if (node.id === 1) {
        block(body, -4, 20, 5, 14, "sprite-arm");
        block(body, 41, 20, 5, 14, "sprite-arm");
        block(body, 18, 36, 7, 6, "sprite-heart");
      }
      if (node.id === 3) block(body, 18, 36, 9, 4, "sprite-smile");
      if (node.id === 4) block(body, 3, 34, 9, 8, "sprite-coil");
      if (node.id === 2) block(body, 11, 35, 21, 4, "sprite-frown");
    }
    anchor.append(body);
    group.append(anchor);
    if (node.suspicious) {
      const badge = el("text", { x: x + 23, y: y - 30, class: "suspicion-badge" });
      badge.textContent = "!";
      group.append(badge);
    }
    if (node.energy < 10) group.append(el("circle", { cx: x, cy: y,
      r: 32, class: "low-energy-ring" }));
    const label = el("text", { x, y: y + 49, "text-anchor": "middle", class: "sensor-label" });
    label.textContent = names[node.id];
    group.append(label);
    const title = el("title");
    title.textContent = `${names[node.id]} · ${node.energy.toFixed(1)} energy · ${Math.round(node.reputation * 100)}% trust · ${node.strategy}${node.suspicious ? " · suspicious" : ""}`;
    group.append(title);
    map.append(group);
  }

  function packet(map, state) {
    const turn = state.history.at(-1);
    if (!turn) return;
    if (turn.route.length > 1) {
      let route = turn.route;
      if (!turn.delivered && turn.blockedBy) {
        const stop = route.indexOf(turn.blockedBy);
        if (stop >= 0) route = route.slice(0, stop + 1);
      }
      const piece = el("g", { class: turn.delivered ? "packet-flight" : "packet-flight packet-failed" });
      block(piece, -7, -7, 14, 14, "packet-shell");
      block(piece, -3, -3, 6, 6, "packet-core");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const [endX, endY] = pos[route.at(-1)];
        piece.setAttribute("transform", `translate(${endX} ${endY})`);
      } else {
        piece.append(el("animateMotion", { path: linePath(route), dur: "1.25s",
          fill: "freeze", repeatCount: "1" }));
      }
      map.append(piece);
      if (turn.delivered) {
        const [endX, endY] = pos[route.at(-1)];
        const anchor = el("g", { transform: `translate(${endX} ${endY})` });
        const flash = el("g", { class: "delivery-burst" });
        for (const [x, y] of [[-30, 0], [30, 0], [0, -30], [0, 30]])
          block(flash, x - 3, y - 3, 6, 6, "burst-pixel");
        anchor.append(flash);
        map.append(anchor);
      }
    } else if (turn.action === "SLEEP" || turn.action === "IDLE") {
      const marker = el("text", { x: 102, y: 156,
        class: turn.action === "SLEEP" ? "sleep-effect" : "idle-effect" });
      marker.textContent = turn.action === "SLEEP" ? "Z Z" : "···";
      map.append(marker);
    }
  }

  function draw(state) {
    const map = document.getElementById("game-map");
    map.replaceChildren();
    terrain(map, state.seed);
    for (const link of state.links) cable(map, link);
    if (state.routes.shortest.length)
      map.append(el("path", { d: linePath(state.routes.shortest), class: "route-short" }));
    if (state.routes.energyAware.length)
      map.append(el("path", { d: linePath(state.routes.energyAware), class: "route-safe" }));
    for (const node of state.nodes) sprite(map, node);
    packet(map, state);
  }
  return { draw };
})();
