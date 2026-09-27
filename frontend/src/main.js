import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './styles/global.scss';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

// ✅ PWA: регистрация Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.ready
      .then((reg) => {
        console.log('[pwa] SW готов:', reg.scope);
      })
      .catch((e) => {
        console.warn('[pwa] SW не зарегистрирован:', e);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[pwa] SW обновлён');
  });

  // ✅ Клик по уведомлению → фокус на окно
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'notification-click') {
      console.log('[pwa] клик по уведомлению:', event.data);
      window.focus();
    }
  });
}