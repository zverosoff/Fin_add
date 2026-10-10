<script setup>
import { computed, ref, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWebSocket } from '@/composables/useWebSocket';
import { useAccountsStore } from '@/stores/accounts';
import { useScanStore } from '@/stores/scan';

const route = useRoute();
const router = useRouter();
const { connected } = useWebSocket();
const accounts = useAccountsStore();
const scanStore = useScanStore();

const LOADING_MS = 2500;
const SUCCESS_MS = 1500;
const fabPhase = ref('loading');

onMounted(() => {
  setTimeout(() => {
    fabPhase.value = 'success';
    setTimeout(() => { fabPhase.value = 'ready'; }, SUCCESS_MS);
  }, LOADING_MS);
});

const serverStatus = computed(() => {
  if (fabPhase.value === 'loading') return 'loading';
  if (fabPhase.value === 'success') return 'success';
  if (!accounts.loaded) return 'loading';
  return 'ok';
});

// ✅ PNG-иконки
const navLeft = [
  { to: '/finance',   icon: '/img/icons/nav/finance.png',   label: 'Финансы' },
  { to: '/analytics', icon: '/img/icons/nav/analytics.png', label: 'Анализ' },
];

const navRight = [
  { to: '/deposits', icon: '/img/icons/nav/deposits.png', label: 'Вклады' },
  { to: '/profile',  icon: '/img/icons/nav/profile.png',  label: 'Профиль' },
];

const tabRefs = ref({});

function setTabRef(to, el) {
  if (el) tabRefs.value[to] = el;
}

const activeTabTo = computed(() => {
  const all = [...navLeft, ...navRight];
  for (const item of all) {
    if (route.path === item.to || route.path.startsWith(item.to + '/')) {
      return item.to;
    }
  }
  return null;
});

const indicatorStyle = ref({ opacity: 0, left: '0px', width: '0px' });

function updateIndicator() {
  const to = activeTabTo.value;
  if (!to) {
    indicatorStyle.value = { opacity: 0, left: '0px', width: '0px' };
    return;
  }
  const el = tabRefs.value[to];
  if (!el) return;
  indicatorStyle.value = {
    opacity: 1,
    left: el.offsetLeft + 'px',
    width: el.offsetWidth + 'px',
  };
}

watch(activeTabTo, () => nextTick(updateIndicator), { immediate: true });

onMounted(() => {
  nextTick(updateIndicator);
  window.addEventListener('resize', updateIndicator);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIndicator);
});

function isActive(item) {
  return route.path === item.to || route.path.startsWith(item.to + '/');
}

function go(item) {
  if (route.path === item.to) return;
  router.push(item.to);
}

function handleFabClick() {
  scanStore.open();
}
</script>

<template>
  <nav class="bottom-nav">
    <div class="bn-inner">
      <div class="bn-indicator" :style="indicatorStyle">
        <div class="bn-indicator-shine"></div>
      </div>

      <button
        v-for="item in navLeft"
        :key="item.to"
        :ref="(el) => setTabRef(item.to, el)"
        type="button"
        class="bn-item"
        :class="{ active: isActive(item) }"
        @click="go(item)"
      >
        <span class="bn-icon-wrap">
          <img
            :src="item.icon"
            class="bn-icon-img"
            :alt="item.label"
            loading="lazy"
            decoding="async"
          />
        </span>
        <span class="bn-label">{{ item.label }}</span>
      </button>

      <div class="bn-fab-wrapper">
        <button
          type="button"
          class="bn-fab"
          :class="'is-' + serverStatus"
          @click="handleFabClick"
          aria-label="Сканировать чек"
        >
          <span class="bn-fab-ring"></span>

          <!-- LOADING -->
          <svg v-if="serverStatus === 'loading'" class="bn-fab-spinner" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
          </svg>

          <!-- SUCCESS -->
          <svg v-else-if="serverStatus === 'success'" class="bn-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>

          <!-- READY — PNG-камера -->
          <img
            v-else-if="serverStatus === 'ok'"
            src="/img/icons/nav/camera.png"
            class="bn-fab-icon-img"
            alt="Сканировать"
            loading="lazy"
            decoding="async"
          />

          <!-- ERROR -->
          <svg v-else class="bn-fab-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2V9h2v5z"/>
          </svg>
        </button>
      </div>

      <button
        v-for="item in navRight"
        :key="item.to"
        :ref="(el) => setTabRef(item.to, el)"
        type="button"
        class="bn-item"
        :class="{ active: isActive(item) }"
        @click="go(item)"
      >
        <span class="bn-icon-wrap">
          <img
            :src="item.icon"
            class="bn-icon-img"
            :alt="item.label"
            loading="lazy"
            decoding="async"
          />
        </span>
        <span class="bn-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  z-index: 900;
  width: 100%;
  max-width: 500px;
  padding: 0 12px calc(12px + env(safe-area-inset-bottom, 0));
  background: transparent;
  pointer-events: none;
}

