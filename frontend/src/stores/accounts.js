import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import { useCashStore } from './cash';
import {
  computeDiff,
  computeExpectedBalance,
  computeUserDiff,
} from '@/composables/useBalance';

export const useAccountsStore = defineStore('accounts', () => {
  const cashStore = useCashStore();

  const accounts = ref([]);
  const transactions = ref([]);
  const goals = ref([]);
  const loaded = ref(false);

  // ============================================================
  // ✅ Сортировка: Т-Банк → СберБанк → остальные
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

    // ✅ Подтягиваем наличные
    cashStore.applyFromState(data);

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
    // ✅ Синхронизация наличных по WebSocket
    cashStore.applyFromState(state);
    recalculate();
  }

  function getAccountName(id) {
    const acc = byId.value[id];
    return acc ? acc.name : '';
  }

  function getBank(id) {
    if (!id) return null;
    if (id.startsWith('sber')) return 'sber';
    if (id.startsWith('tbank')) return 'tbank';
    return null;
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