<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWebSocket } from '@/composables/useWebSocket';
import { useAccountsStore } from '@/stores/accounts';
import { useScanStore } from '@/stores/scan';

const route = useRoute();
const router = useRouter();
const { connected } = useWebSocket();
const accounts = useAccountsStore();
const scanStore = useScanStore();

const fabBooting = ref(true);
onMounted(() => {
  setTimeout(() => {
    fabBooting.value = false;
  }, 2500);
});

const serverStatus = computed(() => {
  if (fabBooting.value) return 'loading';
  if (!accounts.loaded) return 'loading';
  if (!connected.value) return 'error';
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

const allTabs = [...navLeft, ...navRight];

const activeIndex = computed(() => {
  for (let i = 0; i < allTabs.length; i++) {
    const to = allTabs[i].to;
    if (route.path === to || route.path.startsWith(to + '/')) {
      return i;
    }
  }
  return -1;
});

// ✅ Индикатор: 5 колонок, но индикатор по сетке (внутри padding)
const indicatorStyle = computed(() => {
  const idx = activeIndex.value;
  if (idx < 0) return { opacity: 0 };

  const colIndex = idx < 2 ? idx : idx + 1;
  const columns = 5;
  const widthPercent = 100 / columns;
  const leftPercent = colIndex * widthPercent;

  return {
    opacity: 1,
    left: leftPercent + '%',
    width: widthPercent + '%',
  };
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
      <!-- Индикатор -->
      <div
        class="bn-indicator"
        :style="indicatorStyle"
      ></div>

      <!-- Финансы, Анализ -->
      <button
        v-for="item in navLeft"
        :key="item.to"
        type="button"
        class="bn-item"
        :class="{ active: isActive(item) }"
        @click="go(item)"
      >
        <span class="bn-icon">{{ item.icon }}</span>
        <span class="bn-label">{{ item.label }}</span>
      </button>

      <!-- FAB -->
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

          <svg v-else-if="serverStatus === 'ok'" class="bn-fab-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 3 7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
          </svg>

          <svg v-else class="bn-fab-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2V9h2v5z"/>
          </svg>
        </button>
      </div>

      <!-- Вклады, Профиль -->
      <button
        v-for="item in navRight"
        :key="item.to"
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

/* ✅ Внутренний контейнер без padding — сетка внутри */
.bn-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr auto 1fr 1fr;
  align-items: end;
  width: 100%;
}

/* ✅ Индикатор — теперь точно под табами */
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
  margin: 0 2px;
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
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  margin-top: -26px;
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
      0 8px 24px -8px rgba(59, 130, 246, 0.7),
      0 0 0 4px rgba(255, 255, 255, 0.7);
    cursor: wait;
  }

  &.is-ok {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    box-shadow:
      0 8px 24px -8px rgba(59, 130, 246, 0.7),
      0 0 0 4px rgba(255, 255, 255, 0.7);
  }

  &.is-error {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow:
      0 8px 24px -8px rgba(239, 68, 68, 0.7),
      0 0 0 4px rgba(255, 255, 255, 0.7);
  }
}

.bn-fab-spinner {
  width: 26px;
  height: 26px;
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
  width: 26px;
  height: 26px;
}

@media (max-width: 700px) {
  .bottom-nav {
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0));
    border-radius: 20px 20px 0 0;
  }
  .bn-icon { font-size: 20px; }
  .bn-label { font-size: 10px; }
  .bn-fab {
    width: 54px;
    height: 54px;
    margin-top: -24px;
  }
  .bn-fab-icon { width: 24px; height: 24px; }
  .bn-fab-spinner { width: 24px; height: 24px; }
}
</style>