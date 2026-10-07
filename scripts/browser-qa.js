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
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?seed=17" });
    await until("document.readyState === 'complete' && document.querySelectorAll('.action').length === 4", true);
    await evaluate("document.getElementById('begin-button').click()");
    const geometry = await evaluate("({viewport:innerWidth,scroll:document.documentElement.scrollWidth,modal:document.getElementById('tutorial').getBoundingClientRect().width,actions:document.querySelectorAll('.action').length})");
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, `${name}-open.png`), Buffer.from(screenshot.data, "base64"));
    console.log(name, JSON.stringify(geometry));
    assert.equal(geometry.viewport, width);
    assert.ok(geometry.scroll <= width, `${name} overflows horizontally`);
    assert.equal(geometry.actions, 4);
  }
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true}))");
  assert.equal(await evaluate("!document.getElementById('pause-overlay').classList.contains('hidden')"), true);
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true}))");
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('[data-action=TRANSMIT]').classList.contains('selected')"), true);
  for (const action of ["TRANSMIT","RELAY","IDLE","RELAY","IDLE","RELAY","IDLE","RELAY"]) {
    const previous = await evaluate("Number(document.getElementById('round-value').textContent)");
    await evaluate(`document.querySelector('[data-action="${action}"]').click();document.getElementById('confirm-action').click()`);
    if (previous < 8) await until(`Number(document.getElementById('round-value').textContent) === ${previous + 1}`, true);
    else await until("!document.getElementById('result-overlay').classList.contains('hidden')", true);
  }
  const result = await evaluate("({title:document.getElementById('result-title').textContent,stats:document.getElementById('result-stats').textContent})");
  assert.equal(result.title, "Network secured");
  assert.match(result.stats, /PACKETS5 \/ 8/);
  console.log("result", result);
  const resultShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(out, "mobile-result.png"), Buffer.from(resultShot.data, "base64"));
  await evaluate("document.getElementById('restart-button').click()");
  await until("document.getElementById('round-value').textContent === '1'", true);
  assert.equal(await evaluate("document.getElementById('goal-count').textContent"), "0 / 5");
  for (let turn = 0; turn < 8; turn++) {
    await evaluate("document.querySelector('[data-action=IDLE]').click();document.getElementById('confirm-action').click()");
    await until(`document.getElementById('goal-count').textContent === '0 / 5' && document.getElementById('round-value').textContent === '${Math.min(turn + 2, 8)}'`, true);
  }
  await until("!document.getElementById('result-overlay').classList.contains('hidden')", true);
  assert.equal(await evaluate("document.getElementById('result-title').textContent"), "Signal lost");
  console.log("pause, keyboard, win, loss, and restart passed");
  socket.close();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
