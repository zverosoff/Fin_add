<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { fmt } from '@/composables/useFormat';

const tx = useTransactionsStore();

// ✅ Главный флаг — вся панель свёрнута
const LS_KEY_MAIN = 'financeProSummaryMainCollapsed_v1';
const mainCollapsed = ref(true);

// Второстепенный — «По пользователям»
const LS_KEY_USERS = 'financeProSummaryUsersCollapsed_v1';
const usersCollapsed = ref(true);

onMounted(() => {
  try {
    const savedMain = localStorage.getItem(LS_KEY_MAIN);
    if (savedMain !== null) mainCollapsed.value = savedMain === '1';

    const savedUsers = localStorage.getItem(LS_KEY_USERS);
    if (savedUsers !== null) usersCollapsed.value = savedUsers === '1';
  } catch (e) {}
});

watch(mainCollapsed, (val) => {
  try { localStorage.setItem(LS_KEY_MAIN, val ? '1' : '0'); } catch (e) {}
});

watch(usersCollapsed, (val) => {
  try { localStorage.setItem(LS_KEY_USERS, val ? '1' : '0'); } catch (e) {}
});

function toggleMain() {
  mainCollapsed.value = !mainCollapsed.value;
}

function toggleUsers(e) {
  if (e) e.stopPropagation();
  usersCollapsed.value = !usersCollapsed.value;
}

const balanceClass = computed(() => {
  const b = tx.summary.balance;
  return b > 0 ? 'positive' : b < 0 ? 'negative' : '';
});
</script>

<template>
  <div class="summary-compact" :class="{ 'main-collapsed': mainCollapsed }">
    <!-- ✅ Верхняя строка — клик сворачивает/разворачивает всю панель -->
    <div class="sc-main-header" @click="toggleMain">
      <span class="sc-main-icon">📊</span>
      <span class="sc-main-title">Итого за месяц</span>
      <span class="sc-main-balance" :class="balanceClass">
        {{ fmt(tx.summary.balance) }} ₽
      </span>
      <button
        class="sc-main-toggle"
        type="button"
        :aria-label="mainCollapsed ? 'Развернуть' : 'Свернуть'"
        @click.stop="toggleMain"
      >
        <svg viewBox="0 0 24 24" class="chev">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
    </div>

    <!-- ✅ Раскрывающийся контент -->
    <div class="sc-content">
      <!-- Верхний ряд -->
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
      <div class="sc-users-header" @click="toggleUsers">
        <span class="sc-users-icon">👥</span>
        <span class="sc-users-title">По пользователям</span>
        <button
          class="sc-toggle"
          type="button"
          :aria-label="usersCollapsed ? 'Развернуть' : 'Свернуть'"
          @click.stop="toggleUsers"
        >
          <svg viewBox="0 0 24 24" class="chev"><path d="M7 10l5 5 5-5z"/></svg>
        </button>
      </div>

      <div class="sc-users" :class="{ collapsed: usersCollapsed }">
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
  </div>
</template>

<style scoped lang="scss">
.summary-compact {
  background:
    linear-gradient(180deg, rgba(34, 197, 94, 0.05), transparent 60%),
    rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  transition: padding 0.25s;
  overflow: hidden;
}

/* ✅ Шапка — всегда видна */
.sc-main-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;

  &:hover .sc-main-title {
    color: var(--accent);
  }
}

.sc-main-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.sc-main-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
  transition: color 0.15s;
}

.sc-main-balance {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  transition: color 0.15s;

  &.positive { color: #16a34a; }
  &.negative { color: #dc2626; }
}

.sc-main-toggle {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
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

.summary-compact:not(.main-collapsed) .sc-main-toggle .chev {
  transform: rotate(180deg);
}

/* ✅ Раскрывающийся контент */
.sc-content {
  max-height: 600px;
  opacity: 1;
  padding: 0 14px 12px;
  transition:
    max-height 0.35s cubic-bezier(.22,.61,.36,1),
    opacity 0.25s ease,
    padding 0.3s ease;
}

.summary-compact.main-collapsed .sc-content {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Верхний ряд — доходы/расходы/баланс */
.sc-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
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

/* По пользователям */
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

.sc-users:not(.collapsed) ~ * .sc-toggle .chev,
.sc-users-header .sc-toggle .chev {
  transform: rotate(0deg);
}

/* Поворот стрелки вниз, когда список раскрыт */
.sc-users:not(.collapsed) ~ * {}
.sc-users-header:has(+ .sc-users:not(.collapsed)) .sc-toggle .chev {
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

  &.collapsed {
    max-height: 0;
    opacity: 0;
    margin-top: 0;
  }
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

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .sc-main-header { padding: 10px 12px; gap: 6px; }
  .sc-main-icon { font-size: 13px; }
  .sc-main-title { font-size: 11px; }
  .sc-main-balance { font-size: 13px; }

  .sc-content { padding: 0 12px 10px; }

  .sc-top { gap: 6px; }
  .sc-icon { font-size: 12px; }
  .sc-value { font-size: 14px; }
  .sc-label { font-size: 8.5px; letter-spacing: 0.05em; }
  .sc-divider { height: 28px; }

  .sc-users-header {
    margin-top: 10px;
    padding-top: 8px;
    gap: 6px;
  }

  .sc-users-icon { font-size: 12px; }
  .sc-users-title { font-size: 10px; }
  .sc-toggle { width: 22px; height: 22px; }
  .sc-toggle .chev { width: 11px; height: 11px; }

  .sc-user-row {
    padding: 5px 6px;
    margin: 0 -6px;
    gap: 6px;
  }

  .sc-user-avatar { font-size: 13px; }
  .sc-user-name { font-size: 11px; min-width: 44px; }

  .sc-user-details { gap: 6px; }
  .sc-user-inc, .sc-user-exp { font-size: 10px; }
  .sc-user-bal {
    font-size: 10px;
    padding: 1px 6px;
  }
}
</style>