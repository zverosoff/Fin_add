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
// vite-plugin-pwa с injectRegister: 'auto' сам вставит скрипт,
// но мы на всякий случай логируем обновления.
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

  // Показываем уведомление о новой версии
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[pwa] SW обновлён — перезагрузка не требуется');
  });
}