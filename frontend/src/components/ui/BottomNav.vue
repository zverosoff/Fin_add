<script setup>
import { computed, ref, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWebSocket } from '@/composables/useWebSocket';
import { useAccountsStore } from '@/stores/accounts';
import { useScanStore } from '@/stores/scan';
import { useMessagesStore } from '@/stores/messages';

const route = useRoute();
const router = useRouter();
const { connected } = useWebSocket();
const accounts = useAccountsStore();
const scanStore = useScanStore();
const messagesStore = useMessagesStore();

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

const navLeft = [
  { to: '/finance',   icon: '💳', label: 'Финансы' },
  { to: '/analytics', icon: '📊', label: 'Анализ' },
];

const navRight = [
  { to: '/deposits', icon: '💎', label: 'Вклады' },
  { to: '/profile',  icon: '👤', label: 'Профиль' },
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

const tabHasDot = computed(() => ({
  '/finance': false,
  '/analytics': false,
  '/deposits': false,
  '/profile': messagesStore.totalUnread > 0,
}));

function hasDot(item) {
  return !!tabHasDot.value[item.to];
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
      <!-- ✅ Индикатор с многоуровневой тенью -->
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
        <span class="bn-icon">
          {{ item.icon }}
          <Transition name="dot-pop">
            <span v-if="hasDot(item)" class="bn-dot" aria-hidden="true"></span>
          </Transition>
        </span>
        <span class="bn-label">{{ item.label }}</span>
      </button>

      <!-- ✅ FAB с объёмом -->
      <div class="bn-fab-wrapper">
        <button
          type="button"
          class="bn-fab"
          :class="'is-' + serverStatus"
          @click="handleFabClick"
          aria-label="Сканировать чек"
        >
          <span class="bn-fab-ring"></span>

          <svg v-if="serverStatus === 'loading'" class="bn-fab-spinner" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
          </svg>
          <svg v-else-if="serverStatus === 'success'" class="bn-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else-if="serverStatus === 'ok'" class="bn-fab-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 3 7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
          </svg>
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
        <span class="bn-icon">
          {{ item.icon }}
          <Transition name="dot-pop">
            <span v-if="hasDot(item)" class="bn-dot" aria-hidden="true"></span>
          </Transition>
        </span>
        <span class="bn-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
/* ============================================================
   ОБЩИЙ КОНТЕЙНЕР
   ============================================================ */
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

/* ============================================================
   INNER — стеклянный эффект + 4-уровневая тень + глянец
   ============================================================ */
.bn-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr auto 1fr 1fr;
  align-items: end;
  width: 100%;
  padding: 8px 8px 6px;
  border-radius: 24px;

  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98) 0%,
      rgba(255, 255, 255, 0.94) 100%
    );

  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);

  /* ✅ 5-уровневая тень для настоящей глубины */
  box-shadow:
    /* верхняя внутренняя подсветка (глянец) */
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    /* нижняя внутренняя тень */
    0 -1px 0 rgba(148, 163, 184, 0.1) inset,
    /* тонкая ближняя */
    0 2px 4px rgba(15, 23, 42, 0.06),
    /* средняя */
    0 8px 20px -4px rgba(15, 23, 42, 0.12),
    /* широкая фиолетовая (объём) */
    0 24px 48px -12px rgba(99, 102, 241, 0.25),
    /* глубокая чёрная (парящий эффект) */
    0 40px 80px -20px rgba(15, 23, 42, 0.18);

  border: 1px solid rgba(255, 255, 255, 0.9);
  pointer-events: auto;

  transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), box-shadow 0.35s ease;
}

/* ============================================================
   ИНДИКАТОР активной вкладки — с многослойным свечением
   ============================================================ */
.bn-indicator {
  position: absolute;
  top: 6px;
  bottom: 6px;
  border-radius: 18px;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;

  background: linear-gradient(
    120deg,
    #3b82f6 0%,
    #6366f1 40%,
    #8b5cf6 70%,
    #3b82f6 100%
  );
  background-size: 300% 300%;
  animation: indGradientShift 6s ease-in-out infinite;

  /* ✅ Многослойная тень + внутренний глянец */
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 -1px 0 rgba(0, 0, 0, 0.15) inset,
    0 2px 4px rgba(59, 130, 246, 0.4),
    0 6px 14px -2px rgba(99, 102, 241, 0.55),
    0 12px 28px -6px rgba(139, 92, 246, 0.4);

  transition:
    left 0.45s cubic-bezier(.34,1.56,.64,1),
    width 0.45s cubic-bezier(.34,1.56,.64,1),
    opacity 0.25s ease;
}

