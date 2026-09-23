<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import WelcomeOverlay from '@/components/ui/WelcomeOverlay.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import BottomNav from '@/components/ui/BottomNav.vue';

const auth = useAuthStore();
const accounts = useAccountsStore();
const router = useRouter();
const route = useRoute();
const { connect } = useWebSocket();

const booting = ref(false);
const percent = ref(0);
const stage = ref('Запуск…');
const done = ref(false);

// Показывать BottomNav на всех страницах, кроме /login
const showBottomNav = computed(() => route.name !== 'login');

function openScan() {
  window.dispatchEvent(new CustomEvent('open-scan-modal'));
}

onMounted(async () => {
  if (route.name !== 'login') {
    document.body.classList.add('app-has-bottom-nav');
  }

  const hasSessionHint = auth.isAuthenticated || !!auth.user;
  if (!hasSessionHint) {
    router.push('/login');
    return;
  }

  booting.value = true;
  done.value = false;
  percent.value = 0;
  stage.value = 'Приветствие…';

  await new Promise(r => setTimeout(r, 250));

  try {
    stage.value = 'Проверка сессии…';
    percent.value = 10;

    const valid = await auth.checkSession();

    if (valid === false) {
      await auth.logout();
      booting.value = false;
      router.push('/login');
      return;
    }

    if (valid === null) {
      stage.value = 'Сервер недоступен, работаем офлайн…';
    }

    stage.value = 'Загрузка данных…';
    percent.value = 30;

    try {
      await accounts.load((p, s) => {
        percent.value = 30 + p * 0.6;
        stage.value = s;
      });
    } catch (e) {
      console.warn('[app] не удалось загрузить состояние:', e.message);
      stage.value = 'Данные недоступны';
    }

    stage.value = 'Подключение…';
    percent.value = 95;

    connect();

    percent.value = 100;
    stage.value = 'Готово!';
    done.value = true;

    setTimeout(() => {
      booting.value = false;
    }, 900);
  } catch (e) {
    console.error('[app] bootstrap error:', e);
    stage.value = 'Ошибка загрузки';
    setTimeout(() => { booting.value = false; }, 1500);
  }
});

// Управление классом body при смене маршрута
watch(() => route.name, (name) => {
  document.body.classList.toggle('app-has-bottom-nav', name !== 'login');
});

onUnmounted(() => {
  document.body.classList.remove('app-has-bottom-nav');
});
</script>

<template>
  <router-view />

  <BottomNav v-if="showBottomNav" @open-scan="openScan" />

  <WelcomeOverlay
    :visible="booting"
    :user-name="auth.user"
    :percent="percent"
    :stage="stage"
    :done="done"
  />

  <ToastContainer />
</template>