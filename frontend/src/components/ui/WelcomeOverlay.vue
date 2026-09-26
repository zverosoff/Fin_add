<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  userName: { type: String, default: '' },
  percent: { type: Number, default: 0 },
  stage: { type: String, default: 'Загрузка…' },
  done: { type: Boolean, default: false },
});

const isDone = computed(() => props.done || props.percent >= 100);
</script>

<template>
  <Transition name="welcome">
    <div
      v-if="visible"
      class="welcome-overlay"
      :class="{ 'is-done': isDone }"
    >
      <div class="welcome-content">
        <div class="welcome-logo">
          <span class="welcome-logo-star">★</span>
          <span class="welcome-logo-text">ФИНАНСЫ PRO+</span>
        </div>

        <div class="welcome-text">
          Добро пожаловать<span v-if="userName">, <span class="welcome-name">{{ userName }}</span></span>!
        </div>

        <div class="welcome-progress">
          <div class="wp-track">
            <div
              class="wp-fill"
              :class="{ done: isDone }"
              :style="{ width: Math.min(100, Math.max(0, percent)) + '%' }"
            ></div>
          </div>
          <div class="wp-percent">{{ Math.round(percent) }}%</div>
        </div>

        <div class="welcome-status" :class="{ done: isDone }">
          <span v-if="!isDone" class="welcome-status-spinner"></span>
          <span v-else class="welcome-status-check">✓</span>
          <span class="welcome-status-text">{{ stage }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.welcome-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  background: linear-gradient(
    135deg,
    #1e3a8a 0%,
    #4c1d95 25%,
    #6b21a8 50%,
    #1e40af 75%,
    #1e3a8a 100%
  );
  background-size: 400% 400%;
  animation: welcomeGradient 4s ease-in-out infinite;

  pointer-events: auto;

  padding-top: calc(24px + env(safe-area-inset-top, 0));
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0));

  /* ✅ Когда "done" — разрешаем клики сквозь оверлей */
  &.is-done {
    pointer-events: none;
  }
}

@keyframes welcomeGradient {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.welcome-content {
  text-align: center;
  color: #ffffff;
  max-width: 100%;
  width: 100%;
  max-width: 440px;
  padding: 0 16px;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.welcome-logo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 20px 60px -20px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  animation: welcomeLogoIn 0.7s cubic-bezier(.34,1.56,.64,1) both;
}

.welcome-logo-star {
  font-size: 28px;
  line-height: 1;
  color: #fbbf24;
  filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.8));
  animation: welcomeStarSpin 3s ease-in-out infinite;
}

.welcome-logo-text {
  font-family: "Inter", -apple-system, sans-serif;
  font-size: clamp(18px, 4vw, 28px);
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #ffffff;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

@keyframes welcomeLogoIn {
  from { opacity: 0; transform: scale(.7) translateY(-20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes welcomeStarSpin {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50%      { transform: rotate(180deg) scale(1.15); }
}

.welcome-text {
  font-family: "Inter", -apple-system, sans-serif;
  font-size: clamp(22px, 5vw, 40px);
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  animation: welcomeFloat 2.5s ease-in-out infinite;

  white-space: normal;
  word-break: keep-all;
  overflow-wrap: break-word;
  max-width: 100%;
}

.welcome-name {
  display: inline-block;
  background: linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 800;
  animation: welcomeShine 2s ease-in-out infinite;
  white-space: nowrap;
}

@keyframes welcomeFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

@keyframes welcomeShine {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

.welcome-progress {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.wp-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
  position: relative;
}

.wp-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24);
  background-size: 200% 100%;
  animation: wpShimmer 1.8s ease-in-out infinite;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.6);
  transition: width 0.35s cubic-bezier(.22,.61,.36,1);

  &.done {
    background: linear-gradient(90deg, #22c55e, #4ade80);
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.7);
    animation: none;
  }
}

@keyframes wpShimmer {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

.wp-percent {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.04em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.welcome-status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-family: "Inter", -apple-system, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  animation: welcomeStatusIn 0.5s ease-out 0.3s both;
  transition: background 0.3s, border-color 0.3s;

  &.done {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
    color: #86efac;
  }
}

.welcome-status-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: welcomeSpinner 0.9s linear infinite;
  flex-shrink: 0;
}

.welcome-status-check {
  display: inline-block;
  font-size: 16px;
  line-height: 1;
  color: #22c55e;
  animation: checkPop 0.4s cubic-bezier(.34,1.56,.64,1);
}

@keyframes checkPop {
  0%   { transform: scale(0); }
  60%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.welcome-status-text {
  white-space: nowrap;
}

@keyframes welcomeSpinner {
  to { transform: rotate(360deg); }
}

@keyframes welcomeStatusIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ✅ Ускоренное исчезновение: было 0.7s */
.welcome-enter-active {
  transition:
    opacity 0.35s cubic-bezier(.22,.61,.36,1),
    transform 0.35s cubic-bezier(.22,.61,.36,1);
}
.welcome-leave-active {
  transition:
    opacity 0.4s cubic-bezier(.4,0,.2,1),
    transform 0.4s cubic-bezier(.4,0,.2,1),
    filter 0.4s ease;
}
.welcome-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.96);
}
.welcome-leave-to {
  opacity: 0;
  transform: scale(1.08);
  filter: blur(10px);
}

@media (max-width: 700px) {
  .welcome-logo { padding: 10px 20px; gap: 8px; }
  .welcome-logo-star { font-size: 22px; }
  .welcome-logo-text { font-size: 16px; letter-spacing: 0.06em; }
  .welcome-text { font-size: clamp(20px, 7vw, 32px); }
  .welcome-status { font-size: 13px; padding: 8px 16px; }
  .welcome-progress { max-width: 260px; }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-overlay { animation: none; background-size: 100% 100%; }
  .welcome-logo,
  .welcome-logo-star,
  .welcome-text,
  .welcome-name,
  .wp-fill,
  .welcome-status-spinner { animation: none; }
  .welcome-leave-active { transition: opacity 0.2s ease; }
  .welcome-leave-to { filter: none; transform: none; }
}
</style>