/* ✅ Световая полоса поверх индикатора */
.bn-indicator-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.1) 40%,
    transparent 60%,
    rgba(0, 0, 0, 0.1) 100%
  );
  pointer-events: none;
}

@keyframes indGradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* ============================================================
   ПУНКТЫ МЕНЮ
   ============================================================ */
.bn-item {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 8px 4px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 14px;
  min-width: 0;
  transition: color 0.25s, transform 0.2s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    color: #64748b;
    transform: translateY(-1px);
  }
  &:active { transform: scale(0.94); }

  &.active {
    color: #ffffff;

    .bn-icon {
      transform: translateY(-2px) scale(1.12);
      filter:
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))
        drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }

    .bn-label {
      font-weight: 800;
      color: #ffffff;
      text-shadow:
        0 1px 3px rgba(0, 0, 0, 0.4),
        0 2px 6px rgba(0, 0, 0, 0.2);
    }
  }
}

.bn-icon {
  position: relative;
  display: inline-flex;
  font-size: 22px;
  line-height: 1;
  transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), filter 0.25s;
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

/* ============================================================
   ТОЧКА непрочитанных — с объёмом и пульсацией
   ============================================================ */
.bn-dot {
  position: absolute;
  top: -4px;
  right: -6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;

  background: linear-gradient(180deg, #f87171, #dc2626);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 0 0 0 rgba(239, 68, 68, 0.6),
    0 0 0 2px rgba(255, 255, 255, 0.95),
    0 2px 6px rgba(239, 68, 68, 0.5);

  animation: navDotPulse 1.6s ease-in-out infinite;
}

@keyframes navDotPulse {
  0% {
    transform: scale(1);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 0 0 0 rgba(239, 68, 68, 0.7),
      0 0 0 2px rgba(255, 255, 255, 0.9),
      0 2px 6px rgba(239, 68, 68, 0.5);
  }
  70% {
    transform: scale(1.15);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 0 0 8px rgba(239, 68, 68, 0),
      0 0 0 2px rgba(255, 255, 255, 0.9),
      0 2px 6px rgba(239, 68, 68, 0.5);
  }
  100% {
    transform: scale(1);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 0 0 0 rgba(239, 68, 68, 0),
      0 0 0 2px rgba(255, 255, 255, 0.9),
      0 2px 6px rgba(239, 68, 68, 0.5);
  }
}

.dot-pop-enter-active {
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(.34,1.56,.64,1);
}
.dot-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dot-pop-enter-from {
  opacity: 0;
  transform: scale(0.3);
}
.dot-pop-leave-to {
  opacity: 0;
  transform: scale(0.3);
}

/* ============================================================
   FAB — объёмная круглая кнопка
   ============================================================ */
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
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  margin-top: -30px;

  transition:
    background 0.35s ease,
    box-shadow 0.35s ease,
    transform 0.2s cubic-bezier(.34,1.56,.64,1);
  z-index: 2;
  overflow: visible;

  &:active { transform: scale(0.94); }
}

/* ✅ Световое кольцо вокруг FAB */
.bn-fab-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  pointer-events: none;
  z-index: -1;
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.bn-fab:hover .bn-fab-ring { opacity: 1; }

/* Loading */
.bn-fab.is-loading {
  background: linear-gradient(180deg, #60a5fa, #3b82f6);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(59, 130, 246, 0.35),
    0 10px 24px -4px rgba(59, 130, 246, 0.55),
    0 20px 40px -10px rgba(59, 130, 246, 0.35),
    0 0 0 5px rgba(255, 255, 255, 0.75);

  cursor: wait;

  .bn-fab-ring {
    background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
    animation: ringPulseBlue 1.6s ease-in-out infinite;
  }
}

/* Success */
.bn-fab.is-success {
  background: linear-gradient(180deg, #4ade80, #22c55e);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(34, 197, 94, 0.35),
    0 10px 24px -4px rgba(34, 197, 94, 0.55),
    0 20px 40px -10px rgba(34, 197, 94, 0.35),
    0 0 0 5px rgba(255, 255, 255, 0.75);

  animation: fabSuccessPop 0.35s cubic-bezier(.34,1.56,.64,1);

  .bn-fab-ring {
    background: radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, transparent 70%);
    animation: ringPulseGreen 1.4s ease-in-out infinite;
  }
}

/* OK (готов) */
.bn-fab.is-ok {
  background: linear-gradient(180deg, #6366f1, #8b5cf6);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 -2px 0 rgba(0, 0, 0, 0.2) inset,
    0 4px 8px rgba(99, 102, 241, 0.35),
    0 10px 24px -4px rgba(99, 102, 241, 0.55),
    0 20px 40px -10px rgba(139, 92, 246, 0.35),
    0 0 0 5px rgba(255, 255, 255, 0.75);

  .bn-fab-ring {
    background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%);
    animation: ringPulsePurple 2s ease-in-out infinite;
  }

  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 -2px 0 rgba(0, 0, 0, 0.2) inset,
      0 6px 12px rgba(99, 102, 241, 0.4),
      0 14px 32px -4px rgba(99, 102, 241, 0.65),
      0 28px 52px -10px rgba(139, 92, 246, 0.45),
      0 0 0 6px rgba(255, 255, 255, 0.85);
  }
}

