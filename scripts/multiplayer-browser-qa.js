"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const BASE_URL = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const TURN_WAIT_MS = Number(process.env.QA_TURN_WAIT_MS || 10000);
if (!Number.isSafeInteger(TURN_WAIT_MS) || TURN_WAIT_MS < 1000 || TURN_WAIT_MS > 120000)
  throw new Error("QA_TURN_WAIT_MS must be an integer from 1000 to 120000");

async function tab(port, width, height) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${BASE_URL}/multiplayer`,
    { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id; pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async (expression) => {
    const answer = await send("Runtime.evaluate", { expression, returnByValue: true,
      awaitPromise: true });
    if (answer.exceptionDetails) throw new Error(answer.exceptionDetails.text);
    return answer.result.value;
  };
  const until = async (expression, expected, ms = 10000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      try { if (await evaluate(expression) === expected) return; }
      catch { /* A reload can evaluate before the page script initializes. */ }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    throw new Error(`Timed out on ${port}: ${expression}`);
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1,
    mobile: width < 500 });
  await send("Page.navigate", { url: `${BASE_URL}/multiplayer` });
  await until("document.readyState === 'complete' && Boolean(document.getElementById('entry-panel'))", true);
  await evaluate("localStorage.clear()");
  await send("Page.reload", { ignoreCache: true });
  await until("document.readyState === 'complete' && !document.getElementById('entry-panel').classList.contains('hidden')", true);
  const screenshot = async (name) => {
    const output = path.join(os.tmpdir(), "signalbound-multiplayer-qa");
    fs.mkdirSync(output, { recursive: true });
    const result = await send("Page.captureScreenshot", { format: "png",
      captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(result.data, "base64"));
  };
  return { evaluate, until, send, screenshot, close: () => socket.close() };
}

async function main() {
  const a = await tab(9223, 1440, 1000);
  const b = await tab(9224, 390, 844);
  try {
    await a.evaluate("document.getElementById('guest-name').value='QA Ada'; document.getElementById('create-room').click()");
    await a.until("!document.getElementById('lobby-panel').classList.contains('hidden')", true);
    const code = await a.evaluate("document.getElementById('lobby-code').textContent");
    await a.screenshot("desktop-lobby");
    await b.evaluate(`document.getElementById('guest-name').value='QA Lin'; document.getElementById('room-code').value='${code}'; document.getElementById('join-room').click()`);
    await b.until("!document.getElementById('lobby-panel').classList.contains('hidden')", true);
    await a.until("document.querySelectorAll('#lobby-players li').length === 2", true);
    await b.screenshot("mobile-lobby");
    await a.evaluate("document.getElementById('ready-button').click()");
    await b.evaluate("document.getElementById('ready-button').click()");
    await a.until("!document.getElementById('start-button').disabled", true);
    await a.evaluate("document.getElementById('start-button').click()");
    await a.until("room?.status === 'playing' && room?.state?.round === 0", true);
    await b.until("room?.status === 'playing' && room?.state?.round === 0", true);
    await a.screenshot("desktop-match"); await b.screenshot("mobile-match");
    for (const [name, browser, width] of [["desktop", a, 1440], ["mobile", b, 390]]) {
      const geometry = await browser.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,actions:document.querySelectorAll('#multi-actions button').length})");
      assert.equal(geometry.width, width);
      assert.ok(geometry.scroll <= width, `${name} horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.actions, 4);
    }
    await a.evaluate("document.querySelectorAll('#multi-actions button')[0].click()");
    await b.until("room?.players?.[0]?.submitted === true", true);
    assert.equal(await b.evaluate("room.ownAction === null && room.state.history.length === 0"), true);
    await b.send("Page.reload", { ignoreCache: true });
    await b.until("room?.myNode === 2 && room?.state?.round === 0", true);
    await b.evaluate("document.querySelectorAll('#multi-actions button')[1].click()");
    await a.until("room?.state?.round === 1", true);
    assert.equal(await a.evaluate("room.state.delivered"), 1);
    await a.screenshot("desktop-resolution");
    await a.evaluate("document.querySelectorAll('#multi-actions button')[0].click()");
    await a.until("room?.state?.round === 2", true, TURN_WAIT_MS);
    assert.equal(await a.evaluate("room.state.history[1].actions[1]"), "IDLE");
    assert.equal(await a.evaluate("room.state.history[1].packets[0].blockedBy"), 2);
    for (let round = 3; round <= 7; ++round) {
      await a.until(`room?.state?.round === ${round - 1} && !room.ownAction`, true);
      await b.until(`room?.state?.round === ${round - 1} && !room.ownAction`, true);
      await a.evaluate("document.querySelectorAll('#multi-actions button')[0].click()");
      await b.evaluate("document.querySelectorAll('#multi-actions button')[1].click()");
      await a.until(`room?.state?.round === ${round}`, true);
    }
    await a.until("room?.state?.round === 7 && !room.ownAction", true);
    await b.until("room?.state?.round === 7 && !room.ownAction", true);
    await a.evaluate("document.querySelectorAll('#multi-actions button')[2].click()");
    await b.evaluate("document.querySelectorAll('#multi-actions button')[0].click()");
    await a.until("room?.status === 'finished'", true);
    await b.until("room?.status === 'finished'", true);
    assert.equal(await a.evaluate("room.state.delivered"), 7);
    assert.equal(await a.evaluate("room.state.status"), "won");
    await a.screenshot("desktop-results"); await b.screenshot("mobile-results");
    await b.send("Page.reload", { ignoreCache: true });
    await b.until("room?.status === 'finished' && room?.ranking?.length === 2", true);
    const oldMatch = await a.evaluate("room.matchId");
    await a.evaluate("document.getElementById('rematch-button').click()");
    await b.evaluate("document.getElementById('rematch-button').click()");
    await a.until(`room?.status === 'playing' && room?.state?.round === 0 && room.matchId !== '${oldMatch}'`, true);
    assert.equal(await b.evaluate("room.myNode"), 2);
    console.log(`Two independent Chrome profiles played room ${code}: refresh, timeout, 7 deliveries, win, rematch.`);
    console.log(`Screenshots: ${path.join(os.tmpdir(), "signalbound-multiplayer-qa")}`);
  } finally { a.close(); b.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
