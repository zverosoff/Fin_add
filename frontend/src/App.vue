<!-- frontend/src/App.vue -->
<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useScanStore } from '@/stores/scan';
import { useAppTheme } from '@/composables/useAppTheme';
import { notifySaved } from '@/composables/useDataStatus';
import { initPushHandlers, subscribeToPush } from '@/composables/usePushNotifications';
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
const { applyTheme } = useAppTheme();

applyTheme();

// ✅ Динамический theme-color для Android-статусбара
function updateThemeColor() {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }

  if (document.body.classList.contains('analytics-active')) {
    meta.setAttribute('content', '#1a0f3a');
    return;
  }

  const isDark = document.documentElement.dataset.appTheme === 'dark';
  meta.setAttribute('content', isDark ? '#14091f' : '#f4f6fb');
}

watch(() => route.name, () => {
  // Следующий тик — чтобы body.analytics-active успел появиться/удалиться
  setTimeout(updateThemeColor, 0);
}, { immediate: true });
watch(
  () => document.documentElement.dataset.appTheme,
  updateThemeColor
);

const booting = ref(false);
const percent = ref(0);
const stage = ref('Запуск…');
const done = ref(false);
const manualOpen = ref(false);
const pdfOpen = ref(false);

const showBottomNav = computed(() => route.name !== 'login');

const TAB_ORDER = ['finance', 'analytics', 'deposits', 'profile'];
const transitionName = ref('fade-page');

const BASE_TITLE = 'Финансы PRO+';
document.title = BASE_TITLE;

watch(() => route.name, (newName, oldName) => {
  const newIdx = TAB_ORDER.indexOf(newName);
  const oldIdx = TAB_ORDER.indexOf(oldName);
  if (newIdx >= 0 && oldIdx >= 0) {
    transitionName.value = newIdx > oldIdx ? 'slide-left' : 'slide-right';
  } else {
    transitionName.value = 'fade-page';
  }
});

function switchToManual() { scanStore.close(); manualOpen.value = true; }
function switchToPdf() { scanStore.close(); pdfOpen.value = true; }

async function preloadPeerProfiles() {
  const owners = ['Сергей', 'Саша'];
  const me = auth.user;
  for (const owner of owners) {
    if (owner !== me) {
      try {
        await auth.loadPeerProfile(owner);
      } catch (e) {
        console.warn('[app] loadPeerProfile failed for', owner, e.message);
      }
    }
  }
}

onMounted(async () => {
  if (route.name !== 'login') document.body.classList.add('app-has-bottom-nav');
  initPushHandlers();

  const hasSessionHint = auth.isAuthenticated || !!auth.user;
  if (!hasSessionHint) { router.push('/login'); return; }

  booting.value = true;
  done.value = false;
  percent.value = 0;
  stage.value = 'Приветствие…';

  await new Promise(r => setTimeout(r, 200));

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

    if (valid === null) stage.value = 'Сервер недоступен, работаем офлайн…';

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

    stage.value = 'Загрузка профилей…';
    percent.value = 85;
    await preloadPeerProfiles();

    stage.value = 'Подключение…';
    percent.value = 95;

    connect();
    notifySaved('готово');

    try {
      await subscribeToPush();
    } catch (e) {
      console.warn('[app] push subscribe failed:', e.message);
    }

    percent.value = 100;
    stage.value = 'Готово!';
    done.value = true;

    setTimeout(() => { booting.value = false; }, 400);
  } catch (e) {
    console.error('[app] bootstrap error:', e);
    stage.value = 'Ошибка загрузки';
    setTimeout(() => { booting.value = false; }, 800);
  }
});

