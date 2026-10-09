<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { useAuthStore } from '@/stores/auth';
import { fmt } from '@/composables/useFormat';

const tx = useTransactionsStore();
const auth = useAuthStore();

const LS_KEY = 'financeProUsersCollapsed_v1';
const collapsed = ref(true);

function displayUser(technicalUser) {
  return auth.nameFor(technicalUser);
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) collapsed.value = saved === '1';
  } catch (e) {}
});

watch(collapsed, (val) => {
  try { localStorage.setItem(LS_KEY, val ? '1' : '0'); } catch (e) {}
});

function toggle() { collapsed.value = !collapsed.value; }

const income = computed(() => Number(tx.summary?.income) || 0);
const expense = computed(() => Number(tx.summary?.expense) || 0);
const balance = computed(() => Number(tx.summary?.balance) || 0);

const balanceClass = computed(() => {
  const b = balance.value;
  return b > 0 ? 'positive' : b < 0 ? 'negative' : '';
});
</script>

<template>
  <div class="summary-compact" :class="{ collapsed }">
    <div class="sc-top">
      <div class="sc-item">
        <span class="sc-icon">📈</span>
        <span class="sc-value income">{{ fmt(income) }} ₽</span>
        <span class="sc-label">доходы</span>
      </div>
      <div class="sc-divider"></div>
      <div class="sc-item">
        <span class="sc-icon">📉</span>
        <span class="sc-value expense">{{ fmt(expense) }} ₽</span>
        <span class="sc-label">расходы</span>
      </div>
      <div class="sc-divider"></div>
      <div class="sc-item">
        <span class="sc-icon">💰</span>
        <span class="sc-value" :class="balanceClass">{{ fmt(balance) }} ₽</span>
        <span class="sc-label">баланс</span>
      </div>
    </div>

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
        <span class="sc-user-name">{{ displayUser(user) }}</span>
        <span class="sc-user-details">
          <span class="sc-user-inc">+{{ fmt(data.income) }} ₽</span>
          <span class="sc-user-exp">−{{ fmt(data.expense) }} ₽</span>
          <span
            class="sc-user-bal"
            :class="(data.income - data.expense) >= 0 ? 'positive' : 'negative'"
          >{{ fmt(data.income - data.expense) }} ₽</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
   КОНТЕЙНЕР — в СВЕТЛОЙ теме светлый, в ТЁМНОЙ — тёмный
   ============================================================ */
.summary-compact {
  position: relative;
  padding: 14px 16px;
  border-radius: 16px;

  /* Светлая тема */
  background:
    radial-gradient(circle at 100% 0%, rgba(34, 197, 94, 0.06), transparent 50%),
    linear-gradient(180deg, #ffffff 0%, #fafbff 100%);
  border: 1px solid rgba(226, 232, 240, 0.8);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.05),
    0 8px 20px -6px rgba(15, 23, 42, 0.08),
    0 16px 32px -14px rgba(34, 197, 94, 0.15);

  transition:
    transform 0.3s cubic-bezier(.34,1.56,.64,1),
    box-shadow 0.3s ease,
    background 0.3s ease,
    border-color 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.06) inset,
      0 4px 10px rgba(15, 23, 42, 0.06),
      0 12px 28px -8px rgba(34, 197, 94, 0.22),
      0 20px 40px -16px rgba(15, 23, 42, 0.1);
  }

  &.collapsed { padding: 14px 16px 12px; }
}

/* ✅ ТЁМНАЯ ТЕМА */
:global(:root[data-app-theme="dark"]) .summary-compact {
  background:
    radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.08), transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(34, 211, 238, 0.05), transparent 50%),
    linear-gradient(180deg, rgba(30, 16, 48, 0.9) 0%, rgba(20, 9, 31, 0.95) 100%);
  border-color: rgba(139, 92, 246, 0.15);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.35),
    0 12px 28px -8px rgba(139, 92, 246, 0.25),
    0 0 0 1px rgba(139, 92, 246, 0.08) inset;
}

:global(:root[data-app-theme="dark"]) .summary-compact:hover {
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.45),
    0 20px 48px -10px rgba(168, 85, 247, 0.35),
    0 0 0 1px rgba(139, 92, 246, 0.2) inset;
}

.sc-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}

.sc-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sc-icon { font-size: 13px; opacity: 0.85; }

.sc-value {
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s ease;
  color: var(--text);

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
  font-weight: 800;
}

.sc-divider {
  width: 1px;
  height: 32px;
  background: linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.3), transparent);
}

:global(:root[data-app-theme="dark"]) .sc-divider {
  background: linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.3), transparent);
}

