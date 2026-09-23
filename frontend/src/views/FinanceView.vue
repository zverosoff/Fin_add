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

// ✅ FAB сразу открывает сканер
function openScan() { scanOpen.value = true; }

// ✅ Переключения из ScanModal
function switchToManual() {
  scanOpen.value = false;
  manualOpen.value = true;
}
function switchToPdf() {
  scanOpen.value = false;
  pdfOpen.value = true;
}

function onUserMenu(owner) {
  userMenuOwner.value = owner;
  userMenuOpen.value = true;
}
</script>

<template>
  <div class="finance-page">
    <PageHero title="Финансы PRO+" />

    <AppTabs />

    <div class="finance-grid">
      <aside class="finance-side">
        <AccountsBlock
          @reconcile="onReconcile"
          @user-menu="onUserMenu"
        />
        <MonthNav />
        <SummaryCompact />
      </aside>

      <main class="finance-main">
        <ReconcileBanner @reconcile="onReconcileUser" />
        <TransactionList />
      </main>
    </div>

    <!-- ✅ FAB теперь открывает сразу сканер -->
    <FabMenu @scan="openScan" />

    <ManualModal v-model="manualOpen" />
    <ReconcileModal v-model="reconcileOpen" :account="reconcileAccount" />
    <ScanModal
      v-model="scanOpen"
      @switch-to-manual="switchToManual"
      @switch-to-pdf="switchToPdf"
    />
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

.finance-grid {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 440px 1fr;
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

@media (max-width: 1100px) {
  .finance-grid {
    grid-template-columns: 1fr;
    gap: 14px;
    max-width: 900px;
  }

  .finance-side { position: static; }
}

@media (max-width: 700px) {
  .finance-page { padding: 16px 12px 100px; }
  .finance-grid { gap: 10px; }
  .finance-side,
  .finance-main { gap: 10px; }
}
</style>