watch(() => auth.user, async (newUser, oldUser) => {
  if (newUser && newUser !== oldUser && auth.isAuthenticated) {
    await preloadPeerProfiles();
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
  <div class="app-root">
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
  </div>
</template>

<style>
/* ============================================================
   ✅ ФОН ПО ТЕМЕ — убирает белую полосу внизу
   ============================================================ */
:root {
  --bg-page: #f4f6fb;
}

html[data-app-theme="dark"] {
  --bg-page: #14091f;
}

body {
  background: var(--bg-page, #f4f6fb);
  min-height: 100vh;
  /* ✅ Safe-area для статусбара */
  padding-top: env(safe-area-inset-top, 0);
}

.app-root {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background: transparent;
  padding-top: env(safe-area-inset-top, 0);
}

.page-transition-wrap {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
  padding-bottom: calc(90px + env(safe-area-inset-bottom, 0));
  background: var(--bg-page, #f4f6fb);
  isolation: isolate;
}

/* ✅ КОСТЫЛЬ: на аналитике — фиолетовый фон, без padding-bottom */
body.analytics-active .page-transition-wrap {
  background: linear-gradient(135deg, #1a0f3a 0%, #2d1b5e 50%, #4c1d95 100%) !important;
  background-attachment: fixed !important;
  padding-bottom: 0 !important;
}

body.analytics-active {
  background: linear-gradient(135deg, #1a0f3a 0%, #2d1b5e 50%, #4c1d95 100%) !important;
  background-attachment: fixed !important;
}

/* ✅ КОСТЫЛЬ: переходы на аналитике — тоже фиолетовые */
body.analytics-active .slide-left-enter-active,
body.analytics-active .slide-right-enter-active,
body.analytics-active .fade-page-enter-active,
body.analytics-active .slide-left-leave-active,
body.analytics-active .slide-right-leave-active,
body.analytics-active .fade-page-leave-active {
  background: linear-gradient(135deg, #1a0f3a 0%, #2d1b5e 50%, #4c1d95 100%) !important;
}

@media (max-width: 700px) {
  .page-transition-wrap { padding-bottom: calc(80px + env(safe-area-inset-bottom, 0)); }
  body.analytics-active .page-transition-wrap { padding-bottom: 80px !important; }
}

/* ============================================================
   ПЕРЕХОДЫ МЕЖДУ СТРАНИЦАМИ
   ============================================================ */
.slide-left-leave-active,
.slide-right-leave-active,
.fade-page-leave-active {
  position: absolute;
  top: 0; left: 0; right: 0;
  width: 100%;
  pointer-events: none;
  z-index: 1;
  background: var(--bg-page, transparent);
}

.slide-left-enter-active,
.slide-right-enter-active,
.fade-page-enter-active {
  position: relative;
  z-index: 2;
  background: var(--bg-page, transparent);
}

.slide-left-enter-active,
.slide-right-enter-active {
  transition: transform 0.28s cubic-bezier(.22,.61,.36,1), opacity 0.28s;
}
.slide-left-enter-from { transform: translateX(30px); opacity: 0; }
.slide-right-enter-from { transform: translateX(-30px); opacity: 0; }

.slide-left-leave-active,
.slide-right-leave-active {
  transition: transform 0.28s cubic-bezier(.22,.61,.36,1), opacity 0.28s;
}
.slide-left-leave-to { transform: translateX(-30px); opacity: 0; }
.slide-right-leave-to { transform: translateX(30px); opacity: 0; }

.fade-page-enter-active,
.fade-page-leave-active { transition: opacity 0.25s ease; }
.fade-page-enter-from,
.fade-page-leave-to { opacity: 0; }

/* ============================================================
   ✅ ЖЁСТКИЕ ТЁМНЫЕ ФИКСЫ ДЛЯ PROFILE
   ============================================================ */

html[data-app-theme="dark"] .hero-photo-blur {
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(20, 9, 31, 0.15) 30%,
    rgba(20, 9, 31, 0.5) 55%,
    rgba(20, 9, 31, 0.8) 75%,
    rgba(20, 9, 31, 0.95) 90%,
    #14091f 100%
  ) !important;
}

html[data-app-theme="dark"] .c-value {
  color: #f4f4f6 !important;
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.25) !important;
}

html[data-app-theme="dark"] .c-label {
  color: #8b8ba0 !important;
}

html[data-app-theme="dark"] .compare-row {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)) !important;
  border-color: rgba(139, 92, 246, 0.15) !important;
}

html[data-app-theme="dark"] .c-delta.up {
  color: #4ade80 !important;
  background: rgba(34, 197, 94, 0.18) !important;
  border: 1px solid rgba(74, 222, 128, 0.45) !important;
  text-shadow: 0 0 8px rgba(74, 222, 128, 0.6) !important;
}

html[data-app-theme="dark"] .c-delta.down {
  color: #f43f5e !important;
  background: rgba(244, 63, 94, 0.18) !important;
  border: 1px solid rgba(244, 63, 94, 0.45) !important;
  text-shadow: 0 0 8px rgba(244, 63, 94, 0.6) !important;
}

html[data-app-theme="dark"] .c-delta.flat {
  color: #8b8ba0 !important;
  background: rgba(255,255,255,0.05) !important;
  border: 1px solid rgba(139, 92, 246, 0.15) !important;
}

html[data-app-theme="dark"] .hero-card {
  background: #14091f !important;
  outline-color: rgba(139, 92, 246, 0.2) !important;
}

html[data-app-theme="dark"] .profile-card {
  background:
    radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.08), transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(34, 211, 238, 0.05), transparent 50%),
    linear-gradient(180deg, rgba(30, 16, 48, 0.9) 0%, rgba(20, 9, 31, 0.95) 100%) !important;
  border-color: rgba(139, 92, 246, 0.15) !important;
}

html[data-app-theme="dark"] .stat {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)) !important;
  border-color: rgba(139, 92, 246, 0.12) !important;
}

