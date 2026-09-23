<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useScanStore } from '@/stores/scan';
import { notifySaved } from '@/composables/useDataStatus';
import WelcomeOverlay from '@/components/ui/WelcomeOverlay.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import BottomNav from '@/components/ui/BottomNav.vue';
import ScanModal from '@/components/scan/ScanModal.vue';
import ManualModal from '@/components/transactions/ManualModal.vue';
import PdfImportModal from '@/components/scan/PdfImportModal.vue';

const auth = useAuthStore();
const accounts = useAccountsStore();
const router = useRouter();
const route = useRoute();
const { connect } = useWebSocket();
const scanStore = useScanStore();

const booting = ref(false);
const percent = ref(0);
const stage = ref('Запуск…');
const done = ref(false);

const manualOpen = ref(false);
const pdfOpen = ref(false);

const showBottomNav = computed(() => route.name !== 'login');

const TAB_ORDER = ['finance', 'analytics', 'deposits', 'profile'];

const transitionName = ref('fade-page');

watch(() => route.name, (newName, oldName) => {
  const newIdx = TAB_ORDER.indexOf(newName);
  const oldIdx = TAB_ORDER.indexOf(oldName);

  if (newIdx >= 0 && oldIdx >= 0) {
    transitionName.value = newIdx > oldIdx ? 'slide-left' : 'slide-right';
  } else {
    transitionName.value = 'fade-page';
  }
});

function switchToManual() {
  scanStore.close();
  manualOpen.value = true;
}

function switchToPdf() {
  scanStore.close();
  pdfOpen.value = true;
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
    notifySaved('готово');

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

watch(() => route.name, (name) => {
  document.body.classList.toggle('app-has-bottom-nav', name !== 'login');
});

onUnmounted(() => {
  document.body.classList.remove('app-has-bottom-nav');
});
</script>

<template>
  <div class="page-transition-wrap">
    <router-view v-slot="{ Component, route: r }">
      <Transition :name="transitionName" mode="out-in">
        <component :is="Component" :key="r.path" />
      </Transition>
    </router-view>
  </div>

  <BottomNav v-if="showBottomNav" />

  <ScanModal
    v-model="scanStore.isOpen"
    @switch-to-manual="switchToManual"
    @switch-to-pdf="switchToPdf"
  />

  <ManualModal v-model="manualOpen" />
  <PdfImportModal v-model="pdfOpen" />

  <WelcomeOverlay
    :visible="booting"
    :user-name="auth.user"
    :percent="percent"
    :stage="stage"
    :done="done"
  />

  <ToastContainer />
</template>

<style>
/* ============================================================
   Обёртка страницы
   ============================================================ */
.page-transition-wrap {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
}

/* ============================================================
   Анимации
   ============================================================ */

/* Slide left */
.slide-left-enter-active,
.slide-right-enter-active {
  transition: transform 0.28s cubic-bezier(.22,.61,.36,1), opacity 0.28s;
}
.slide-left-enter-from {
  transform: translateX(30px);
  opacity: 0;
}
.slide-right-enter-from {
  transform: translateX(-30px);
  opacity: 0;
}

/* Уходящая — absolute */
.slide-left-leave-active,
.slide-right-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  transition: transform 0.28s cubic-bezier(.22,.61,.36,1), opacity 0.28s;
  pointer-events: none;
}
.slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

/* Фейд */
.fade-page-enter-active,
.fade-page-leave-active {
  transition: opacity 0.25s ease;
}
.fade-page-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  pointer-events: none;
}
.fade-page-enter-from,
.fade-page-leave-to {
  opacity: 0;
}
</style>