import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import { useAccountsStore } from './accounts';
import { useFiltersStore } from './filters';

export const useTransactionsStore = defineStore('transactions', () => {
  const accountsStore = useAccountsStore();
  const filtersStore = useFiltersStore();

  const loading = ref(false);
  const currentMonth = ref(new Date());

  const monthTransactions = computed(() => {
    const start = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1);
    const end = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 0, 23, 59, 59, 999);

    return accountsStore.transactions.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
  });

  const filtered = computed(() => {
    let list = monthTransactions.value;
    const f = filtersStore.filters;

    if (f.type !== 'all')     list = list.filter(t => t.type === f.type);
    if (f.user !== 'all')     list = list.filter(t => t.user === f.user);
    if (f.account !== 'all')  list = list.filter(t => t.accountId === f.account);
    if (f.category !== 'all') list = list.filter(t => t.category === f.category);
    if (f.search) {
      const q = f.search.toLowerCase();
      list = list.filter(t => (t.name || '').toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  const groupedByDay = computed(() => {
    const groups = {};
    for (const t of filtered.value) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = { date: d, key, items: [], sum: 0 };
      }
      groups[key].items.push(t);
      groups[key].sum += (t.type === 'income' ? t.amount : -t.amount);
    }
    return Object.values(groups).sort((a, b) => b.date - a.date);
  });

  const summary = computed(() => {
    let income = 0, expense = 0;
    for (const t of monthTransactions.value) {
      if (t.fromReconcile) continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  });

  const byUser = computed(() => {
    const result = {
      'Сергей': { income: 0, expense: 0 },
      'Саша':   { income: 0, expense: 0 },
    };
    for (const t of monthTransactions.value) {
      if (t.fromReconcile) continue;
      if (!result[t.user]) result[t.user] = { income: 0, expense: 0 };
      if (t.type === 'income') result[t.user].income += t.amount;
      else result[t.user].expense += t.amount;
    }
    return result;
  });

  function setMonth(date) { currentMonth.value = date; }

  function prevMonth() {
    const d = new Date(currentMonth.value);
    d.setMonth(d.getMonth() - 1);
    currentMonth.value = d;
  }

  function nextMonth() {
    const d = new Date(currentMonth.value);
    d.setMonth(d.getMonth() + 1);
    currentMonth.value = d;
  }

  function goToday() { currentMonth.value = new Date(); }

  // ✅ Нормализуем payload перед отправкой, чтобы 500 не возникал из-за CHECK/NOT NULL
  async function save(tx) {
    loading.value = true;
    try {
      const amountNum = Number(tx.amount);
      const dateObj = new Date(tx.date);

      const payload = {
        ...tx,
        name: String(tx.name ?? '').trim() || 'Операция',
        amount: (isFinite(amountNum) && amountNum > 0) ? Math.round(amountNum * 100) / 100 : 0,
        type: tx.type === 'income' ? 'income' : 'expense',
        category: String(tx.category ?? '').trim() || 'Прочее',
        date: isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString(),
        user: tx.user ? String(tx.user) : null,
        accountId: tx.accountId ? String(tx.accountId) : null,
      };

      if (payload.amount <= 0) {
        throw new Error('Сумма должна быть больше 0');
      }

      const { data } = await api.post('/transactions', payload);
      if (!data.ok) throw new Error(data.error);
      return data.transaction;
    } finally {
      loading.value = false;
    }
  }

  async function remove(id) {
    loading.value = true;
    try {
      const { data } = await api.delete(`/transactions?id=${encodeURIComponent(id)}`);
      if (!data.ok) throw new Error(data.error);
      return true;
    } finally {
      loading.value = false;
    }
  }

  async function restore(tx) {
    return save(tx);
  }

  return {
    loading, currentMonth,
    monthTransactions, filtered, groupedByDay, summary, byUser,
    setMonth, prevMonth, nextMonth, goToday,
    save, remove, restore,
  };
});