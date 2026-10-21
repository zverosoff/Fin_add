import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAccountsStore } from './accounts';

export const useFiltersStore = defineStore('filters', () => {
  const accountsStore = useAccountsStore();

  const filters = ref({
    type: 'all',      // all | income | expense
    user: 'all',      // all | Сергей | Саша
    account: 'all',   // all | id счёта
    category: 'all',  // all | название
    search: '',
  });

  /** Активен ли хоть один фильтр */
  const hasActive = computed(() =>
    filters.value.type !== 'all' ||
    filters.value.user !== 'all' ||
    filters.value.account !== 'all' ||
    filters.value.category !== 'all' ||
    filters.value.search !== ''
  );

  /** Список активных фильтров для плашки */
  const activeList = computed(() => {
    const list = [];
    const f = filters.value;

    if (f.type !== 'all') {
      list.push({
        key: 'type',
        label: f.type === 'income' ? '📈 Доходы' : '📉 Расходы',
      });
    }
    if (f.user !== 'all') {
      list.push({
        key: 'user',
        label: (f.user === 'Сергей' ? '👨 ' : '👩 ') + f.user,
      });
    }
    if (f.account !== 'all') {
      const name = accountsStore.getAccountName(f.account) || f.account;
      const bank = accountsStore.getBank(f.account);
      const emoji = bank === 'sber' ? '🟢' : bank === 'tbank' ? '🟡' : '💳';
      list.push({ key: 'account', label: `${emoji} ${name}` });
    }
    if (f.category !== 'all') {
      list.push({ key: 'category', label: f.category });
    }
    if (f.search) {
      list.push({ key: 'search', label: `🔍 "${f.search}"` });
    }
    return list;
  });

  /** Переключить фильтр: если уже такой — снимаем, иначе ставим */
  function toggle(key, value) {
    if (filters.value[key] === value) {
      filters.value[key] = 'all';
    } else {
      filters.value[key] = value;
    }
  }

  function set(key, value) {
    filters.value[key] = value;
  }

  function reset() {
    filters.value = {
      type: 'all',
      user: 'all',
      account: 'all',
      category: 'all',
      search: '',
    };
  }

  return { filters, hasActive, activeList, toggle, set, reset };
});