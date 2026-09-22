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

// Дата для зелёной плашки
const todayDate = computed(() => {
  const now = new Date();
  return now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '');
});

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
    for (const t of monthTxs) {
      if (!t.accountId) continue;
      const acc = accountsStore.accounts.find(a => a.id === t.accountId);
      if (!acc) continue;
      acc.value += (t.type === 'income' ? -t.amount : t.amount);
    }

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

    await api.post('/state', { accounts: accountsStore.accounts });

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
    <button class="mn-arrow" @click="tx.prevMonth()" aria-label="Предыдущий месяц">◀</button>

    <!-- ✅ Метка месяца + зелёный бейдж на новой строке -->
    <div class="month-label">
      <span class="month-name">{{ label }}</span>
      <span v-if="isCurrentMonth" class="today-badge">
        сегодня · {{ todayDate }}
      </span>
    </div>

    <button class="mn-arrow" @click="tx.nextMonth()" aria-label="Следующий месяц">▶</button>

    <button class="today-btn" @click="tx.goToday()">Сегодня</button>

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
}

.mn-arrow {
  background: #f1f5f9;
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background: rgba(56, 189, 248, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }
  &:active { transform: scale(0.94); }
}

/* ✅ Метка — колонка из двух строк */
.month-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  text-align: center;
}

.month-name {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ✅ Зелёная плашка — вторая строка */
.today-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.35);
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.02em;
  line-height: 1.4;
}

.today-btn {
  background: #f1f5f9;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 14px;
  height: 36px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background: rgba(56, 189, 248, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }
  &:active { transform: scale(0.97); }
}

.del-month-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(239, 68, 68, 0.08);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.desktop-only {
  display: inline-flex;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .month-nav {
    padding: 6px 8px;
    gap: 6px;
    border-radius: 12px;
  }

  .mn-arrow {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .month-name {
    font-size: 13px;
  }

  .today-badge {
    font-size: 9.5px;
    padding: 1px 8px;
  }

  .today-btn {
    height: 32px;
    padding: 0 10px;
    font-size: 11px;
  }

  .desktop-only {
    display: none !important;
  }
}
</style>