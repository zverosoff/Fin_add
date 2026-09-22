<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';

import AppTabs from '@/components/ui/AppTabs.vue';
import AccountsBlock from '@/components/accounts/AccountsBlock.vue';
import ReconcileBanner from '@/components/accounts/ReconcileBanner.vue';
import ReconcileModal from '@/components/accounts/ReconcileModal.vue';
import MonthNav from '@/components/transactions/MonthNav.vue';
import SummaryCompact from '@/components/transactions/SummaryCompact.vue';
import TransactionList from '@/components/transactions/TransactionList.vue';
import ManualModal from '@/components/transactions/ManualModal.vue';
import FabMenu from '@/components/ui/FabMenu.vue';

const router = useRouter();
const auth = useAuthStore();
const accounts = useAccountsStore();
const toast = useToast();
const { connect } = useWebSocket();

const manualOpen = ref(false);
const reconcileOpen = ref(false);
const reconcileAccount = ref(null);

onMounted(async () => {
  try {
    await accounts.load();
    connect();
  } catch (e) {
    toast.error('Не удалось загрузить данные');
    console.error(e);
  }
});

async function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  await auth.logout();
  router.push('/login');
}

function onReconcile(acc) {
  reconcileAccount.value = acc;
  reconcileOpen.value = true;
}

function onReconcileUser(userDiff) {
  // Открываем сверку по первому счёту пользователя с расхождением
  const acc = userDiff.accounts.find(a => accounts.diffByAccount[a.id]?.hasDiff);
  if (acc) onReconcile(acc);
}

function onFabAction(action) {
  if (action === 'manual') manualOpen.value = true;
  if (action === 'scan') toast.info('📸 Сканирование чека — в разработке');
  if (action === 'pdf') toast.info('📄 Импорт PDF — в разработке');
}
</script>

<template>
  <div class="finance-page">
    <header class="top-bar">
      <h1>Финансы PRO+</h1>
      <div class="user-info">
        <span>👤 {{ auth.user }}</span>
        <button @click="handleLogout">Выйти</button>
      </div>
    </header>

    <AppTabs />

    <div class="container">
      <!-- Счета -->
      <AccountsBlock @reconcile="onReconcile" />

      <!-- Предупреждение о расхождении -->
      <ReconcileBanner @reconcile="onReconcileUser" />

      <!-- Месяц / Сводка / Список -->
      <MonthNav />
      <SummaryCompact />
      <TransactionList />
    </div>

    <!-- FAB -->
    <FabMenu
      @manual="onFabAction('manual')"
      @scan="onFabAction('scan')"
      @pdf="onFabAction('pdf')"
    />

    <!-- Модалки -->
    <ManualModal v-model="manualOpen" />
    <ReconcileModal v-model="reconcileOpen" :account="reconcileAccount" />
  </div>
</template>

<style scoped lang="scss">
.finance-page {
  min-height: 100vh;
  padding: 20px 20px 100px;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 900px;
  margin: 0 auto 16px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: var(--shadow-md);

  h1 {
    font-size: 20px;
    margin: 0;
    background: linear-gradient(135deg, #0f172a, #0284c7);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;

  button {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      border-color: var(--danger);
      color: var(--danger);
    }
  }
}

.container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (max-width: 700px) {
  .finance-page { padding: 16px 12px 100px; }
  .top-bar { padding: 10px 16px; margin-bottom: 12px; h1 { font-size: 17px; } }
  .container { gap: 10px; }
}
</style>