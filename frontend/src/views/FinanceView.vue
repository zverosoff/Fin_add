<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';

import PageHero from '@/components/ui/PageHero.vue';
import AppTabs from '@/components/ui/AppTabs.vue';
import AccountsBlock from '@/components/accounts/AccountsBlock.vue';
import ReconcileBanner from '@/components/accounts/ReconcileBanner.vue';
import ReconcileModal from '@/components/accounts/ReconcileModal.vue';
import MonthNav from '@/components/transactions/MonthNav.vue';
import SummaryCompact from '@/components/transactions/SummaryCompact.vue';
import TransactionList from '@/components/transactions/TransactionList.vue';
import ManualModal from '@/components/transactions/ManualModal.vue';
import ScanModal from '@/components/scan/ScanModal.vue';
import PdfImportModal from '@/components/scan/PdfImportModal.vue';
import FabMenu from '@/components/ui/FabMenu.vue';
import UserMenuModal from '@/components/user/UserMenuModal.vue';

const router = useRouter();
const auth = useAuthStore();
const accounts = useAccountsStore();
const toast = useToast();
const { connect } = useWebSocket();

const manualOpen = ref(false);
const reconcileOpen = ref(false);
const reconcileAccount = ref(null);
const scanOpen = ref(false);
const pdfOpen = ref(false);
const userMenuOpen = ref(false);
const userMenuOwner = ref('');
const actionMenuOpen = ref(false);

onMounted(async () => {
  try {
    if (!accounts.loaded) await accounts.load();
    notifySaved('готово');
    connect();
  } catch (e) {
    notifyError(e.message || 'Не удалось загрузить данные');
    toast.error('Не удалось загрузить данные');
    console.error(e);
  }
});

async function handleLogout() {
  await auth.logout();
  router.push('/login');
}

function onReconcile(acc) {
  reconcileAccount.value = acc;
  reconcileOpen.value = true;
}

function onReconcileUser(userDiff) {
  const acc = userDiff.accounts.find(a => accounts.diffByAccount?.[a.id]?.hasDiff);
  if (acc) onReconcile(acc);
}

function openManual() { manualOpen.value = true; actionMenuOpen.value = false; }
function openScan()   { scanOpen.value = true;   actionMenuOpen.value = false; }
function openPdf()    { pdfOpen.value = true;    actionMenuOpen.value = false; }

function onUserMenu(owner) {
  userMenuOwner.value = owner;
  userMenuOpen.value = true;
}
</script>

<template>
  <div class="finance-page">
    <PageHero title="Финансы PRO+" />

    <AppTabs />

    <!-- ✅ Кнопка «Добавить операцию» — только на ПК -->
    <div class="desktop-add-bar">
      <div class="action-menu" :class="{ open: actionMenuOpen }">
        <button class="action-menu-main" @click="actionMenuOpen = !actionMenuOpen" type="button">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;">
            <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"/>
          </svg>
          Добавить операцию
          <svg class="chev" viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>

        <Transition name="menu-fade">
          <div v-if="actionMenuOpen" class="action-menu-list">
            <button class="action-menu-item" type="button" @click="openManual">
              <span>✏️</span> Вручную
            </button>
            <button class="action-menu-item" type="button" @click="openScan">
              <span>📸</span> Чек
            </button>
            <button class="action-menu-item" type="button" @click="openPdf">
              <span>📄</span> PDF-выписка
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <div class="finance-grid">
      <!-- ЛЕВАЯ КОЛОНКА — счета, месяц, сводка -->
      <aside class="finance-side">
        <AccountsBlock
          @reconcile="onReconcile"
          @user-menu="onUserMenu"
        />
        <MonthNav />
        <SummaryCompact />
      </aside>

      <!-- ПРАВАЯ КОЛОНКА — операции -->
      <main class="finance-main">
        <ReconcileBanner @reconcile="onReconcileUser" />
        <TransactionList />
      </main>
    </div>

    <FabMenu
      @manual="openManual"
      @scan="openScan"
      @pdf="openPdf"
    />

    <ManualModal v-model="manualOpen" />
    <ReconcileModal v-model="reconcileOpen" :account="reconcileAccount" />
    <ScanModal v-model="scanOpen" />
    <PdfImportModal v-model="pdfOpen" />
    <UserMenuModal
      v-model="userMenuOpen"
      :owner="userMenuOwner"
      @logout="handleLogout"
    />
  </div>
</template>

<style scoped lang="scss">
.finance-page {
  min-height: 100vh;
  padding: 20px 20px 100px;
}

/* ✅ Кнопка «Добавить операцию» — только ПК, скрыта на мобильных */
.desktop-add-bar {
  display: flex;
  justify-content: center;
  max-width: 1400px;
  margin: 0 auto 14px;
}

@media (max-width: 1100px) {
  .desktop-add-bar { display: none; }
}

.action-menu {
  position: relative;
  display: inline-block;
}

.action-menu-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 22px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 10px 24px -10px rgba(59, 130, 246, 0.7);
  transition: transform 0.12s cubic-bezier(.34,1.56,.64,1), box-shadow 0.18s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 32px -12px rgba(59, 130, 246, 0.85);
  }

  .chev { transition: transform .25s; }
}

.action-menu.open .action-menu-main .chev {
  transform: rotate(180deg);
}

.action-menu-list {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 220px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 20px 60px -20px rgba(15, 23, 42, 0.2);
  z-index: 100;
}

.action-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(56, 189, 248, 0.12);
    color: var(--accent);
  }
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.18s, transform 0.18s;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

/* ============================================================
   ДЕСКТОП — 2 колонки
   Левая колонка ШИРЕ (было 380px, теперь 440px)
   ============================================================ */
.finance-grid {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 440px 1fr;   /* ← было 380px */
  gap: 20px;
  align-items: start;
}

.finance-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 20px;
}

.finance-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* ============================================================
   ПЛАНШЕТ — 1 колонка
   ============================================================ */
@media (max-width: 1100px) {
  .finance-grid {
    grid-template-columns: 1fr;
    gap: 14px;
    max-width: 900px;
  }

  .finance-side {
    position: static;
  }
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .finance-page { padding: 16px 12px 100px; }

  .finance-grid { gap: 10px; }
  .finance-side,
  .finance-main { gap: 10px; }
}
</style>