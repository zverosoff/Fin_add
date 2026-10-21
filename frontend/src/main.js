import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './styles/global.scss';
import '@/styles/analytics.scss';
import '@/composables/useAppTheme.js';
import { subscribeToPush, initPushHandlers } from '@/composables/usePushNotifications';

// ✅ Устанавливаем ТОЛЬКО data-app-theme, БЕЗ inline background
try {
  const stored = localStorage.getItem('finance-app-theme-v1') || 'auto';
  let theme = stored;
  if (stored === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-app-theme', theme);
  // Без style.background и style.colorScheme — всё через CSS
} catch (e) {}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.ready
      .then((reg) => {
        console.log('[pwa] SW готов:', reg.scope);
      })
      .catch((e) => {
        console.warn('[pwa] SW не зарегистрирован:', e);
      });

    if (Notification.permission === 'granted') {
      subscribeToPush().catch((e) => console.warn('[push] subscribe failed:', e));
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[pwa] SW обновлён');
  });

  initPushHandlers();
}