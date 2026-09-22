<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { fmt } from '@/composables/useFormat';

const tx = useTransactionsStore();

const LS_KEY = 'financeProUsersCollapsed_v1';
const collapsed = ref(true);

onMounted(() => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) collapsed.value = saved === '1';
  } catch (e) {}
});

watch(collapsed, (val) => {
  try { localStorage.setItem(LS_KEY, val ? '1' : '0'); } catch (e) {}
});

function toggle() {
  collapsed.value = !collapsed.value;
}

const balanceClass = computed(() => {
  const b = tx.summary.balance;
  return b > 0 ? 'positive' : b < 0 ? 'negative' : '';
});
</script>

<template>
  <div class="summary-compact" :class="{ collapsed }">
    <!-- Верхняя строка с метриками -->
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

    <!-- Заголовок сворачиваемой секции -->
    <div class="sc-users-header" @click="toggle">
      <span class="sc-users-icon">👥</span>
      <span class="sc-users-title">По пользователям</span>
      <button class="sc-toggle" type="button" :aria-label="collapsed ? 'Развернуть' : 'Свернуть'">
        <svg viewBox="0 0 24 24" class="chev"><path d="M7 10l5 5 5-5z"/></svg>
      </button>
    </div>

    <!-- Строки пользователей -->
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

  &:hover .sc-users-title {
    color: var(--accent);
  }
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
}

.summary-compact:not(.collapsed) .sc-toggle .chev {
  transform: rotate(180deg);
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
  position: relative;
}

.sc-user-avatar { font-size: 14px; }
.sc-user-name {
  font-weight: 700;
  min-width: 52px;
}

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
</style>