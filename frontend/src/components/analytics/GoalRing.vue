<!-- frontend/src/components/analytics/GoalRing.vue -->
<script setup>
import { computed } from 'vue';
import MascotImage from './MascotImage.vue';
import { fmt } from '@/composables/useFormat';

const props = defineProps({
  percent: { type: Number, default: 0 },
  saved: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  goalName: { type: String, default: 'Цель' },
  goalEmoji: { type: String, default: '🎯' },
});

const clampedPercent = computed(() => Math.max(0, Math.min(100, props.percent)));
const remaining = computed(() => Math.max(0, props.target - props.saved));
const isDone = computed(() => clampedPercent.value >= 100);

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const dashOffset = computed(() =>
  CIRCUMFERENCE * (1 - clampedPercent.value / 100)
);
</script>

<template>
  <div class="goal-ring" :class="{ 'is-done': isDone }">
    <div class="goal-ring__bg" aria-hidden="true"></div>

    <MascotImage
      name="star"
      position="floating"
      :size="70"
      fallback="🎯"
      alt="Цель"
    />

    <div class="goal-ring__content">
      <div class="goal-ring__title">
        <span>{{ goalEmoji }}</span>
        <span>{{ goalName }}</span>
      </div>

      <div class="goal-ring__visual">
        <svg viewBox="0 0 120 120" class="goal-ring__svg">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#a855f7" />
              <stop offset="100%" stop-color="#ec4899" />
            </linearGradient>
          </defs>

          <circle
            cx="60" cy="60" :r="RADIUS"
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            stroke-width="10"
          />

          <circle
            cx="60" cy="60" :r="RADIUS"
            fill="none"
            stroke="url(#ringGrad)"
            stroke-width="10"
            stroke-linecap="round"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="dashOffset"
            transform="rotate(-90 60 60)"
            class="goal-ring__progress"
          />
        </svg>

        <div class="goal-ring__percent">
          <span class="goal-ring__percent-value">
            {{ clampedPercent.toFixed(1) }}
          </span>
          <span class="goal-ring__percent-sign">%</span>
        </div>
      </div>

      <div class="goal-ring__info">
        <template v-if="isDone">
          <span class="goal-ring__done">✅ Цель достигнута!</span>
        </template>
        <template v-else>
          <span class="goal-ring__remaining">Осталось {{ fmt(remaining) }} ₽</span>
          <span class="goal-ring__target">из {{ fmt(target) }} ₽</span>
        </template>
      </div>

      <button v-if="!isDone" class="goal-ring__btn" type="button">
        Внести
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.goal-ring {
  position: relative;
  border-radius: 18px;
  padding: 16px;
  min-height: 120px;
  color: #ffffff;
  /* ✅ overflow: visible — звезда выходит за границы */
  overflow: visible;
  isolation: isolate;
}

.goal-ring__bg {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  overflow: hidden;
  z-index: 0;

  background:
    radial-gradient(circle at 100% 100%, rgba(236, 72, 153, 0.25), transparent 60%),
    radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.3), transparent 55%),
    linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);

  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.4);
}

.goal-ring.is-done .goal-ring__bg {
  background:
    radial-gradient(circle at 50% 50%, rgba(74, 222, 128, 0.25), transparent 60%),
    linear-gradient(135deg, #064e3b 0%, #065f46 100%);
  box-shadow:
    0 0 0 1px rgba(74, 222, 128, 0.25) inset,
    0 12px 32px -10px rgba(74, 222, 128, 0.5);
}

.goal-ring__content {
  position: relative;
  z-index: 3;
  padding-right: 60px;
}

.goal-ring__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.9;
  margin-bottom: 6px;
}

.goal-ring__visual {
  position: relative;
  width: 110px;
  height: 110px;
  margin: 0 auto;
}

.goal-ring__svg {
  width: 100%;
  height: 100%;
  display: block;
}

.goal-ring__percent {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  color: #ffffff;
}

.goal-ring__percent-value {
  font-size: 24px;
  font-weight: 300;
  letter-spacing: -0.02em;
}

.goal-ring__percent-sign {
  font-size: 14px;
  opacity: 0.7;
  margin-left: 2px;
}

.goal-ring__info {
  text-align: center;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.goal-ring__remaining {
  font-size: 12px;
  font-weight: 700;
}

.goal-ring__target {
  font-size: 10.5px;
  opacity: 0.65;
}

.goal-ring__done {
  font-size: 12px;
  font-weight: 800;
  color: #4ade80;
  text-shadow: 0 0 12px rgba(74, 222, 128, 0.5);
}

.goal-ring__btn {
  display: block;
  margin: 10px auto 0;
  padding: 7px 18px;
  border-radius: 999px;
  border: none;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 800;
  color: #0a0612;
  background: linear-gradient(180deg, #fde047, #facc15);
  box-shadow: 0 8px 20px -6px rgba(250, 204, 21, 0.6);
  cursor: pointer;
  transition: transform 0.15s;

  &:hover { transform: translateY(-2px); }
  &:active { transform: scale(0.97); }
}

@media (max-width: 700px) {
  .goal-ring { padding: 14px; }
  .goal-ring__visual { width: 96px; height: 96px; }
  .goal-ring__percent-value { font-size: 20px; }
  .goal-ring__content { padding-right: 50px; }
}

@media (prefers-reduced-motion: reduce) {
  .goal-ring__btn { transition: none; }
}
</style>