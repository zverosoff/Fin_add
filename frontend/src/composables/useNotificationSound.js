// frontend/src/composables/useNotificationSound.js
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
  tone({ freq: 700, duration: 0.07, gain: 0.07 });
  tone({ freq: 950, duration: 0.10, gain: 0.06, delay: 0.06 });
}

export function playOutgoingMessage() {
  // ✅ Приятный «свуш» — низкий тон + высокий отклик
  tone({ freq: 620, duration: 0.05, gain: 0.05, type: 'sine' });
  tone({ freq: 980, duration: 0.06, gain: 0.045, type: 'sine', delay: 0.04 });
}

export function playReaction() {
  tone({ freq: 1500, duration: 0.06, gain: 0.05 });
  tone({ freq: 1800, duration: 0.08, gain: 0.04, delay: 0.04 });
}

export function playError() {
  tone({ freq: 300, duration: 0.15, gain: 0.05, type: 'triangle' });
}

export function playSendError() {
  // Резкий двойной "не получилось"
  tone({ freq: 220, duration: 0.10, gain: 0.06, type: 'sawtooth' });
  tone({ freq: 180, duration: 0.14, gain: 0.06, type: 'sawtooth', delay: 0.10 });
}

export function playSuccess() {
  tone({ freq: 880, duration: 0.06, gain: 0.05 });
  tone({ freq: 1320, duration: 0.08, gain: 0.05, delay: 0.06 });
}