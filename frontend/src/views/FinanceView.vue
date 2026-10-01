<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';

import AccountsBlock from '@/components/accounts/AccountsBlock.vue';
import CashBlock from '@/components/accounts/CashBlock.vue';
import ReconcileBanner from '@/components/accounts/ReconcileBanner.vue';
import ReconcileModal from '@/components/accounts/ReconcileModal.vue';
import MonthNav from '@/components/transactions/MonthNav.vue';
import SummaryCompact from '@/components/transactions/SummaryCompact.vue';
import TransactionList from '@/components/transactions/TransactionList.vue';
import UserMenuModal from '@/components/user/UserMenuModal.vue';

const router = useRouter();
const auth = useAuthStore();
const accounts = useAccountsStore();
const toast = useToast();

const reconcileOpen = ref(false);
const reconcileAccount = ref(null);
const userMenuOpen = ref(false);
const userMenuOwner = ref('');

onMounted(async () => {
  try {
    if (!accounts.loaded) await accounts.load();
    notifySaved('готово');
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

function onUserMenu(owner) {
  userMenuOwner.value = owner;
  userMenuOpen.value = true;
}
</script>

<template>
  <div class="finance-page">
    <div class="finance-grid">
      <aside class="finance-side">
        <div class="anim-block" style="--delay: 0ms">
          <AccountsBlock @reconcile="onReconcile" @user-menu="onUserMenu" />
        </div>
        <div class="anim-block" style="--delay: 70ms">
          <CashBlock />
        </div>
        <div class="anim-block" style="--delay: 140ms">
          <MonthNav />
        </div>
        <div class="anim-block" style="--delay: 210ms">
          <SummaryCompact />
        </div>
      </aside>

      <main class="finance-main">
        <div v-if="accounts.hasAnyDiff" class="anim-block" style="--delay: 100ms">
          <ReconcileBanner @reconcile="onReconcileUser" />
        </div>
        <div class="anim-block" style="--delay: 180ms">
          <TransactionList />
        </div>
      </main>
    </div>

    <ReconcileModal v-model="reconcileOpen" :account="reconcileAccount" />
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
  padding: 20px 20px 20px;
  position: relative;
}

.finance-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 50% at 15% 0%, rgba(99, 102, 241, 0.08), transparent 60%),
    radial-gradient(ellipse 60% 40% at 85% 40%, rgba(139, 92, 246, 0.06), transparent 60%),
    radial-gradient(ellipse 80% 60% at 50% 100%, rgba(236, 72, 153, 0.05), transparent 65%),
    linear-gradient(180deg, #fafbff 0%, #f3f5fb 100%);
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

.anim-block {
  animation: cardEnter 0.6s cubic-bezier(.34,1.56,.64,1) both;
  animation-delay: var(--delay, 0ms);
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
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
  .finance-page { padding: 16px 12px 20px; }
  .finance-grid { gap: 10px; }
  .finance-side,
  .finance-main { gap: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .anim-block { animation: none !important; }
}
</style>