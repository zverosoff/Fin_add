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
.summary-compact {
  position: relative;
  padding: 14px 16px;
  border-radius: 16px;

  background: var(--grad-card);
  border: 1px solid var(--border);

  box-shadow: var(--shadow-md);

  transition:
    transform 0.3s cubic-bezier(.34,1.56,.64,1),
    box-shadow 0.3s ease,
    background 0.3s ease,
    border-color 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  &.collapsed { padding: 14px 16px 12px; }
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

  &.income {
    color: var(--accent-2, #16a34a);
  }
  &.expense {
    color: var(--danger, #dc2626);
  }
  &.positive { color: var(--accent-2, #16a34a); }
  &.negative { color: var(--danger, #dc2626); }
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
  background: linear-gradient(180deg, transparent, var(--border), transparent);
}

.sc-users-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
  cursor: pointer;
  user-select: none;

  &:hover .sc-users-title { color: var(--accent); }
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
  box-shadow: var(--shadow-sm);

  &:hover {
    background: var(--grad-primary);
    color: #ffffff;
    border-color: transparent;
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
  background: var(--panel-2);
  border: 1px solid var(--border);

  box-shadow: var(--shadow-sm);

  transition: transform 0.15s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
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
.sc-user-inc { color: var(--accent-2, #16a34a); }
.sc-user-exp { color: var(--danger, #dc2626); }

.sc-user-bal {
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--accent);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;

  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset;

  &.positive {
    color: var(--accent-2, #16a34a);
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
  }
  &.negative {
    color: var(--danger, #dc2626);
    background: rgba(244, 63, 94, 0.15);
    border-color: rgba(244, 63, 94, 0.3);
  }
}

/* Тёмная тема — доп. неон */
:global(:root[data-app-theme="dark"]) {
  .summary-compact {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 12px 28px -8px rgba(139, 92, 246, 0.25),
      0 0 0 1px rgba(139, 92, 246, 0.08) inset;
  }

  .summary-compact:hover {
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.45),
      0 20px 48px -10px rgba(168, 85, 247, 0.35),
      0 0 0 1px rgba(139, 92, 246, 0.2) inset;
  }

  .sc-value {
    &.income, &.positive {
      color: #4ade80;
      text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
    }
    &.expense, &.negative {
      color: #f43f5e;
      text-shadow: 0 0 10px rgba(244, 63, 94, 0.4);
    }
  }

  .sc-user-row {
    background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
    border-color: rgba(139, 92, 246, 0.12);
  }

  .sc-user-inc { color: #4ade80; text-shadow: 0 0 10px rgba(74, 222, 128, 0.4); }
  .sc-user-exp { color: #f43f5e; text-shadow: 0 0 10px rgba(244, 63, 94, 0.4); }

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

  .sc-toggle {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(139, 92, 246, 0.2);
    color: #8b8ba0;
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