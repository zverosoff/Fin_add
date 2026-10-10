// frontend/src/composables/useAppTheme.js
import { ref, computed } from 'vue';

const STORAGE_KEY = 'finance-app-theme-v1';

export const appTheme = ref(
  localStorage.getItem(STORAGE_KEY) || 'auto'
);

const systemDark = ref(
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
);

if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', (e) => {
    systemDark.value = e.matches;
    if (appTheme.value === 'auto') applyTheme();
  });
}

export const resolvedTheme = computed(() => {
  if (appTheme.value === 'auto') return systemDark.value ? 'dark' : 'light';
  return appTheme.value;
});

export const isDark = computed(() => resolvedTheme.value === 'dark');

export function applyTheme() {
  const resolved = resolvedTheme.value;

  document.documentElement.setAttribute('data-app-theme', resolved);
  document.documentElement.style.colorScheme = resolved;

  // ✅ Убираем inline-фон, если он был установлен ранее
  document.documentElement.style.removeProperty('background');
  document.body.style.removeProperty('background');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      'content',
      resolved === 'dark' ? '#0a0612' : '#eef2f8'
    );
  }
}

export function setAppTheme(value) {
  if (!['light', 'dark', 'auto'].includes(value)) return;
  appTheme.value = value;
  localStorage.setItem(STORAGE_KEY, value);
  applyTheme();
}

// ✅ Инициализация при загрузке модуля
if (typeof window !== 'undefined') {
  applyTheme();
}

export function useAppTheme() {
  return {
    theme: appTheme,
    resolvedTheme,
    isDark,
    setTheme: setAppTheme,
    applyTheme,
  };
}