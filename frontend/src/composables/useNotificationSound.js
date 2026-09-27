// frontend/src/composables/useNotificationSound.js
/**
 * Мягкие звуки через WebAudio.
 * Не требует файлов, работает в PWA.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    } catch (e) {
      console.warn('[sound] AudioContext недоступен:', e);
    }
  }
  return audioCtx;
}

function tone({ freq = 880, duration = 0.08, type = 'sine', gain = 0.08, delay = 0 }) {
  const ctx = getCtx();
  if (!ctx) return;

  // Возобновляем контекст, если он suspended (Safari/Chrome policy)
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(g);
  g.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playIncomingMessage() {
  // Двухтоновый «поп» как у Telegram
  tone({ freq: 700, duration: 0.07, gain: 0.07 });
  tone({ freq: 950, duration: 0.10, gain: 0.06, delay: 0.06 });
}

export function playOutgoingMessage() {
  tone({ freq: 1200, duration: 0.04, gain: 0.05, type: 'sine' });
}

export function playReaction() {
  tone({ freq: 1500, duration: 0.06, gain: 0.05 });
  tone({ freq: 1800, duration: 0.08, gain: 0.04, delay: 0.04 });
}

export function playError() {
  tone({ freq: 300, duration: 0.15, gain: 0.05, type: 'triangle' });
}