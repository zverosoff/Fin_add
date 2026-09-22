<script setup>
import { computed, ref } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { useAccountsStore } from '@/stores/accounts';
import { useToast } from '@/composables/useToast';
import { fmt, fmtMonth } from '@/composables/useFormat';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import { api } from '@/api/client';

const tx = useTransactionsStore();
const accountsStore = useAccountsStore();
const toast = useToast();

const deleting = ref(false);

const label = computed(() => fmtMonth(tx.currentMonth));

const isCurrentMonth = computed(() => {
  const now = new Date();
  const cur = tx.currentMonth;
  return now.getMonth() === cur.getMonth() && now.getFullYear() === cur.getFullYear();
});

// ============================================================
// Удалить все операции за месяц
// ============================================================
async function deleteMonth() {
  const monthDate = tx.currentMonth;
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthTxs = (accountsStore.transactions || []).filter(t => {
    const d = new Date(t.date);
    return d >= start && d <= end && !t.fixed;
  });

  if (monthTxs.length === 0) {
    toast.info('За этот месяц нет операций');
    return;
  }

  const mName = fmtMonth(monthDate);
  const incSum = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expSum = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const ok = confirm(
    `Удалить все операции за ${mName}?\n\n` +
    `Операций: ${monthTxs.length}\n` +
    `Доходы: ${fmt(incSum)} ₽\n` +
    `Расходы: ${fmt(expSum)} ₽\n\n` +
    `Балансы счетов будут скорректированы.\n` +
    `Это действие нельзя отменить.`
  );
  if (!ok) return;

  deleting.value = true;

  try {
    // 1. Корректируем балансы счетов
    for (const t of monthTxs) {
      if (!t.accountId) continue;
      const acc = accountsStore.accounts.find(a => a.id === t.accountId);
      if (!acc) continue;
      acc.value += (t.type === 'income' ? -t.amount : t.amount);
    }

    // 2. Удаляем на сервере
    let deleted = 0;
    let failed = 0;
    for (const t of monthTxs) {
      try {
        await api.delete(`/transactions?id=${encodeURIComponent(t.id)}`);
        deleted++;
      } catch (e) {
        failed++;
        console.warn('delete failed:', t.id, e);
      }
    }

    // 3. Сохраняем балансы
    await api.post('/state', { accounts: accountsStore.accounts });

    // 4. Убираем из локального стейта
    const delIds = new Set(monthTxs.map(t => t.id));
    accountsStore.transactions = accountsStore.transactions.filter(t => !delIds.has(t.id));

    notifySaved();
    toast.success(
      `🗑 Удалено ${deleted} операций${failed ? ` (ошибок: ${failed})` : ''}`
    );
  } catch (e) {
    notifyError(e.message);
    toast.error('Ошибка удаления: ' + e.message);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="month-nav">
    <button @click="tx.prevMonth()" aria-label="Предыдущий месяц">◀</button>

    <div class="month-label">
      <span>{{ label }}</span>
      <small v-if="isCurrentMonth" class="today-mark">сегодня</small>
    </div>

    <button @click="tx.nextMonth()" aria-label="Следующий месяц">▶</button>

    <button class="today-btn" @click="tx.goToday()">Сегодня</button>

    <!-- Удалить месяц — только иконка, только на ПК -->
    <button
      class="del-month-btn desktop-only"
      type="button"
      :disabled="deleting"
      @click="deleteMonth"
      title="Удалить все операции за месяц"
      aria-label="Удалить все операции за месяц"
    >
      🗑
    </button>
  </div>
</template>

<style scoped lang="scss">
.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  background:
    linear-gradient(180deg, rgba(139, 92, 246, 0.05), transparent 60%),
    rgba(255, 255, 255, 0.95);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 8px 12px;
  box-shadow: var(--shadow-md);
  /* НЕТ flex-wrap — всё в одну строку */
}

.month-nav button {
  background: #f1f5f9;
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    background: rgba(56, 189, 248, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }
  &:active { transform: scale(0.94); }
}

.month-label {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .today-mark {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 700;
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.35);
    vertical-align: middle;
  }
}

.today-btn {
  width: auto !important;
  padding: 0 14px !important;
  font-size: 12px !important;
  white-space: nowrap;
}

.del-month-btn {
  width: 36px !important;
  padding: 0 !important;
  font-size: 16px !important;
  background: transparent !important;
  border: 1px solid var(--border) !important;
  color: var(--muted) !important;
  transition: all 0.15s;

  &:hover {
    border-color: var(--danger) !important;
    color: var(--danger) !important;
    background: rgba(239, 68, 68, 0.08) !important;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* Скрываем на мобильных */
.desktop-only {
  display: inline-flex;
}

@media (max-width: 700px) {
  .month-nav {
    padding: 6px 8px;
    gap: 6px;
    border-radius: 12px;
  }

  .month-nav button {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .month-label {
    font-size: 13px;
    min-width: 0;

    .today-mark {
      font-size: 9px;
      padding: 1px 6px;
      margin-left: 5px;
    }
  }

  .today-btn {
    padding: 0 10px !important;
    font-size: 11px !important;
  }

  .desktop-only {
    display: none !important;
  }
}
</style>