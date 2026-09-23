<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { onDataStatus } from '@/composables/useDataStatus';

const props = defineProps({
  title: { type: String, required: true },
});

const route = useRoute();

const hidden = ref(false);
const statusText = ref('Подключение к серверу…');
const statusType = ref('');

const API_HOST = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let hideTimer = null;
let fallbackTimer = null;
let scrollRaf = null;
let unsubscribe = null;

function startHideTimer() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hidden.value = true;
  }, 5000);
}

onMounted(() => {
  startHideTimer();
  window.scrollTo({ top: 0, behavior: 'instant' });

  unsubscribe = onDataStatus((detail) => {
    handleStatusUpdate(detail);
  });

  fallbackTimer = setTimeout(() => {
    if (statusType.value === '') {
      statusType.value = 'dirty';
      statusText.value = 'Нет ответа от сервера';
    }
  }, 3000);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('online', onOnlineChange);
  window.addEventListener('offline', onOnlineChange);
});

onUnmounted(() => {
  clearTimeout(hideTimer);
  clearTimeout(fallbackTimer);
  if (unsubscribe) unsubscribe();
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('online', onOnlineChange);
  window.removeEventListener('offline', onOnlineChange);
});

// ✅ При смене маршрута — снова показать hero + перезапустить таймер
watch(() => route.path, () => {
  hidden.value = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
  startHideTimer();
});

function handleStatusUpdate(detail) {
  clearTimeout(fallbackTimer);

  const type = detail?.type || 'saved';
  statusType.value = type;

  if (type === 'error') {
    statusText.value = 'Ошибка: ' + (detail?.message || 'сервер недоступен');
  } else if (type === 'dirty') {
    statusText.value = 'Есть несохранённые изменения…';
  } else {
    statusText.value = `Сервер: ${API_HOST}  ·  ${detail?.message || 'готово'}`;
  }

  if (type === 'saved') {
    setTimeout(() => {
      if (statusType.value === 'saved') {
        statusType.value = '';
      }
    }, 5000);
  }
}

function onScroll() {
  if (hidden.value || scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null;
    if (window.scrollY > 40) hidden.value = true;
  });
}

function onOnlineChange() {
  if (!navigator.onLine) {
    statusType.value = 'error';
    statusText.value = 'Офлайн';
  } else {
    statusType.value = 'saved';
    statusText.value = 'Соединение восстановлено';
  }
}
</script>

<template>
  <div class="hero-block" :class="{ hidden }">
    <h1>{{ title }}</h1>

    <div class="file-status" :class="statusType">
      <span class="dot"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hero-block {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  max-height: 200px;
  margin: 0 0 22px;
  padding-top: 4px;
  opacity: 1;
  transition:
    max-height 0.5s cubic-bezier(.22,.61,.36,1),
    margin 0.5s cubic-bezier(.22,.61,.36,1),
    opacity 0.35s ease,
    padding 0.5s;

  &.hidden {
    max-height: 0;
    margin-bottom: 0;
    padding-top: 0;
    opacity: 0;
    pointer-events: none;
  }
}

h1 {
  font-size: clamp(18px, 2vw + 12px, 26px);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  text-align: center;
  background: linear-gradient(120deg, #0f172a 0%, #0369a1 50%, #0284c7 100%);
  background-size: 220% 220%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1.2;
  white-space: nowrap;
  animation: h1Shift 10s ease-in-out infinite;
}

@keyframes h1Shift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

.file-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 999px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow-sm);
  max-width: calc(100vw - 40px);
  transition: color 0.2s, border-color 0.2s;

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    flex-shrink: 0;
    transition: all 0.2s;
  }

  &.saved {
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.35);
    .dot {
      background: #16a34a;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
    }
  }

  &.dirty {
    color: #d97706;
    border-color: rgba(245, 158, 11, 0.35);
    .dot {
      background: #d97706;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
      animation: pulse 1.6s ease-in-out infinite;
    }
  }

  &.error {
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.4);
    .dot {
      background: #dc2626;
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(1.15); }
}

@media (max-width: 700px) {
  .hero-block {
    margin: 0 0 14px;
    padding-top: 2px;
    gap: 8px;
  }

  h1 {
    font-size: 18px;
    white-space: normal;
    padding: 0 12px;
  }

  .file-status {
    font-size: 11px;
    padding: 5px 12px;
    gap: 6px;
  }

  .file-status .dot {
    width: 7px;
    height: 7px;
  }
}
</style>