html[data-app-theme="dark"] .stat-value {
  color: #f4f4f6 !important;
}

html[data-app-theme="dark"] .stat-label,
html[data-app-theme="dark"] .card-title {
  color: #8b8ba0 !important;
}

html[data-app-theme="dark"] .hero-meta {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)) !important;
  border-color: rgba(139, 92, 246, 0.15) !important;
}

html[data-app-theme="dark"] .hero-meta-row {
  color: #8b8ba0 !important;
}

html[data-app-theme="dark"] .hero-name {
  color: #f4f4f6 !important;
  text-shadow: 0 2px 12px rgba(20, 9, 31, 0.9) !important;
}

html[data-app-theme="dark"] .hero-username {
  color: #8b8ba0 !important;
  text-shadow: 0 2px 12px rgba(20, 9, 31, 0.9) !important;
}

html[data-app-theme="dark"] .top-cat {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)) !important;
  border-color: rgba(139, 92, 246, 0.12) !important;
}

html[data-app-theme="dark"] .tc-name,
html[data-app-theme="dark"] .tc-amount-value {
  color: #f4f4f6 !important;
}

html[data-app-theme="dark"] .tc-amount-pct {
  color: #8b8ba0 !important;
}

html[data-app-theme="dark"] .tc-bar {
  background: linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.2)) !important;
}

html[data-app-theme="dark"] .tc-bar-fill {
  background: linear-gradient(180deg, #a855f7, #8b5cf6) !important;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 0 12px rgba(168, 85, 247, 0.6) !important;
}

html[data-app-theme="dark"] .logout-btn {
  background: linear-gradient(180deg, rgba(244,63,94,0.15), rgba(244,63,94,0.05)) !important;
  border-color: rgba(244, 63, 94, 0.4) !important;
  color: #f43f5e !important;
}

html[data-app-theme="dark"] .sync-indicator {
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03)) !important;
  border-color: rgba(139, 92, 246, 0.2) !important;
  color: #8b8ba0 !important;
}

html[data-app-theme="dark"] .stat-extra-row.income {
  background: rgba(34, 197, 94, 0.12) !important;
  border-color: rgba(74, 222, 128, 0.3) !important;
}
html[data-app-theme="dark"] .stat-extra-row.income .se-label {
  color: #8b8ba0 !important;
}
html[data-app-theme="dark"] .stat-extra-row.income .se-value {
  color: #4ade80 !important;
  text-shadow: 0 0 10px rgba(74, 222, 128, 0.5) !important;
}

html[data-app-theme="dark"] .stat-extra-row.expense {
  background: rgba(244, 63, 94, 0.12) !important;
  border-color: rgba(244, 63, 94, 0.3) !important;
}
html[data-app-theme="dark"] .stat-extra-row.expense .se-label {
  color: #8b8ba0 !important;
}
html[data-app-theme="dark"] .stat-extra-row.expense .se-value {
  color: #f43f5e !important;
  text-shadow: 0 0 10px rgba(244, 63, 94, 0.5) !important;
}
</style>