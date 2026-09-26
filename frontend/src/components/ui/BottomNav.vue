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
    setTimeout(() => {
      fabPhase.value = 'ready';
    }, SUCCESS_MS);
  }, LOADING_MS);
});

// ✅ Красный — только если данные не загрузились.
// Отсутствие WebSocket больше не считается ошибкой.
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

function go(item) {
  if (route.path !== item.to) router.push(item.to);
}

function handleFabClick() {
  scanStore.open();
}
</script>

<template>
  <nav class="bottom-nav">
    <div class="bn-inner">
      <div class="bn-indicator" :style="indicatorStyle"></div>

      <button
        v-for="item in navLeft"
        :key="item.to"
        :ref="(el) => setTabRef(item.to, el)"
        type="button"
        class="bn-item"
        :class="{ active: isActive(item) }"
        @click="go(item)"
      >
        <span class="bn-icon">{{ item.icon }}</span>
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
        <span class="bn-icon">{{ item.icon }}</span>
        <span class="bn-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 900;
  max-width: 500px;
  margin: 0 auto;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0));
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 24px 24px 0 0;
  box-shadow:
    0 -8px 30px -10px rgba(15, 23, 42, 0.12),
    0 -2px 8px -4px rgba(15, 23, 42, 0.06);
}

.bn-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr auto 1fr 1fr;
  align-items: end;
  width: 100%;
}

.bn-indicator {
  position: absolute;
  top: 0;
  bottom: 4px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(139, 92, 246, 0.1));
  pointer-events: none;
  transition:
    left 0.4s cubic-bezier(.34,1.56,.64,1),
    width 0.4s cubic-bezier(.34,1.56,.64,1),
    opacity 0.25s ease;
  z-index: 1;
}

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
  transition: color 0.25s, transform 0.18s;
  border-radius: 12px;
  min-width: 0;

  &:hover { color: #64748b; }
  &:active { transform: scale(0.94); }

  &.active {
    color: #4f46e5;

    .bn-icon {
      transform: translateY(-2px) scale(1.1);
      filter: drop-shadow(0 2px 6px rgba(99, 102, 241, 0.4));
    }

    .bn-label {
      font-weight: 800;
      color: #4f46e5;
    }
  }
}

.bn-icon {
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
  transition: color 0.25s;
}

.bn-fab-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 0 6px 4px;
  position: relative;
  z-index: 2;
}

.bn-fab {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  margin-top: -32px;
  transition:
    background 0.35s ease,
    box-shadow 0.35s ease,
    transform 0.18s ease;
  position: relative;
  z-index: 2;

  &:active { transform: scale(0.94); }

  &.is-loading {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    box-shadow:
      0 10px 28px -8px rgba(59, 130, 246, 0.75),
      0 0 0 5px rgba(255, 255, 255, 0.75);
    cursor: wait;
  }

  &.is-success {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    box-shadow:
      0 10px 28px -8px rgba(34, 197, 94, 0.8),
      0 0 0 5px rgba(255, 255, 255, 0.75);
    animation: fabSuccessPop 0.35s cubic-bezier(.34,1.56,.64,1);
  }

  &.is-ok {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    box-shadow:
      0 10px 28px -8px rgba(59, 130, 246, 0.75),
      0 0 0 5px rgba(255, 255, 255, 0.75);
  }

  &.is-error {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow:
      0 10px 28px -8px rgba(239, 68, 68, 0.75),
      0 0 0 5px rgba(255, 255, 255, 0.75);
  }
}

@keyframes fabSuccessPop {
  0%   { transform: scale(0.85); }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.bn-fab-spinner {
  width: 30px;
  height: 30px;
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
  width: 30px;
  height: 30px;
}

.bn-fab.is-success .bn-fab-icon {
  width: 34px;
  height: 34px;
  animation: checkDraw 0.4s ease-out;
}

@keyframes checkDraw {
  from { stroke-dasharray: 30; stroke-dashoffset: 30; }
  to   { stroke-dasharray: 30; stroke-dashoffset: 0; }
}

@media (max-width: 700px) {
  .bottom-nav {
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0));
    border-radius: 20px 20px 0 0;
  }
  .bn-icon { font-size: 20px; }
  .bn-label { font-size: 10px; }

  .bn-fab {
    width: 62px;
    height: 62px;
    margin-top: -28px;
  }
  .bn-fab-icon { width: 28px; height: 28px; }
  .bn-fab-spinner { width: 28px; height: 28px; }
  .bn-fab.is-success .bn-fab-icon { width: 32px; height: 32px; }
}
</style>