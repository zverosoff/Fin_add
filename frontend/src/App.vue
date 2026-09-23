<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import WelcomeOverlay from '@/components/ui/WelcomeOverlay.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';

const auth = useAuthStore();
const accounts = useAccountsStore();
const router = useRouter();
const { connect } = useWebSocket();

// ✅ Оверлей показывается при каждом открытии приложения
const booting = ref(false);
const percent = ref(0);
const stage = ref('Запуск…');
const done = ref(false);

onMounted(async () => {
  // Если пользователь не залогинен — без оверлея на /login
  const hasSessionHint = auth.isAuthenticated || !!auth.user;
  if (!hasSessionHint) {
    router.push('/login');
    return;
  }

  // ✅ Показываем приветствие ВСЕГДА при открытии с валидной сессией
  booting.value = true;
  done.value = false;
  percent.value = 0;
  stage.value = 'Приветствие…';

  // Небольшая пауза, чтобы пользователь увидел анимацию появления
  await new Promise(r => setTimeout(r, 250));

  try {
    // ─── Этап 1: проверка сессии ───
    stage.value = 'Проверка сессии…';
    percent.value = 10;

    const valid = await auth.checkSession();

    if (valid === false) {
      // 401 — точно невалидна
      await auth.logout();
      booting.value = false;
      router.push('/login');
      return;
    }

    // valid === null → сеть недоступна. Не разлогиниваем,
    // продолжаем с тем, что есть в кэше.
    if (valid === null) {
      stage.value = 'Сервер недоступен, работаем офлайн…';
    }

    // ─── Этап 2: загрузка состояния ───
    stage.value = 'Загрузка данных…';
    percent.value = 30;

    try {
      await accounts.load((p, s) => {
        // p: 0..100 → мапим в 30..90
        percent.value = 30 + p * 0.6;
        stage.value = s;
      });
    } catch (e) {
      console.warn('[app] не удалось загрузить состояние:', e.message);
      stage.value = 'Данные недоступны';
    }

    // ─── Этап 3: финализация ───
    stage.value = 'Подключение…';
    percent.value = 95;

    connect();

    // ─── Готово ───
    percent.value = 100;
    stage.value = 'Готово!';
    done.value = true;

    // Анимация исчезновения
    setTimeout(() => {
      booting.value = false;
    }, 900);

  } catch (e) {
    console.error('[app] bootstrap error:', e);
    stage.value = 'Ошибка загрузки';
    setTimeout(() => { booting.value = false; }, 1500);
  }
});
</script>

<template>
  <router-view />

  <WelcomeOverlay
    :visible="booting"
    :user-name="auth.user"
    :percent="percent"
    :stage="stage"
    :done="done"
  />

  <ToastContainer />
</template>