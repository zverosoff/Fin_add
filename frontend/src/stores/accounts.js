// frontend/src/stores/accounts.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import {
  computeDiff,
  computeExpectedBalance,
  computeUserDiff,
} from '@/composables/useBalance';

const OWNERS = ['Сергей', 'Саша'];
const CASH_ACCOUNT_ID = 'cash';   // одна общая «касса» наличных

// ✅ Нормализация наличных (legacy-число → объект)
function normalizeCashOwner(raw) {
  if (raw && typeof raw === 'object') {
    return {
      balance: Number(raw.balance) || 0,
      savings: Number(raw.savings) || 0,
    };
  }
  return { balance: Number(raw) || 0, savings: 0 };
}

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref([]);
  const transactions = ref([]);
  const goals = ref([]);

  // ✅ Наличные: { Сергей: { balance, savings }, Саша: { balance, savings } }
  const cashBalances = ref({
    Сергей: { balance: 0, savings: 0 },
    Саша:   { balance: 0, savings: 0 },
  });

  const loaded = ref(false);

  // ============================================================
  // Сортировка
  // ============================================================
  function sortAccounts(list) {
    return [...list].sort((a, b) => {
      const bankOrder = (id) => {
        if (!id) return 2;
        if (id.startsWith('tbank')) return 0;
        if (id.startsWith('sber')) return 1;
        return 2;
      };
      const aBank = bankOrder(a.id);
      const bBank = bankOrder(b.id);
      if (aBank !== bBank) return aBank - bBank;
      return (a.owner || '').localeCompare(b.owner || '', 'ru');
    });
  }

  // ============================================================
  // Базовые computed
  // ============================================================
  const total = computed(() =>
    accounts.value.reduce((sum, a) => sum + (Number(a.value) || 0), 0)
  );

  const byOwner = computed(() => {
    const map = {};
    for (const acc of accounts.value) {
      const owner = acc.owner || 'Сергей';
      if (!map[owner]) map[owner] = [];
      map[owner].push(acc);
    }
    return map;
  });

  const byId = computed(() => {
    const map = {};
    for (const acc of accounts.value) map[acc.id] = acc;
    return map;
  });

  const totalByOwner = computed(() => {
    const result = {};
    for (const [owner, list] of Object.entries(byOwner.value)) {
      result[owner] = list.reduce((s, a) => s + (Number(a.value) || 0), 0);
    }
    return result;
  });

  // ============================================================
  // ✅ НАЛИЧНЫЕ
  // ============================================================
  const totalCash = computed(() =>
    OWNERS.reduce((s, o) => s + (Number(cashBalances.value[o]?.balance) || 0), 0)
  );

  const totalCashSavings = computed(() =>
    OWNERS.reduce((s, o) => s + (Number(cashBalances.value[o]?.savings) || 0), 0)
  );

  const totalCashAll = computed(() =>
    totalCash.value + totalCashSavings.value
  );

  const cashByOwner = computed(() => {
    const result = {};
    for (const owner of OWNERS) {
      result[owner] = Number(cashBalances.value[owner]?.balance) || 0;
    }
    return result;
  });

  const savingsByOwner = computed(() => {
    const result = {};
    for (const owner of OWNERS) {
      result[owner] = Number(cashBalances.value[owner]?.savings) || 0;
    }
    return result;
  });

  function getCash(owner) {
    return Number(cashBalances.value[owner]?.balance) || 0;
  }

  function getCashSavings(owner) {
    return Number(cashBalances.value[owner]?.savings) || 0;
  }

  // ============================================================
  // Расхождения
  // ============================================================
  const expectedByAccount = computed(() => {
    const map = {};
    for (const acc of accounts.value) {
      map[acc.id] = computeExpectedBalance(acc, transactions.value);
    }
    return map;
  });

  const diffByAccount = computed(() => {
    const map = {};
    for (const acc of accounts.value) {
      map[acc.id] = computeDiff(acc, transactions.value);
    }
    return map;
  });

  const hasAnyDiff = computed(() =>
    Object.values(diffByAccount.value).some(d => d.hasDiff)
  );

  const userDiffs = computed(() => {
    const users = ['Сергей', 'Саша'];
    return users.map(u => computeUserDiff(u, accounts.value, transactions.value));
  });

  const usersWithDiff = computed(() =>
    userDiffs.value.filter(u => u.hasDiff)
  );

  // ============================================================
  // Загрузка
  // ============================================================
  async function load(onProgress) {
    onProgress?.(10, 'Подключение к серверу…');
    const { data } = await api.get('/state');

    onProgress?.(50, 'Обработка счетов…');
    accounts.value = sortAccounts(data.accounts ?? []);

    onProgress?.(70, 'Обработка операций…');
    transactions.value = data.transactions ?? [];

    onProgress?.(85, 'Обработка целей…');
    goals.value = data.goals ?? [];

    // ✅ Наличные
    if (data.cash && typeof data.cash === 'object') {
      cashBalances.value = {
        Сергей: normalizeCashOwner(data.cash.Сергей),
        Саша:   normalizeCashOwner(data.cash.Саша),
      };
    }

    loaded.value = true;

    onProgress?.(95, 'Пересчёт балансов…');
    recalculate();

    onProgress?.(100, 'Готово!');
  }

  function recalculate() {
    for (const acc of accounts.value) {
      const opening = Number(acc.openingBalance) || 0;
      const delta = transactions.value
        .filter(t => t.accountId === acc.id && !t.fixed && !t.fromReconcile)
        .reduce((sum, t) =>
          sum + (t.type === 'income' ? t.amount : -t.amount), 0);
      acc.value = opening + delta;
    }
  }

  function setFromWS(state) {
    accounts.value = sortAccounts(state.accounts ?? []);
    transactions.value = state.transactions ?? [];
    goals.value = state.goals ?? [];

    if (state.cash && typeof state.cash === 'object') {
      cashBalances.value = {
        Сергей: normalizeCashOwner(state.cash.Сергей),
        Саша:   normalizeCashOwner(state.cash.Саша),
      };
    }

    recalculate();
  }

  // ============================================================
  // Хелперы
  // ============================================================
  function getAccountName(id) {
    if (!id) return '';
    if (id === CASH_ACCOUNT_ID) return '💵 Наличные';
    const acc = byId.value[id];
    return acc ? acc.name : '';
  }

  function getBank(id) {
    if (!id) return null;
    if (id.startsWith('sber')) return 'sber';
    if (id.startsWith('tbank')) return 'tbank';
    if (id === CASH_ACCOUNT_ID) return 'cash';
    return null;
  }

  // ============================================================
  // ✅ Сохранение наличных на сервер
  // ============================================================
  async function saveCash() {
    const payload = {};
    for (const owner of OWNERS) {
      const cur = cashBalances.value[owner] || { balance: 0, savings: 0 };
      payload[owner] = {
        balance: Number(cur.balance) || 0,
        savings: Number(cur.savings) || 0,
      };
    }
    const { data } = await api.post('/state', { cash: payload });
    if (!data?.ok) throw new Error(data?.error || 'Не удалось сохранить наличные');
  }

  // ============================================================
  // ✅ Пополнение наличных
  // ============================================================
  async function addCash(owner, amount, comment = '') {
    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Сумма должна быть больше 0');
    }

    const tx = {
      name: comment?.trim() || 'Пополнение наличных',
      amount: value,
      type: 'income',
      category: 'Перевод между счетами',
      date: new Date().toISOString(),
      user: owner,
      accountId: CASH_ACCOUNT_ID,
      fromCash: true,
      internalTransfer: false,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);
    const cur = cashBalances.value[owner] || { balance: 0, savings: 0 };
    cashBalances.value = {
      ...cashBalances.value,
      [owner]: { ...cur, balance: cur.balance + value },
    };

    await saveCash();
    return data.transaction;
  }

  // ============================================================
  // ✅ Изъятие наличных
  // ============================================================
  async function withdrawCash(owner, amount, comment = '') {
    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Сумма должна быть больше 0');
    }

    const cur = cashBalances.value[owner] || { balance: 0, savings: 0 };
    if (value > cur.balance + 0.001) {
      throw new Error(`У ${owner} только ${cur.balance.toFixed(0)} ₽`);
    }

    const tx = {
      name: comment?.trim() || 'Изъятие наличных',
      amount: value,
      type: 'expense',
      category: 'Прочее',
      date: new Date().toISOString(),
      user: owner,
      accountId: CASH_ACCOUNT_ID,
      fromCash: true,
      internalTransfer: false,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);
    cashBalances.value = {
      ...cashBalances.value,
      [owner]: { ...cur, balance: cur.balance - value },
    };

    await saveCash();
    return data.transaction;
  }

  // ============================================================
  // ✅ Установить точный баланс наличных (сверка)
  // ============================================================
  async function setCashBalance(owner, newValue, comment = 'Сверка наличных') {
    const value = Number(newValue);
    if (!isFinite(value) || value < 0) {
      throw new Error('Баланс не может быть отрицательным');
    }

    const cur = cashBalances.value[owner] || { balance: 0, savings: 0 };
    const diff = value - cur.balance;

    if (Math.abs(diff) < 0.01) {
      return { ok: true, unchanged: true };
    }

    const tx = {
      name: comment?.trim() || 'Сверка наличных',
      amount: Math.abs(diff),
      type: diff > 0 ? 'income' : 'expense',
      category: 'Прочее',
      date: new Date().toISOString(),
      user: owner,
      accountId: CASH_ACCOUNT_ID,
      fromReconcile: true,
      internalTransfer: false,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);
    cashBalances.value = {
      ...cashBalances.value,
      [owner]: { ...cur, balance: value },
    };

    await saveCash();
    return data.transaction;
  }

  // ============================================================
  // ✅ КОПИЛКА — переложить из наличных в копилку
  // ============================================================
  async function toSavings(owner, amount, comment = '') {
    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Сумма должна быть больше 0');
    }

    const cur = cashBalances.value[owner] || { balance: 0, savings: 0 };
    if (value > cur.balance + 0.001) {
      throw new Error(`У ${owner} только ${cur.balance.toFixed(0)} ₽ наличными`);
    }

    const tx = {
      name: comment?.trim() || 'В копилку',
      amount: value,
      type: 'expense',
      category: 'Внутренний перевод',
      date: new Date().toISOString(),
      user: owner,
      accountId: CASH_ACCOUNT_ID,
      fromCash: true,
      internalTransfer: true,
      toSavings: true,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);
    cashBalances.value = {
      ...cashBalances.value,
      [owner]: {
        balance: cur.balance - value,
        savings: cur.savings + value,
      },
    };

    await saveCash();
    return data.transaction;
  }

  // ============================================================
  // ✅ КОПИЛКА — вернуть из копилки в наличные
  // ============================================================
  async function fromSavings(owner, amount, comment = '') {
    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Сумма должна быть больше 0');
    }

    const cur = cashBalances.value[owner] || { balance: 0, savings: 0 };
    if (value > cur.savings + 0.001) {
      throw new Error(`В копилке ${owner} только ${cur.savings.toFixed(0)} ₽`);
    }

    const tx = {
      name: comment?.trim() || 'Из копилки',
      amount: value,
      type: 'income',
      category: 'Внутренний перевод',
      date: new Date().toISOString(),
      user: owner,
      accountId: CASH_ACCOUNT_ID,
      fromCash: true,
      internalTransfer: true,
      fromSavings: true,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);
    cashBalances.value = {
      ...cashBalances.value,
      [owner]: {
        balance: cur.balance + value,
        savings: cur.savings - value,
      },
    };

    await saveCash();
    return data.transaction;
  }

  // ============================================================
  // ✅ КОПИЛКА — установить точный размер (сверка)
  // ============================================================
  async function setCashSavings(owner, newValue, comment = 'Сверка копилки') {
    const value = Number(newValue);
    if (!isFinite(value) || value < 0) {
      throw new Error('Сумма не может быть отрицательной');
    }

    const cur = cashBalances.value[owner] || { balance: 0, savings: 0 };
    if (Math.abs(value - cur.savings) < 0.01) {
      return { ok: true, unchanged: true };
    }

    const diff = value - cur.savings;

    const tx = {
      name: comment?.trim() || 'Сверка копилки',
      amount: Math.abs(diff),
      type: diff > 0 ? 'expense' : 'income',
      category: 'Внутренний перевод',
      date: new Date().toISOString(),
      user: owner,
      accountId: CASH_ACCOUNT_ID,
      fromReconcile: true,
      internalTransfer: true,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);
    cashBalances.value = {
      ...cashBalances.value,
      [owner]: { ...cur, savings: value },
    };

    await saveCash();
    return data.transaction;
  }

  // ============================================================
  // ✅ Статистика наличных (доходы/расходы за N дней)
  // ============================================================
  function cashStats(owner, periodDays = 30) {
    const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const ops = (transactions.value || []).filter(t =>
      t.accountId === CASH_ACCOUNT_ID &&
      t.user === owner &&
      !t.fromReconcile &&
      !t.internalTransfer &&
      new Date(t.date).getTime() >= since
    );

    let income = 0, expense = 0;
    for (const t of ops) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return {
      income,
      expense,
      balance: income - expense,
      count: ops.length,
    };
  }

  return {
    accounts,
    transactions,
    goals,
    cashBalances,
    loaded,

    total,
    byOwner,
    byId,
    totalByOwner,

    // Наличные
    totalCash,
    totalCashSavings,
    totalCashAll,
    cashByOwner,
    savingsByOwner,
    getCash,
    getCashSavings,
    addCash,
    withdrawCash,
    setCashBalance,
    toSavings,
    fromSavings,
    setCashSavings,
    cashStats,
    saveCash,

    // Расхождения
    expectedByAccount,
    diffByAccount,
    hasAnyDiff,
    userDiffs,
    usersWithDiff,

    load,
    recalculate,
    setFromWS,
    getAccountName,
    getBank,
  };
});