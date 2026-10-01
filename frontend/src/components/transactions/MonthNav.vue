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
/* ============================================================
   ✅ Контейнер — стеклянный с многослойной тенью
   ============================================================ */
.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 16px;

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(250, 251, 255, 0.94) 100%
  );

  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);

  border: 1px solid rgba(226, 232, 240, 0.8);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.05),
    0 8px 20px -6px rgba(15, 23, 42, 0.08),
    0 16px 32px -14px rgba(99, 102, 241, 0.15);

  transition: box-shadow 0.3s ease, transform 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.06) inset,
      0 4px 10px rgba(15, 23, 42, 0.06),
      0 12px 28px -8px rgba(99, 102, 241, 0.22),
      0 20px 40px -16px rgba(15, 23, 42, 0.1);
  }
}

/* ============================================================
   ✅ Стрелки — рельефные, с подъёмом
   ============================================================ */
.mn-arrow {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);

  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: var(--text);
  font-size: 13px;
  font-weight: 800;

  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    -1px -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.06),
    0 4px 10px -2px rgba(15, 23, 42, 0.08);

  transition: all 0.18s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    background: linear-gradient(180deg, #eef2ff, #e0e7ff);
    border-color: rgba(99, 102, 241, 0.4);
    color: #6366f1;
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 4px 10px -2px rgba(99, 102, 241, 0.3),
      0 8px 16px -4px rgba(99, 102, 241, 0.2);
  }

  &:active {
    transform: translateY(0) scale(0.95);
    box-shadow:
      0 2px 4px rgba(15, 23, 42, 0.1) inset;
  }
}

/* ============================================================
   МЕТКА МЕСЯЦА
   ============================================================ */
.month-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  text-align: center;
}

.month-name {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  color: #0f172a;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
}

/* ✅ Зелёная плашка — объёмная */
.today-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, #dcfce7, #bbf7d0);
  color: #166534;
  border: 1px solid rgba(34, 197, 94, 0.35);
  font-size: 10.5px;
  font-weight: 800;
  white-space: nowrap;
  letter-spacing: 0.02em;
  line-height: 1.4;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 2px 4px rgba(34, 197, 94, 0.15);
}

/* ============================================================
   ✅ Кнопка «Сегодня» — рельефная
   ============================================================ */
.today-btn {
  padding: 0 16px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);

  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.06),
    0 4px 10px -2px rgba(15, 23, 42, 0.08);

  transition: all 0.18s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    background: linear-gradient(180deg, #eef2ff, #e0e7ff);
    border-color: rgba(99, 102, 241, 0.4);
    color: #6366f1;
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 4px 10px -2px rgba(99, 102, 241, 0.3),
      0 8px 16px -4px rgba(99, 102, 241, 0.2);
  }

  &:active {
    transform: translateY(0) scale(0.96);
    box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1) inset;
  }
}

/* ============================================================
   ✅ Кнопка удаления — рельефная красная
   ============================================================ */
.del-month-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  font-size: 16px;
  border: 1px solid rgba(226, 232, 240, 0.9);

  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: var(--muted);
  border-radius: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.06),
    0 4px 10px -2px rgba(15, 23, 42, 0.08);

  transition: all 0.18s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    background: linear-gradient(180deg, #fef2f2, #fee2e2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #dc2626;
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 4px 10px -2px rgba(239, 68, 68, 0.3),
      0 8px 16px -4px rgba(239, 68, 68, 0.2);
  }

  &:active {
    transform: translateY(0) scale(0.95);
    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2) inset;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
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
    padding: 8px 10px;
    gap: 6px;
    border-radius: 14px;
  }

  .mn-arrow {
    width: 34px;
    height: 34px;
    font-size: 12px;
    border-radius: 10px;
  }

  .month-name {
    font-size: 13.5px;
  }

  .today-badge {
    font-size: 9.5px;
    padding: 2px 8px;
  }

  .today-btn {
    height: 34px;
    padding: 0 12px;
    font-size: 11px;
    border-radius: 10px;
  }

  .desktop-only {
    display: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .month-nav,
  .mn-arrow,
  .today-btn,
  .del-month-btn { transition: none !important; transform: none !important; }
}
</style>