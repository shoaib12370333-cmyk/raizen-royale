// Tiny helpers for admin chat notifications (no audio files needed).

let ctx = null;

/** A short two-note "ping" synthesised with WebAudio. Safe to call anywhere; silently does nothing if blocked. */
export function playPing() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    /* audio is a nice-to-have */
  }
}

export function readSoundPref() {
  try {
    return localStorage.getItem("rr_admin_chat_sound") !== "off";
  } catch {
    return true;
  }
}

export function writeSoundPref(on) {
  try {
    localStorage.setItem("rr_admin_chat_sound", on ? "on" : "off");
  } catch {
    /* ignore */
  }
}
