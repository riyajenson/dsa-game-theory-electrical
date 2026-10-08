"use strict";
window.SignalAudio = (() => {
  let context;
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ } };
  let muted = read("signalbound-muted") === "true";
  let level = Number(read("signalbound-volume") ?? ".25");
  if (!Number.isFinite(level)) level = .25;
  level = Math.max(0, Math.min(1, level));
  function sync() {
    const button = document.getElementById("audio-mute");
    button.textContent = muted ? "♪ SOUND OFF" : "♫ SOUND ON";
    button.setAttribute("aria-pressed", String(muted));
    document.getElementById("audio-volume").value = String(Math.round(level * 100));
  }
  function tone(frequency, start, duration, type = "square") {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(Math.max(.0001, level * .09), start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
  function play(kind) {
    if (muted || level === 0) return;
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === "suspended") context.resume();
      const now = context.currentTime;
      const notes = {
        select: [[440, 0, .06]], transmit: [[440, 0, .12], [660, .10, .14]],
        relay: [[330, 0, .1], [494, .12, .12]], sleep: [[262, 0, .2]],
        idle: [[220, 0, .09]], deliver: [[523, 0, .13], [659, .14, .13], [784, .28, .22]],
        win: [[523, 0, .18], [659, .2, .18], [784, .4, .3]],
        loss: [[330, 0, .18], [247, .2, .28]]
      }[kind] || [];
      for (const [frequency, offset, duration] of notes) tone(frequency, now + offset, duration);
    } catch { /* Audio is optional. */ }
  }
  return {
    init: sync,
    play,
    toggle() { muted = !muted; save("signalbound-muted", String(muted)); sync(); },
    volume(value) { level = Math.max(0, Math.min(1, value)); save("signalbound-volume", String(level)); sync(); }
  };
})();
