// src/stores/accounts.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import {
  computeDiff,
  computeExpectedBalance,
  computeUserDiff,
} from '@/composables/useBalance';

const CASH_ID_PREFIX = 'cash_';   // cash_Сергей, cash_Саша
const CASH_NAME = '💵 Наличные';
const OWNERS = ['Сергей', 'Саша'];

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref([]);
  const transactions = ref([]);
  const goals = ref([]);
  const loaded = ref(false);

  // ============================================================
  // ✅ Сортировка: Т-Банк → СберБанк → Наличные → остальные
  // ============================================================
  function sortAccounts(list) {
    return [...list].sort((a, b) => {
      const bankOrder = (id) => {
        if (!id) return 3;
        if (id.startsWith('tbank')) return 0;
        if (id.startsWith('sber')) return 1;
        if (id.startsWith(CASH_ID_PREFIX)) return 2;
        return 3;
      };
      const aBank = bankOrder(a.id);
      const bBank = bankOrder(b.id);
      if (aBank !== bBank) return aBank - bBank;
      return (a.owner || '').localeCompare(b.owner || '', 'ru');
    });
  }

  // ============================================================
  // Вычисляемые — базовые
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
  const cashAccounts = computed(() =>
    accounts.value.filter(a => a.id && a.id.startsWith(CASH_ID_PREFIX))
  );

  const totalCash = computed(() =>
    cashAccounts.value.reduce((s, a) => s + (Number(a.value) || 0), 0)
  );

  function cashIdFor(owner) {
    return CASH_ID_PREFIX + (owner || 'Сергей');
  }

  function getCashAccount(owner) {
    return cashAccounts.value.find(a => a.id === cashIdFor(owner)) || null;
  }

  const cashByOwner = computed(() => {
    const result = {};
    for (const owner of OWNERS) {
      const acc = getCashAccount(owner);
      result[owner] = {
        account: acc,
        value: acc ? Number(acc.value) || 0 : 0,
      };
    }
    return result;
  });

  // ============================================================
  // Вычисляемые — расхождения
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
  // Действия
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

    // ✅ Автосоздание счетов наличных, если их нет
    ensureCashAccounts();

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
    ensureCashAccounts();
    recalculate();
  }

  function getAccountName(id) {
    if (!id) return '';
    if (id.startsWith(CASH_ID_PREFIX)) return '💵 Наличные';
    const acc = byId.value[id];
    return acc ? acc.name : '';
  }

  function getBank(id) {
    if (!id) return null;
    if (id.startsWith('sber')) return 'sber';
    if (id.startsWith('tbank')) return 'tbank';
    if (id.startsWith(CASH_ID_PREFIX)) return 'cash';
    return null;
  }

  // ============================================================
  // ✅ Создание счетов наличных, если их ещё нет
  // ============================================================
  function ensureCashAccounts() {
    let changed = false;
    for (const owner of OWNERS) {
      const id = cashIdFor(owner);
      if (!accounts.value.find(a => a.id === id)) {
        accounts.value.push({
          id,
          name: CASH_NAME,
          owner,
          value: 0,
          openingBalance: 0,
          currency: 'RUB',
          isCash: true,
        });
        changed = true;
      }
    }
    if (changed) {
      accounts.value = sortAccounts(accounts.value);
    }
  }

  // ============================================================
  // ✅ Добавить наличные (пополнение)
  // ============================================================
  async function addCash(owner, amount, comment = '') {
    const acc = getCashAccount(owner);
    if (!acc) throw new Error('Счёт наличных не найден');

    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Сумма должна быть больше 0');
    }

    const tx = {
      name: comment || 'Пополнение наличных',
      amount: value,
      type: 'income',
      category: 'Перевод между счетами',
      date: new Date().toISOString(),
      user: owner,
      accountId: acc.id,
      fromCash: true,
      internalTransfer: false,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    // ✅ Локально обновляем
    transactions.value.push(data.transaction);
    recalculate();

    return data.transaction;
  }

  // ============================================================
  // ✅ Изъять наличные (расход)
  // ============================================================
  async function withdrawCash(owner, amount, comment = '') {
    const acc = getCashAccount(owner);
    if (!acc) throw new Error('Счёт наличных не найден');

    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Сумма должна быть больше 0');
    }

    const tx = {
      name: comment || 'Изъятие наличных',
      amount: value,
      type: 'expense',
      category: 'Прочее',
      date: new Date().toISOString(),
      user: owner,
      accountId: acc.id,
      fromCash: true,
      internalTransfer: false,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);
    recalculate();

    return data.transaction;
  }

  // ============================================================
  // ✅ Установить точный остаток наличных (сверка)
  // ============================================================
  async function setCashBalance(owner, newValue, comment = 'Сверка наличных') {
    const acc = getCashAccount(owner);
    if (!acc) throw new Error('Счёт наличных не найден');

    const value = Number(newValue);
    if (!isFinite(value) || value < 0) {
      throw new Error('Баланс не может быть отрицательным');
    }

    const current = Number(acc.value) || 0;
    const diff = value - current;

    if (Math.abs(diff) < 0.01) {
      return { ok: true, unchanged: true };
    }

    const tx = {
      name: comment,
      amount: Math.abs(diff),
      type: diff > 0 ? 'income' : 'expense',
      category: 'Прочее',
      date: new Date().toISOString(),
      user: owner,
      accountId: acc.id,
      fromReconcile: true,
      internalTransfer: false,
    };

    const { data } = await api.post('/transactions', tx);
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

    transactions.value.push(data.transaction);

    // ✅ Точный баланс — обновляем openingBalance
    acc.openingBalance = (Number(acc.openingBalance) || 0) + diff;
    acc.value = value;

    return data.transaction;
  }

  return {
    accounts,
    transactions,
    goals,
    loaded,

    total,
    byOwner,
    byId,
    totalByOwner,

    // ✅ НАЛИЧНЫЕ
    cashAccounts,
    totalCash,
    cashByOwner,
    getCashAccount,
    addCash,
    withdrawCash,
    setCashBalance,

    // Расхождения
    expectedByAccount,
    diffByAccount,
    hasAnyDiff,
    userDiffs,
    usersWithDiff,

    load,
    recalculate,
    setFromWebSocketOrState: setFromWS,
    setFromWS,
    getAccountName,
    getBank,
    ensureCashAccounts,
  };
});