.bn-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr auto 1fr 1fr;
  align-items: end;
  width: 100%;
  padding: 10px 8px 6px;
  border-radius: 24px;

  background: var(--panel-solid);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);

  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border);

  pointer-events: auto;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

/* Неоновый индикатор */
.bn-indicator {
  position: absolute;
  top: 8px;
  bottom: 6px;
  border-radius: 18px;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;

  background: var(--grad-primary);
  background-size: 200% 200%;
  animation: indGradientShift 6s ease-in-out infinite;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 -1px 0 rgba(0, 0, 0, 0.2) inset,
    0 4px 12px -2px rgba(139, 92, 246, 0.55),
    0 8px 24px -6px rgba(168, 85, 247, 0.4);

  transition:
    left 0.45s cubic-bezier(.34,1.56,.64,1),
    width 0.45s cubic-bezier(.34,1.56,.64,1),
    opacity 0.25s ease;
}

.bn-indicator-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.1) 40%,
    transparent 60%,
    rgba(0, 0, 0, 0.15) 100%
  );
  pointer-events: none;
}

@keyframes indGradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.bn-item {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  padding: 0 4px 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 14px;
  min-width: 0;
  transition: color 0.25s, transform 0.2s cubic-bezier(.34,1.56,.64,1);

  /* ✅ контейнер иконки чуть выше — даёт выступ за блок */
  .bn-icon-wrap {
    display: inline-flex;
    align-items: flex-end;
    justify-content: center;
    height: 26px;
    margin-top: -14px;      /* иконка поднимается над блоком */
    margin-bottom: 1px;
    transition: transform 0.35s cubic-bezier(.34,1.56,.64,1);
    will-change: transform;
  }

  &:hover {
    color: var(--text);

    .bn-icon-wrap {
      transform: translateY(-3px);
    }
  }
  &:active { transform: scale(0.94); }

  &.active {
    color: #ffffff;

    .bn-icon-wrap {
      transform: translateY(-5px) scale(1.08);
    }

    .bn-icon-img {
      filter:
        drop-shadow(0 3px 8px rgba(0, 0, 0, 0.55))
        drop-shadow(0 0 12px rgba(255, 255, 255, 0.7))
        brightness(1.18) saturate(1.25);
    }

    .bn-label {
      font-weight: 800;
      color: #ffffff;
      text-shadow:
        0 1px 3px rgba(0, 0, 0, 0.4),
        0 0 12px rgba(255, 255, 255, 0.3);
    }
  }
}

/* ✅ PNG-иконки — крупнее */
.bn-icon-img {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.22));
  transition: filter 0.25s ease;
}

.bn-label {
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  transition: color 0.25s, text-shadow 0.25s;
}

/* FAB */
.bn-fab-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 0 6px 4px;
  position: relative;
  z-index: 2;
}

