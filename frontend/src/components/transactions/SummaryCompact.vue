<!-- frontend/src/components/transactions/SummaryCompact.vue -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { useAccountsStore } from '@/stores/accounts';
import { fmt } from '@/composables/useFormat';
import CashModal from './CashModal.vue';

const tx = useTransactionsStore();
const accounts = useAccountsStore();

const LS_KEY = 'financeProUsersCollapsed_v1';
const collapsed = ref(true);

const LS_CASH_KEY = 'financeProCashCollapsed_v1';
const cashCollapsed = ref(false);

onMounted(() => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) collapsed.value = saved === '1';
    const savedCash = localStorage.getItem(LS_CASH_KEY);
    if (savedCash !== null) cashCollapsed.value = savedCash === '1';
  } catch (e) {}
});

watch(collapsed, (val) => {
  try { localStorage.setItem(LS_KEY, val ? '1' : '0'); } catch (e) {}
});

watch(cashCollapsed, (val) => {
  try { localStorage.setItem(LS_CASH_KEY, val ? '1' : '0'); } catch (e) {}
});

function toggle() {
  collapsed.value = !collapsed.value;
}

function toggleCash() {
  cashCollapsed.value = !cashCollapsed.value;
}

const balanceClass = computed(() => {
  const b = tx.summary.balance;
  return b > 0 ? 'positive' : b < 0 ? 'negative' : '';
});

const totalCash = computed(() => accounts.totalCash);

const cashOwners = computed(() => {
  return ['Сергей', 'Саша'].map(owner => ({
    owner,
    emoji: owner === 'Сергей' ? '👨' : '👩',
    value: accounts.getCash(owner),
  }));
});

const cashModalOpen = ref(false);
const cashModalOwner = ref('');

function openCashModal(owner = '') {
  cashModalOwner.value = owner;
  cashModalOpen.value = true;
}
</script>

<template>
  <div class="summary-compact" :class="{ collapsed }">
    <div class="sc-top">
      <div class="sc-item">
        <span class="sc-icon">📈</span>
        <span class="sc-value income">{{ fmt(tx.summary.income) }} ₽</span>
        <span class="sc-label">доходы</span>
      </div>
      <div class="sc-divider"></div>
      <div class="sc-item">
        <span class="sc-icon">📉</span>
        <span class="sc-value expense">{{ fmt(tx.summary.expense) }} ₽</span>
        <span class="sc-label">расходы</span>
      </div>
      <div class="sc-divider"></div>
      <div class="sc-item">
        <span class="sc-icon">💰</span>
        <span class="sc-value" :class="balanceClass">{{ fmt(tx.summary.balance) }} ₽</span>
        <span class="sc-label">баланс</span>
      </div>
    </div>

    <!-- По пользователям -->
    <div class="sc-users-header" @click="toggle">
      <span class="sc-users-icon">👥</span>
      <span class="sc-users-title">По пользователям</span>
      <button class="sc-toggle" type="button">
        <svg viewBox="0 0 24 24" class="chev" :class="{ open: !collapsed }">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
    </div>

    <div class="sc-users">
      <div
        v-for="(data, user) in tx.byUser"
        :key="user"
        class="sc-user-row"
        :class="user === 'Сергей' ? 'sergey' : 'sasha'"
      >
        <span class="sc-user-avatar">{{ user === 'Сергей' ? '👨' : '👩' }}</span>
        <span class="sc-user-name">{{ user }}</span>
        <span class="sc-user-details">
          <span class="sc-user-inc">+{{ fmt(data.income) }} ₽</span>
          <span class="sc-user-exp">−{{ fmt(data.expense) }} ₽</span>
          <span
            class="sc-user-bal"
            :class="(data.income - data.expense) >= 0 ? 'positive' : 'negative'"
          >
            {{ fmt(data.income - data.expense) }} ₽
          </span>
        </span>
      </div>
    </div>

    <!-- ✅ Наличные -->
    <div class="sc-cash-header" @click="toggleCash">
      <span class="sc-cash-icon">💵</span>
      <span class="sc-cash-title">Наличные</span>
      <span class="sc-cash-total">{{ fmt(totalCash) }} ₽</span>
      <button class="sc-toggle" type="button">
        <svg viewBox="0 0 24 24" class="chev" :class="{ open: !cashCollapsed }">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
      <button
        class="sc-cash-add"
        type="button"
        title="Добавить/изъять наличные"
        @click.stop="openCashModal()"
      >+</button>
    </div>

    <div class="sc-cash-body" :class="{ collapsed: cashCollapsed }">
      <div
        v-for="item in cashOwners"
        :key="item.owner"
        class="sc-cash-row"
        :class="item.owner === 'Сергей' ? 'sergey' : 'sasha'"
        @click="openCashModal(item.owner)"
        :title="`Изменить наличные ${item.owner}`"
      >
        <span class="sc-cash-avatar">{{ item.emoji }}</span>
        <span class="sc-cash-name">{{ item.owner }}</span>
        <span
          class="sc-cash-value"
          :class="item.value > 0 ? 'positive' : 'muted'"
        >
          {{ fmt(item.value) }} ₽
        </span>
      </div>

      <div v-if="totalCash === 0" class="sc-cash-empty">
        Наличных пока нет. Нажмите <strong>+</strong>, чтобы добавить.
      </div>
    </div>

    <CashModal v-model="cashModalOpen" :owner="cashModalOwner" />
  </div>
