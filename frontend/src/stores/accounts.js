import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref([]);
  const transactions = ref([]);
  const loaded = ref(false);

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

  async function load() {
    const { data } = await api.get('/state');
    accounts.value = data.accounts ?? [];
    transactions.value = data.transactions ?? [];
    loaded.value = true;
    recalculate();
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
    accounts.value = state.accounts ?? [];
    transactions.value = state.transactions ?? [];
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
    accounts, transactions, loaded,
    total, byOwner, byId,
    load, recalculate, setFromWS,
    getAccountName, getBank,
  };
});