.bn-fab {
  position: relative;
  /* ✅ FAB больше */
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 5px solid var(--panel-solid);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  /* ✅ сильнее «заходим» за круг */
  margin-top: -40px;

  transition:
    background 0.35s ease,
    box-shadow 0.35s ease,
    transform 0.2s cubic-bezier(.34,1.56,.64,1),
    border-color 0.3s ease;
  z-index: 3;
  overflow: visible;

  &:active { transform: scale(0.94); }
}

.bn-fab-ring {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  pointer-events: none;
  z-index: -1;
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.bn-fab:hover .bn-fab-ring { opacity: 1; }

.bn-fab.is-loading {
  background: linear-gradient(180deg, #60a5fa, #3b82f6);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(59, 130, 246, 0.35),
    0 10px 24px -4px rgba(59, 130, 246, 0.55),
    0 20px 40px -10px rgba(59, 130, 246, 0.35);
  cursor: wait;

  .bn-fab-ring {
    background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
    animation: ringPulseBlue 1.6s ease-in-out infinite;
  }
}

.bn-fab.is-success {
  background: linear-gradient(180deg, #4ade80, #22c55e);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(34, 197, 94, 0.35),
    0 10px 24px -4px rgba(34, 197, 94, 0.55),
    0 20px 40px -10px rgba(34, 197, 94, 0.35);
  animation: fabSuccessPop 0.35s cubic-bezier(.34,1.56,.64,1);

  .bn-fab-ring {
    background: radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, transparent 70%);
    animation: ringPulseGreen 1.4s ease-in-out infinite;
  }
}

.bn-fab.is-ok {
  background: var(--grad-primary);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(0, 0, 0, 0.25) inset,
    0 6px 12px rgba(139, 92, 246, 0.45),
    0 12px 28px -4px rgba(168, 85, 247, 0.6),
    0 24px 48px -10px rgba(139, 92, 246, 0.4);

  .bn-fab-ring {
    background: radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, transparent 70%);
    animation: ringPulsePurple 2s ease-in-out infinite;
  }

  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.5) inset,
      0 -2px 0 rgba(0, 0, 0, 0.25) inset,
      0 8px 18px rgba(139, 92, 246, 0.55),
      0 18px 40px -4px rgba(168, 85, 247, 0.75),
      0 32px 64px -10px rgba(139, 92, 246, 0.5);

    .bn-fab-icon-img {
      transform: scale(1.1) rotate(-4deg);
    }
  }
}

.bn-fab.is-error {
  background: linear-gradient(180deg, #f87171, #dc2626);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(239, 68, 68, 0.35),
    0 10px 24px -4px rgba(239, 68, 68, 0.55),
    0 20px 40px -10px rgba(239, 68, 68, 0.35);

  .bn-fab-ring {
    background: radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, transparent 70%);
  }
}