/* Error */
.bn-fab.is-error {
  background: linear-gradient(180deg, #f87171, #dc2626);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(239, 68, 68, 0.35),
    0 10px 24px -4px rgba(239, 68, 68, 0.55),
    0 20px 40px -10px rgba(239, 68, 68, 0.35),
    0 0 0 5px rgba(255, 255, 255, 0.75);

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
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50%      { transform: scale(1.15); opacity: 0.85; }
}

@keyframes fabSuccessPop {
  0%   { transform: scale(0.85); }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Спиннер */
.bn-fab-spinner {
  width: 28px; height: 28px;
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
  width: 28px; height: 28px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.bn-fab.is-success .bn-fab-icon {
  width: 32px;
  height: 32px;
  animation: checkDraw 0.4s ease-out;
}
@keyframes checkDraw {
  from { stroke-dasharray: 30; stroke-dashoffset: 30; }
  to   { stroke-dasharray: 30; stroke-dashoffset: 0; }
}

/* ============================================================
   DESKTOP
   ============================================================ */
@media (min-width: 701px) {
  .bottom-nav {
    max-width: 640px;
    padding: 0 24px 24px;
  }

  .bn-inner {
    padding: 10px 12px 8px;
    border-radius: 28px;

    /* ✅ Усиленные тени для десктопа */
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.1) inset,
      0 2px 6px rgba(15, 23, 42, 0.06),
      0 12px 28px -6px rgba(15, 23, 42, 0.15),
      0 30px 60px -15px rgba(99, 102, 241, 0.3),
      0 50px 100px -25px rgba(15, 23, 42, 0.2);
  }

  .bn-item {
    padding: 10px 6px;
    font-size: 12px;
    gap: 4px;
    .bn-icon { font-size: 26px; }
    .bn-label { font-size: 12px; }
  }

  .bn-fab-wrapper { padding: 0 12px 6px; }

  .bn-fab {
    width: 76px;
    height: 76px;
    border-width: 5px;
    margin-top: -38px;
  }

  .bn-fab-icon { width: 34px; height: 34px; }
  .bn-fab-spinner { width: 34px; height: 34px; }
  .bn-fab.is-success .bn-fab-icon { width: 38px; height: 38px; }

  .bn-indicator { border-radius: 20px; top: 8px; bottom: 8px; }
}

/* ============================================================
   MOBILE
   ============================================================ */
@media (max-width: 700px) {
  .bottom-nav {
    max-width: 100%;
    padding: 0 8px calc(8px + env(safe-area-inset-bottom, 0));
  }

  .bn-inner {
    padding: 6px 6px 4px;
    border-radius: 22px;

    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 -1px 0 rgba(148, 163, 184, 0.08) inset,
      0 2px 4px rgba(15, 23, 42, 0.06),
      0 10px 24px -6px rgba(15, 23, 42, 0.15),
      0 20px 44px -14px rgba(99, 102, 241, 0.28),
      0 30px 60px -20px rgba(15, 23, 42, 0.15);
  }

  .bn-icon { font-size: 20px; }
  .bn-label { font-size: 10px; }

  .bn-fab {
    width: 60px;
    height: 60px;
    margin-top: -26px;
  }

  .bn-fab-icon { width: 26px; height: 26px; }
  .bn-fab-spinner { width: 26px; height: 26px; }
  .bn-fab.is-success .bn-fab-icon { width: 30px; height: 30px; }

  .bn-indicator { border-radius: 16px; top: 4px; bottom: 4px; }

  .bn-dot { width: 9px; height: 9px; top: -3px; right: -5px; }
}

/* ============================================================
   REDUCED MOTION
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .bn-indicator,
  .bn-fab,
  .bn-dot,
  .bn-fab-ring,
  .bn-item,
  .bn-icon { animation: none !important; transition: none !important; }
}
</style>