</template>

<style scoped lang="scss">
.summary-compact {
  background:
    linear-gradient(180deg, rgba(34, 197, 94, 0.05), transparent 60%),
    rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: var(--shadow-md);
  transition: padding 0.25s;

  &.collapsed { padding: 12px 14px 10px; }
}

.sc-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}

.sc-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sc-icon { font-size: 13px; opacity: 0.8; }

.sc-value {
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.income   { color: #16a34a; }
  &.expense  { color: #dc2626; }
  &.positive { color: #16a34a; }
  &.negative { color: #dc2626; }
}

.sc-label {
  font-size: 9px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.sc-divider {
  width: 1px;
  height: 32px;
  background: linear-gradient(180deg, transparent, var(--border), transparent);
}

.sc-users-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  cursor: pointer;
  user-select: none;

  &:hover .sc-users-title { color: var(--accent); }
}

.sc-users-icon { font-size: 14px; flex-shrink: 0; }

.sc-users-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  flex: 1;
  transition: color 0.15s;
}

.sc-toggle {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.18s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .chev {
    width: 12px;
    height: 12px;
    fill: currentColor;
    transition: transform 0.25s;
  }

  .chev.open { transform: rotate(180deg); }
}

.sc-users {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  max-height: 300px;
  opacity: 1;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.22s ease, margin 0.25s ease;
}

.summary-compact.collapsed .sc-users {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}

.sc-user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  font-size: 12px;
}

.sc-user-avatar { font-size: 14px; }
.sc-user-name { font-weight: 700; min-width: 52px; }

.sc-user-details {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: nowrap;
}

.sc-user-inc, .sc-user-exp {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.sc-user-inc { color: #22c55e; }
.sc-user-exp { color: #ef4444; }

.sc-user-bal {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.28);
  color: var(--accent);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;

  &.positive { color: #22c55e; }
  &.negative { color: #f87171; }
}

/* ✅ Наличные */
.sc-cash-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  cursor: pointer;
  user-select: none;

  &:hover .sc-cash-title { color: #16a34a; }
}

.sc-cash-icon { font-size: 14px; flex-shrink: 0; }

.sc-cash-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: color 0.15s;
}

.sc-cash-total {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  color: #16a34a;
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  white-space: nowrap;
}

.sc-cash-add {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.08);
  color: #16a34a;
  font-family: inherit;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background: #16a34a;
    color: #fff;
    transform: scale(1.05);
  }
  &:active { transform: scale(0.95); }
}

.sc-cash-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  max-height: 300px;
  opacity: 1;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.22s ease, margin 0.25s ease;

  /* ✅ Работает корректно */
  &.collapsed {
    max-height: 0;
    opacity: 0;
    margin-top: 0;
  }
}

.sc-cash-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(34, 197, 94, 0.06);
  }

  &.sergey .sc-cash-avatar { background: rgba(59, 130, 246, 0.12); }
  &.sasha  .sc-cash-avatar { background: rgba(236, 72, 153, 0.12); }
}

.sc-cash-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.sc-cash-name {
  font-weight: 700;
  color: var(--text);
  min-width: 52px;
}

.sc-cash-value {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);

  &.positive { color: #16a34a; }
  &.muted {
    color: var(--muted);
    background: rgba(148, 163, 184, 0.08);
    border-color: var(--border);
  }
}

.sc-cash-empty {
  padding: 10px 12px;
  text-align: center;
  font-size: 11.5px;
  color: var(--muted);
  background: rgba(148, 163, 184, 0.06);
  border-radius: 8px;
  border: 1px dashed var(--border);
  line-height: 1.4;

  strong { color: #16a34a; font-weight: 800; }
}

@media (max-width: 700px) {
  .summary-compact {
    padding: 10px 12px;
    border-radius: 12px;
  }

  .sc-top { gap: 6px; }

  .sc-icon { font-size: 12px; }
  .sc-value { font-size: 14px; }
  .sc-label { font-size: 8.5px; letter-spacing: 0.05em; }
  .sc-divider { height: 28px; }

  .sc-users-header,
  .sc-cash-header {
    margin-top: 10px;
    padding-top: 8px;
    gap: 6px;
  }

  .sc-users-icon, .sc-cash-icon { font-size: 12px; }
  .sc-users-title, .sc-cash-title { font-size: 10px; }
  .sc-toggle { width: 22px; height: 22px; }
  .sc-toggle .chev { width: 11px; height: 11px; }

  .sc-user-row, .sc-cash-row {
    padding: 5px 6px;
    margin: 0 -6px;
    gap: 6px;
  }

  .sc-user-avatar, .sc-cash-avatar { font-size: 13px; }
  .sc-user-name, .sc-cash-name { font-size: 11px; min-width: 44px; }
  .sc-user-details { gap: 6px; }
  .sc-user-inc, .sc-user-exp { font-size: 10px; }
  .sc-user-bal { font-size: 10px; padding: 1px 6px; }

  .sc-cash-total { font-size: 12px; padding: 2px 8px; }
  .sc-cash-add { width: 24px; height: 24px; font-size: 15px; }
  .sc-cash-value { font-size: 11px; padding: 1px 8px; }
  .sc-cash-empty { font-size: 10.5px; padding: 8px 10px; }
}
</style>