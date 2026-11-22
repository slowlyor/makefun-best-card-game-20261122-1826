// audio.js — synthesized WebAudio bleeps only. No audio files, no network.
// One tiny helper builds every sound: a short oscillator note with a
// quick fade, so clicks, plays and wins each have their own voice.

let ctx = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(value) {
  muted = !!value;
}

export function isMuted() {
  return muted;
}

function blip(freq, dur, type, vol, when = 0) {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function sfxClick() {
  blip(660, 0.07, 'triangle', 0.12);
}

export function sfxPlay() {
  blip(392, 0.1, 'square', 0.08);
  blip(523, 0.12, 'square', 0.08, 0.07);
}

export function sfxAttack() {
  blip(180, 0.16, 'sawtooth', 0.12);
  blip(120, 0.2, 'sawtooth', 0.1, 0.05);
}

export function sfxHurt() {
  blip(220, 0.18, 'sawtooth', 0.1);
  blip(147, 0.25, 'sawtooth', 0.1, 0.08);
}

export function sfxDraw() {
  blip(880, 0.06, 'sine', 0.07);
}

export function sfxTurn() {
  blip(440, 0.09, 'sine', 0.09);
  blip(587, 0.09, 'sine', 0.09, 0.08);
}

export function sfxWin() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => blip(n, 0.28, 'triangle', 0.14, i * 0.12));
}

export function sfxLoss() {
  const notes = [392, 330, 262, 196];
  notes.forEach((n, i) => blip(n, 0.3, 'triangle', 0.12, i * 0.14));
}
