import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import {
  computeDiff,
  computeExpectedBalance,
  computeUserDiff,
} from '@/composables/useBalance';

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref([]);
  const transactions = ref([]);
  const goals = ref([]);
  const loaded = ref(false);

  // ============================================================
  // Вычисляемые — базовые
  // ============================================================

  /** Общая сумма по всем счетам */
  const total = computed(() =>
    accounts.value.reduce((sum, a) => sum + (Number(a.value) || 0), 0)
  );

  /** Счета, сгруппированные по владельцу */
  const byOwner = computed(() => {
    const map = {};
    for (const acc of accounts.value) {
      const owner = acc.owner || 'Сергей';
      if (!map[owner]) map[owner] = [];
      map[owner].push(acc);
    }
    return map;
  });

  /** Быстрый поиск счёта по id */
  const byId = computed(() => {
    const map = {};
    for (const acc of accounts.value) map[acc.id] = acc;
    return map;
  });

  /** Сумма по каждому владельцу */
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

  /** Ожидаемый баланс для каждого счёта */
  const expectedByAccount = computed(() => {
    const map = {};
    for (const acc of accounts.value) {
      map[acc.id] = computeExpectedBalance(acc, transactions.value);
    }
    return map;
  });

  /** Расхождения по каждому счёту */
  const diffByAccount = computed(() => {
    const map = {};
    for (const acc of accounts.value) {
      map[acc.id] = computeDiff(acc, transactions.value);
    }
    return map;
  });

  /** Есть ли хоть одно расхождение */
  const hasAnyDiff = computed(() =>
    Object.values(diffByAccount.value).some(d => d.hasDiff)
  );

  /** Расхождения по пользователям */
  const userDiffs = computed(() => {
    const users = ['Сергей', 'Саша'];
    return users.map(u => computeUserDiff(u, accounts.value, transactions.value));
  });

  /** Пользователи с расхождением */
  const usersWithDiff = computed(() =>
    userDiffs.value.filter(u => u.hasDiff)
  );

  // ============================================================
  // Действия
  // ============================================================

  /** Загрузить с сервера */
  async function load() {
    const { data } = await api.get('/state');
    accounts.value = data.accounts ?? [];
    transactions.value = data.transactions ?? [];
    goals.value = data.goals ?? [];
    loaded.value = true;
    recalculate();
  }

  /** Пересчёт балансов из транзакций */
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

  /** Обновление из WebSocket */
  function setFromWS(state) {
    accounts.value = state.accounts ?? [];
    transactions.value = state.transactions ?? [];
    goals.value = state.goals ?? [];
    recalculate();
  }

  /** Получить имя счёта по id */
  function getAccountName(id) {
    const acc = byId.value[id];
    return acc ? acc.name : '';
  }

  /** Определить банк счёта */
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