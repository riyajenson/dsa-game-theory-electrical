"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

// Run against `npm start` and a local Chrome started with --remote-debugging-port=9223.

async function main() {
  const tab = await (await fetch("http://127.0.0.1:9223/json/new?http://127.0.0.1:3000/?seed=17", { method: "PUT" })).json();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id; pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, expected) => {
    for (let i = 0; i < 50; i++) {
      if (await evaluate(expression) === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  const out = path.join(os.tmpdir(), "signalbound-qa");
  fs.mkdirSync(out, { recursive: true });
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?seed=17" });
    await until("document.readyState === 'complete' && document.querySelectorAll('.action').length === 4", true);
    assert.equal(await evaluate("!document.getElementById('title-screen').classList.contains('hidden')"), true);
    const titleShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, `${name}-title.png`), Buffer.from(titleShot.data, "base64"));
    await evaluate("document.getElementById('title-start').click()");
    await until("!document.getElementById('tutorial').classList.contains('hidden')", true);
    await evaluate("document.getElementById('begin-button').click()");
    const geometry = await evaluate("({viewport:innerWidth,scroll:document.documentElement.scrollWidth,modal:document.getElementById('tutorial').getBoundingClientRect().width,actions:document.querySelectorAll('.action').length})");
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, `${name}-open.png`), Buffer.from(screenshot.data, "base64"));
    console.log(name, JSON.stringify(geometry));
    assert.equal(geometry.viewport, width);
    assert.ok(geometry.scroll <= width, `${name} overflows horizontally`);
    assert.equal(geometry.actions, 4);
    assert.equal(await evaluate("Boolean(document.getElementById('audio-mute') && document.getElementById('audio-volume'))"), true);
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true}))");
    assert.equal(await evaluate("!document.getElementById('pause-overlay').classList.contains('hidden')"), true);
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true}))");
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}))");
    assert.equal(await evaluate("document.querySelector('[data-action=TRANSMIT]').classList.contains('selected')"), true);
    for (const action of ["TRANSMIT","RELAY","TRANSMIT","RELAY","IDLE","RELAY","IDLE","RELAY"]) {
      const previous = await evaluate("Number(document.getElementById('round-value').textContent)");
      await evaluate(`document.querySelector('[data-action="${action}"]').click();document.getElementById('confirm-action').click()`);
      if (previous === 1) {
        await until("state.round === 1", true);
        const turnShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        fs.writeFileSync(path.join(out, `${name}-turn.png`), Buffer.from(turnShot.data, "base64"));
      }
      await until("!busy", true);
      if (previous < 8) await until(`Number(document.getElementById('round-value').textContent) === ${previous + 1}`, true);
      else await until("!document.getElementById('result-overlay').classList.contains('hidden')", true);
    }
    const result = await evaluate("({title:document.getElementById('result-title').textContent,stats:document.getElementById('result-stats').textContent})");
    assert.equal(result.title, "Network secured");
    assert.match(result.stats, /PACKETS6 \/ 8/);
    console.log("result", result);
    const resultShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, `${name}-result.png`), Buffer.from(resultShot.data, "base64"));
    await evaluate("document.getElementById('restart-button').click()");
    await until("document.getElementById('round-value').textContent === '1'", true);
    assert.equal(await evaluate("document.getElementById('goal-count').textContent"), "0 / 6");
    for (let turn = 0; turn < 8; turn++) {
      await evaluate("document.querySelector('[data-action=IDLE]').click();document.getElementById('confirm-action').click()");
      await until(`document.getElementById('goal-count').textContent === '0 / 6' && document.getElementById('round-value').textContent === '${Math.min(turn + 2, 8)}'`, true);
      await until("!busy", true);
    }
    await until("!document.getElementById('result-overlay').classList.contains('hidden')", true);
    assert.equal(await evaluate("document.getElementById('result-title').textContent"), "Signal lost");
    const lossShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, `${name}-loss.png`), Buffer.from(lossShot.data, "base64"));
  }
  await evaluate("if (document.getElementById('audio-mute').getAttribute('aria-pressed') !== 'true') document.getElementById('audio-mute').click();document.getElementById('audio-volume').value='45';document.getElementById('audio-volume').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("localStorage.getItem('signalbound-muted') === 'true' && localStorage.getItem('signalbound-volume') === '0.45'"), true);
  await evaluate("window.__originalFetch=window.fetch;window.fetch=()=>Promise.reject(new Error('offline'));document.getElementById('restart-button').click()");
  await until("!document.getElementById('connection-banner').classList.contains('hidden')", true);
  await evaluate("window.fetch=window.__originalFetch;document.getElementById('retry-button').click()");
  await until("document.getElementById('connection-banner').classList.contains('hidden')", true);
  await send("Page.reload", { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('.action').length === 4", true);
  assert.equal(await evaluate("document.getElementById('audio-mute').getAttribute('aria-pressed') === 'true' && document.getElementById('audio-volume').value === '45'"), true);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await evaluate("document.getElementById('title-start').click()");
  await until("!document.getElementById('tutorial').classList.contains('hidden')", true);
  await evaluate("document.getElementById('begin-button').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));document.querySelector('[data-action=TRANSMIT]').focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");
  await until("state.round === 1 && !busy", true);
  assert.equal(await evaluate("document.querySelectorAll('animateMotion').length"), 0);
  await evaluate("window.__originalFetch=window.fetch;window.fetch=()=>Promise.reject(new Error('offline'));document.querySelector('[data-action=RELAY]').click();document.getElementById('confirm-action').click()");
  await until("!document.getElementById('connection-banner').classList.contains('hidden') && !busy", true);
  assert.equal(await evaluate("state.round"), 1);
  await evaluate("window.fetch=window.__originalFetch;document.getElementById('retry-button').click()");
  await until("state.round === 2 && !busy", true);
  assert.equal(await evaluate("state.history.map(turn=>turn.action).join(',')"), "TRANSMIT,RELAY");
  console.log("Reduced motion, Enter confirmation, and failed-turn retry preserve replay history");
  console.log("Desktop and mobile win/loss, pause, keyboard, restart, API recovery, and sound persistence passed");
  socket.close();
}
main().catch((error) => { console.error(error); process.exit(1); });
