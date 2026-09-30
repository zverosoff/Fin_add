<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';

import PageHero from '@/components/ui/PageHero.vue';
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

// ✅ "Дождь" из транзакций
const rainActive = ref(false);
const rainItems = ref([]);

function spawnRain() {
  const ITEMS = 14;
  const arr = [];
  for (let i = 0; i < ITEMS; i++) {
    arr.push({
      id: i,
      delay: Math.random() * 0.6,
      duration: 0.9 + Math.random() * 0.6,
      rotate: -25 + Math.random() * 50,
      size: 30 + Math.random() * 40,
      left: Math.random() * 100,
    });
  }
  rainItems.value = arr;
  rainActive.value = true;
  setTimeout(() => { rainActive.value = false; rainItems.value = []; }, 2000);
}

onMounted(async () => {
  try {
    if (!accounts.loaded) {
      await accounts.load();
      // ✅ Показываем "дождь" только при первой загрузке
      spawnRain();
    }
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
    <PageHero title="Финансы PRO+" />

    <div class="finance-grid">
      <aside class="finance-side">
        <AccountsBlock @reconcile="onReconcile" @user-menu="onUserMenu" />
        <CashBlock />
        <MonthNav />
        <SummaryCompact />
      </aside>

      <main class="finance-main">
        <ReconcileBanner @reconcile="onReconcileUser" />
        <TransactionList />
      </main>
    </div>

    <!-- ✅ "Дождь" из транзакций -->
    <Teleport to="body">
      <div v-if="rainActive" class="tx-rain" aria-hidden="true">
        <div
          v-for="item in rainItems"
          :key="item.id"
          class="tx-rain-item"
          :style="{
            left: item.left + '%',
            animationDelay: item.delay + 's',
            animationDuration: item.duration + 's',
            '--rot': item.rotate + 'deg',
            '--size': item.size + 'px',
          }"
        >
          <div class="tx-rain-card">
            <div class="tx-rain-avatar"></div>
            <div class="tx-rain-lines">
              <span></span>
              <span></span>
            </div>
            <div class="tx-rain-amount"></div>
          </div>
        </div>
      </div>
    </Teleport>

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
  .finance-grid { grid-template-columns: 1fr; gap: 14px; max-width: 900px; }
  .finance-side { position: static; }
}
@media (max-width: 700px) {
  .finance-page { padding: 16px 12px 20px; }
  .finance-grid { gap: 10px; }
  .finance-side, .finance-main { gap: 10px; }
}

/* ✅ "Дождь" из транзакций */
.tx-rain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  overflow: hidden;
}

.tx-rain-item {
  position: absolute;
  top: -100px;
  width: var(--size);
  opacity: 0;
  animation-name: txRainFall;
  animation-timing-function: cubic-bezier(.4,0,.6,1);
  animation-fill-mode: forwards;
  will-change: transform, opacity;
}

.tx-rain-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 6px 20px -6px rgba(15, 23, 42, 0.3);
  width: 100%;
  aspect-ratio: 3 / 1;
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.tx-rain-avatar {
  width: 20%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  flex-shrink: 0;
}

.tx-rain-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  span {
    height: 3px;
    border-radius: 2px;
    background: rgba(148, 163, 184, 0.35);
    &:first-child { width: 70%; }
    &:last-child { width: 45%; }
  }
}

.tx-rain-amount {
  width: 22%;
  height: 8px;
  border-radius: 2px;
  background: rgba(34, 197, 94, 0.4);
  flex-shrink: 0;
}

@keyframes txRainFall {
  0% {
    transform: translateY(0) rotate(var(--rot)) scale(0.8);
    opacity: 0;
  }
  15% { opacity: 1; }
  85% { opacity: 0.9; }
  100% {
    transform: translateY(calc(100vh + 100px)) rotate(calc(var(--rot) * -1)) scale(1);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tx-rain-item { animation: none !important; }
}
</style>