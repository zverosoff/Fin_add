import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './styles/global.scss';
import '@/composables/useAppTheme.js';   // ← инициализация темы
import { subscribeToPush, initPushHandlers } from '@/composables/usePushNotifications';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

// ✅ PWA: Service Worker + Web Push
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