.sc-users-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(148, 163, 184, 0.3);
  cursor: pointer;
  user-select: none;

  &:hover .sc-users-title { color: var(--accent); }
}

:global(:root[data-app-theme="dark"]) .sc-users-header {
  border-top-color: rgba(139, 92, 246, 0.2);
}

.sc-users-icon { font-size: 14px; flex-shrink: 0; }

.sc-users-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  flex: 1;
  transition: color 0.15s;
}

.sc-toggle {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.18s cubic-bezier(.34,1.56,.64,1);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 2px 4px rgba(15, 23, 42, 0.06);

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(139, 92, 246, 0.1);
    transform: translateY(-1px);
  }

  .chev {
    width: 12px;
    height: 12px;
    fill: currentColor;
    transition: transform 0.25s;
  }
  .chev.open { transform: rotate(180deg); }
}

:global(:root[data-app-theme="dark"]) .sc-toggle {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(139, 92, 246, 0.2);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.03) inset,
    0 2px 6px rgba(0, 0, 0, 0.4);
}

.sc-users {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
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
  padding: 8px 10px;
  margin: 0 -4px;
  border-radius: 10px;
  font-size: 12px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.8), rgba(241, 245, 249, 0.5));
  border: 1px solid rgba(226, 232, 240, 0.6);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 1px 3px rgba(15, 23, 42, 0.03);

  transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.3s ease, border-color 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 4px 10px -2px rgba(15, 23, 42, 0.08);
  }
}

:global(:root[data-app-theme="dark"]) .sc-user-row {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  border-color: rgba(139, 92, 246, 0.12);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.03) inset,
    0 2px 6px rgba(0, 0, 0, 0.3);
}

.sc-user-avatar { font-size: 14px; }

.sc-user-name {
  font-weight: 800;
  min-width: 52px;
  color: var(--text);
}

.sc-user-details {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: nowrap;
}

.sc-user-inc,
.sc-user-exp {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.sc-user-inc { color: #16a34a; }
.sc-user-exp { color: #dc2626; }

.sc-user-bal {
  padding: 3px 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(224, 242, 254, 1), rgba(186, 230, 253, 0.7));
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #0284c7;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 2px 4px rgba(56, 189, 248, 0.12);

  &.positive {
    color: #16a34a;
    background: linear-gradient(180deg, #dcfce7, #bbf7d0);
    border-color: rgba(34, 197, 94, 0.3);
  }
  &.negative {
    color: #dc2626;
    background: linear-gradient(180deg, #fee2e2, #fecaca);
    border-color: rgba(239, 68, 68, 0.3);
  }
}

/* ✅ Тёмная тема — свечения и цвета */
:global(:root[data-app-theme="dark"]) {
  .sc-value.income,
  .sc-value.positive {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
  }
  .sc-value.expense,
  .sc-value.negative {
    color: #f43f5e;
    text-shadow: 0 0 10px rgba(244, 63, 94, 0.4);
  }

  .sc-user-inc {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
  }
  .sc-user-exp {
    color: #f43f5e;
    text-shadow: 0 0 10px rgba(244, 63, 94, 0.4);
  }

  .sc-user-bal {
    &.positive {
      color: #4ade80;
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(74, 222, 128, 0.35);
      box-shadow: 0 0 12px rgba(74, 222, 128, 0.2);
    }
    &.negative {
      color: #f43f5e;
      background: rgba(244, 63, 94, 0.15);
      border-color: rgba(244, 63, 94, 0.35);
      box-shadow: 0 0 12px rgba(244, 63, 94, 0.2);
    }
  }
}

@media (max-width: 700px) {
  .summary-compact { padding: 12px 14px; border-radius: 14px; }
  .sc-top { gap: 6px; }
  .sc-icon { font-size: 12px; }
  .sc-value { font-size: 14px; }
  .sc-label { font-size: 8.5px; letter-spacing: 0.05em; }
  .sc-divider { height: 28px; }

  .sc-users-header { margin-top: 10px; padding-top: 10px; gap: 6px; }
  .sc-users-icon { font-size: 12px; }
  .sc-users-title { font-size: 10px; }
  .sc-toggle { width: 24px; height: 24px; }
  .sc-toggle .chev { width: 11px; height: 11px; }

  .sc-user-row { padding: 6px 8px; margin: 0 -2px; gap: 6px; }
  .sc-user-avatar { font-size: 13px; }
  .sc-user-name { font-size: 11px; min-width: 44px; }
  .sc-user-details { gap: 6px; }
  .sc-user-inc, .sc-user-exp { font-size: 10px; }
  .sc-user-bal { font-size: 10px; padding: 2px 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .summary-compact,
  .sc-user-row,
  .sc-toggle { transition: none !important; transform: none !important; }
}
</style>