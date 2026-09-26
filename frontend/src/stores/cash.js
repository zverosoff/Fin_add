import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';

export const useCashStore = defineStore('cash', () => {
  const loading = ref(false);

  // Локальная копия — синхронизируется с /state
  const total = ref(0);
  const contributions = ref({});
  const history = ref([]);

  function applyFromState(state) {
    if (!state?.cash) return;
    total.value = Number(state.cash.total) || 0;
    contributions.value = state.cash.contributions || {};
    history.value = state.cash.history || [];
  }

  async function saveToServer() {
    loading.value = true;
    try {
      const { data } = await api.post('/state', {
        cash: {
          total: total.value,
          contributions: contributions.value,
          history: history.value,
        },
      });
      if (!data.ok) throw new Error(data.error);
      return true;
    } finally {
      loading.value = false;
    }
  }

  async function deposit(user, amount, note = '') {
    const num = Number(amount) || 0;
    if (num <= 0) throw new Error('Сумма должна быть больше 0');

    total.value += num;
    contributions.value = {
      ...contributions.value,
      [user]: (Number(contributions.value[user]) || 0) + num,
    };
    history.value = [
      {
        type: 'deposit',
        user,
        amount: num,
        note: note || '',
        date: new Date().toISOString(),
      },
      ...history.value,
    ].slice(0, 50);

    await saveToServer();
  }

  async function withdraw(user, amount, note = '') {
    const num = Number(amount) || 0;
    if (num <= 0) throw new Error('Сумма должна быть больше 0');

    const available = Number(contributions.value[user]) || 0;
    if (num > available) {
      throw new Error(`У ${user} только ${available} ₽`);
    }

    total.value = Math.max(0, total.value - num);

    const next = available - num;
    const newContribs = { ...contributions.value };
    if (next <= 0.001) delete newContribs[user];
    else newContribs[user] = next;
    contributions.value = newContribs;

    history.value = [
      {
        type: 'withdraw',
        user,
        amount: num,
        note: note || '',
        date: new Date().toISOString(),
      },
      ...history.value,
    ].slice(0, 50);

    await saveToServer();
  }

  return {
    loading,
    total,
    contributions,
    history,
    applyFromState,
    deposit,
    withdraw,
  };
});