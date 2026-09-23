<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWebSocket } from '@/composables/useWebSocket';
import { useAccountsStore } from '@/stores/accounts';

const route = useRoute();
const router = useRouter();
const { connected } = useWebSocket();
const accounts = useAccountsStore();

const emit = defineEmits(['open-scan']);

// Статус сервера
// 'loading' — идёт загрузка
// 'ok' — всё хорошо
// 'error' — нет соединения
const serverStatus = computed(() => {
  if (!accounts.loaded) return 'loading';
  if (!connected.value) return 'error';
  return 'ok';
});

// ✅ Левая часть — Финансы
const navLeft = [
  { to: '/finance', icon: '💳', label: 'Финансы' },
];

// ✅ Правая часть — Анализ, Вклады, Профиль
const navRight = [
  { to: '/analytics', icon: '📊', label: 'Анализ' },
  { to: '/deposits',  icon: '💎', label: 'Вклады' },
  { to: '/profile',   icon: '👤', label: 'Профиль' },
];

function isActive(item) {
  return route.path === item.to || route.path.startsWith(item.to + '/');
}

function go(item) {
  if (route.path !== item.to) router.push(item.to);
}

function handleFabClick() {
  if (serverStatus.value === 'error') return;
  emit('open-scan');
}
</script>

<template>
  <nav class="bottom-nav">
    <!-- Финансы -->
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

    <!-- FAB по центру -->
    <div class="bn-fab-wrapper">
      <button
        type="button"
        class="bn-fab"
        :class="'is-' + serverStatus"
        :disabled="serverStatus === 'error'"
        @click="handleFabClick"
        aria-label="Сканировать чек"
      >
        <!-- Loading -->
        <svg v-if="serverStatus === 'loading'" class="bn-fab-spinner" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        </svg>

        <!-- OK -->
        <svg v-else-if="serverStatus === 'ok'" class="bn-fab-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 3 7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
        </svg>

        <!-- Error -->
        <svg v-else class="bn-fab-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2 1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2V9h2v5z"/>
        </svg>
      </button>
    </div>

    <!-- Анализ, Вклады, Профиль -->
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
  </nav>
</template>

<style scoped lang="scss">
/* ============================================================
   КОНТЕЙНЕР
   ============================================================ */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 900;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: end;
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

/* ============================================================
   ОБЫЧНЫЕ ТАБЫ
   ============================================================ */
.bn-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 4px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.18s, transform 0.18s;
  border-radius: 12px;
  min-width: 0;

  &:hover { color: #64748b; }

  &:active { transform: scale(0.94); }

  &.active {
    color: #4f46e5;

    .bn-icon {
      transform: translateY(-2px) scale(1.1);
    }
  }
}

.bn-icon {
  font-size: 22px;
  line-height: 1;
  transition: transform 0.22s cubic-bezier(.34,1.56,.64,1);
}

.bn-label {
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ============================================================
   ЦЕНТРАЛЬНАЯ FAB
   ============================================================ */
.bn-fab-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: 4px;
  position: relative;
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

  &:active:not(:disabled) { transform: scale(0.94); }

  /* Loading */
  &.is-loading {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    box-shadow:
      0 8px 24px -8px rgba(59, 130, 246, 0.7),
      0 0 0 4px rgba(255, 255, 255, 0.7);
    cursor: wait;
  }

  /* OK */
  &.is-ok {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    box-shadow:
      0 8px 24px -8px rgba(59, 130, 246, 0.7),
      0 0 0 4px rgba(255, 255, 255, 0.7);
  }

  /* Error */
  &.is-error {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow:
      0 8px 24px -8px rgba(239, 68, 68, 0.7),
      0 0 0 4px rgba(255, 255, 255, 0.7);
    cursor: not-allowed;
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

@keyframes spinFab {
  to { transform: rotate(360deg); }
}

@keyframes dashFab {
  0%   { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50%  { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}

.bn-fab-icon {
  width: 26px;
  height: 26px;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
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