@keyframes ringPulseBlue {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.2); opacity: 0.9; }
}
@keyframes ringPulseGreen {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50%      { transform: scale(1.25); opacity: 1; }
}
@keyframes ringPulsePurple {
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50%      { transform: scale(1.18); opacity: 1; }
}
@keyframes fabSuccessPop {
  0%   { transform: scale(0.85); }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.bn-fab-spinner {
  width: 32px; height: 32px;
  animation: spinFab 1s linear infinite;
  color: #fff;

  circle {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: 0;
    animation: dashFab 1.5s ease-in-out infinite;
  }
}
@keyframes spinFab { to { transform: rotate(360deg); } }
@keyframes dashFab {
  0%   { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50%  { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}

.bn-fab-icon {
  width: 32px; height: 32px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}

.bn-fab.is-success .bn-fab-icon {
  width: 38px;
  height: 38px;
  animation: checkDraw 0.4s ease-out;
}
@keyframes checkDraw {
  from { stroke-dasharray: 30; stroke-dashoffset: 30; }
  to   { stroke-dasharray: 30; stroke-dashoffset: 0; }
}

/* ✅ PNG-камера внутри FAB — крупнее */
.bn-fab-icon-img {
  display: block;
  width: 46px;
  height: 46px;
  object-fit: contain;
  flex-shrink: 0;
  filter:
    drop-shadow(0 3px 8px rgba(0, 0, 0, 0.45))
    brightness(1.12) saturate(1.15);
  transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);
  will-change: transform;
}

/* Тёмная тема — доп. неон */
:global(:root[data-app-theme="dark"]) {
  .bn-indicator {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.25) inset,
      0 -1px 0 rgba(0, 0, 0, 0.3) inset,
      0 4px 14px -2px rgba(168, 85, 247, 0.7),
      0 8px 28px -6px rgba(168, 85, 247, 0.5),
      0 0 0 1px rgba(168, 85, 247, 0.4);
  }

  .bn-inner {
    background: rgba(20, 9, 31, 0.85);
    border-color: rgba(139, 92, 246, 0.18);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.05) inset,
      0 2px 4px rgba(0, 0, 0, 0.4),
      0 16px 32px -6px rgba(0, 0, 0, 0.5),
      0 30px 60px -15px rgba(139, 92, 246, 0.25);
  }

  .bn-fab.is-ok {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.35) inset,
      0 -2px 0 rgba(0, 0, 0, 0.3) inset,
      0 6px 14px rgba(139, 92, 246, 0.55),
      0 12px 32px -4px rgba(168, 85, 247, 0.75),
      0 24px 56px -10px rgba(139, 92, 246, 0.5),
      0 0 0 1px rgba(168, 85, 247, 0.4);
  }
}

/* Desktop */
@media (min-width: 701px) {
  .bottom-nav { max-width: 640px; padding: 0 24px 24px; }

  .bn-inner { padding: 12px 12px 8px; border-radius: 28px; }

  .bn-item {
    padding: 0 6px 8px;
    font-size: 12px;
    gap: 3px;

    .bn-icon-wrap {
      height: 30px;
      margin-top: -18px;
    }

    .bn-icon-img { width: 46px; height: 46px; }
    .bn-label { font-size: 12px; }
  }

  .bn-fab-wrapper { padding: 0 12px 6px; }
  .bn-fab { width: 88px; height: 88px; border-width: 6px; margin-top: -48px; }
  .bn-fab-icon { width: 38px; height: 38px; }
  .bn-fab-icon-img { width: 54px; height: 54px; }
  .bn-fab-spinner { width: 38px; height: 38px; }
  .bn-fab.is-success .bn-fab-icon { width: 44px; height: 44px; }
  .bn-fab-ring { inset: -12px; }

  .bn-indicator { border-radius: 20px; top: 10px; bottom: 8px; }
}

@media (max-width: 700px) {
  .bottom-nav { max-width: 100%; padding: 0 8px calc(8px + env(safe-area-inset-bottom, 0)); }

  .bn-inner { padding: 8px 6px 4px; border-radius: 22px; }

  .bn-item {
    padding: 0 3px 4px;

    .bn-icon-wrap {
      height: 24px;
      margin-top: -12px;
    }
  }

  .bn-icon-img { width: 36px; height: 36px; }
  .bn-label { font-size: 10px; }

  .bn-fab { width: 70px; height: 70px; margin-top: -36px; border-width: 4px; }
  .bn-fab-icon { width: 30px; height: 30px; }
  .bn-fab-icon-img { width: 42px; height: 42px; }
  .bn-fab-spinner { width: 30px; height: 30px; }
  .bn-fab.is-success .bn-fab-icon { width: 34px; height: 34px; }
  .bn-fab-ring { inset: -8px; }

  .bn-indicator { border-radius: 16px; top: 6px; bottom: 4px; }
}

@media (prefers-reduced-motion: reduce) {
  .bn-indicator,
  .bn-fab,
  .bn-fab-ring,
  .bn-item,
  .bn-icon-wrap,
  .bn-icon-img,
  .bn-fab-icon-img { animation: none !important; transition: none !important; }
}
</style>