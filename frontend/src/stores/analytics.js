import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAccountsStore } from './accounts';

export const useAnalyticsStore = defineStore('analytics', () => {
  const accountsStore = useAccountsStore();

  // Период: 1 | 3 | 6 | 12 | 'all'
  const periodMonths = ref(6);

  // ============================================================
  // Диапазон дат
  // ============================================================
  const dateRange = computed(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    if (periodMonths.value === 'all') {
      const dates = accountsStore.transactions
        .filter(t => !t.fixed)
        .map(t => new Date(t.date).getTime())
        .filter(isFinite);
      const min = dates.length ? Math.min(...dates) : Date.now();
      const start = new Date(min);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    const start = new Date(end);
    start.setMonth(start.getMonth() - periodMonths.value + 1);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  });

  // ============================================================
  // Транзакции периода
  // ============================================================
  const periodTransactions = computed(() => {
    const { start, end } = dateRange.value;
    return accountsStore.transactions.filter(t => {
      if (t.fixed) return false;
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
  });

  // ============================================================
  // Агрегация по месяцам
  // ============================================================
  const monthlyData = computed(() => {
    const { start, end } = dateRange.value;
    const map = new Map();

    const cursor = new Date(start);
    cursor.setDate(1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, {
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
        income: 0,
        expense: 0,
        balance: 0,
        count: 0,
        label: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'][cursor.getMonth()],
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const t of periodTransactions.value) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = map.get(key);
      if (!bucket) continue;
      if (t.type === 'income') bucket.income += t.amount;
      else bucket.expense += t.amount;
      bucket.count++;
    }

    let cumulative = 0;
    const result = Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    for (const m of result) {
      cumulative += m.income - m.expense;
      m.balance = cumulative;
    }

    return result;
  });

  // ============================================================
  // Метрики за текущий месяц
  // ============================================================
  const currentMonthMetrics = computed(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthTxs = accountsStore.transactions.filter(t => {
      if (t.fixed) return false;
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    let income = 0, expense = 0;
    for (const t of monthTxs) {
      if (t.fromReconcile) continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }

    const save = income - expense;
    const saveRate = income > 0 ? (save / income) * 100 : 0;
    const accountsTotal = accountsStore.accounts.reduce((s, a) => s + (Number(a.value) || 0), 0);

    // ✅ Средний расход по НЕПУСТЫМ месяцам (защита от NaN)
    const nonEmpty = monthlyData.value.filter(m => m.count > 0);
    const avgExpense = nonEmpty.length
      ? nonEmpty.reduce((s, m) => s + m.expense, 0) / nonEmpty.length
      : 0;

    const runway = avgExpense > 0 ? accountsTotal / avgExpense : 0;

    const dayOfMonth = now.getDate();
    const dailyAvg = dayOfMonth > 0 ? expense / dayOfMonth : 0;

    return {
      monthIncome: income,
      monthExpense: expense,
      monthSave: save,
      monthSaveRate: saveRate,
      monthName: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][now.getMonth()],
      accountsTotal,
      avgExpense,
      runway,
      dailyAvg,
    };
  });

  // ============================================================
  // Сравнение с прошлым периодом
  // ============================================================
  const comparison = computed(() => {
    const current = periodTransactions.value;
    const { start, end } = dateRange.value;
    const duration = end.getTime() - start.getTime();

    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);

    const prev = accountsStore.transactions.filter(t => {
      if (t.fixed) return false;
      const d = new Date(t.date);
      return d >= prevStart && d <= prevEnd;
    });

    const sumBy = (arr, type) =>
      arr.filter(t => t.type === type && !t.fromReconcile)
        .reduce((s, t) => s + t.amount, 0);

    return {
      curr: {
        income: sumBy(current, 'income'),
        expense: sumBy(current, 'expense'),
      },
      prev: {
        income: sumBy(prev, 'income'),
        expense: sumBy(prev, 'expense'),
      },
    };
  });

  // ============================================================
  // Изменение периода
  // ============================================================
  function setPeriod(months) {
    periodMonths.value = months;
  }

  return {
    periodMonths,
    dateRange,
    periodTransactions,
    monthlyData,
    currentMonthMetrics,
    comparison,
    setPeriod,
  };
});