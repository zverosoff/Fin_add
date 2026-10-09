<script setup>
import { computed, watch, ref } from 'vue';
import { useFiltersStore } from '@/stores/filters';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore } from '@/stores/transactions';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const filters = useFiltersStore();
const accounts = useAccountsStore();
const categories = useCategoriesStore();
const txStore = useTransactionsStore();

const local = ref({
  type: 'all',
  user: 'all',
  account: 'all',
  category: 'all',
});

watch(() => props.modelValue, (open) => {
  if (open) {
    local.value = {
      type: filters.filters.type,
      user: filters.filters.user,
      account: filters.filters.account,
      category: filters.filters.category,
    };
  }
}, { immediate: true });

const filteredAccounts = computed(() => {
  if (local.value.user === 'all') return accounts.accounts;
  return accounts.accounts.filter(a => (a.owner || 'Сергей') === local.value.user);
});

const filteredCategories = computed(() => {
  if (local.value.type === 'income') return categories.incomeCategories;
  if (local.value.type === 'expense') return categories.expenseCategories;
  return categories.all;
});

watch(() => local.value.user, () => {
  if (local.value.account !== 'all') {
    const found = filteredAccounts.value.find(a => a.id === local.value.account);
    if (!found) local.value.account = 'all';
  }
});

watch(() => local.value.type, () => {
  if (local.value.category !== 'all') {
    const found = filteredCategories.value.includes(local.value.category);
    if (!found) local.value.category = 'all';
  }
});

function apply() {
  filters.set('type', local.value.type);
  filters.set('user', local.value.user);
  filters.set('account', local.value.account);
  filters.set('category', local.value.category);
  emit('update:modelValue', false);
}

function resetAll() {
  local.value = { type: 'all', user: 'all', account: 'all', category: 'all' };
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="🔍 Фильтры"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="form">
      <div class="field">
        <label>Тип операции</label>
        <div class="chips-row">
          <button type="button" class="chip" :class="{ active: local.type === 'all' }" @click="local.type = 'all'">Все</button>
          <button type="button" class="chip" :class="{ active: local.type === 'income' }" @click="local.type = 'income'">📈 Доходы</button>
          <button type="button" class="chip" :class="{ active: local.type === 'expense' }" @click="local.type = 'expense'">📉 Расходы</button>
        </div>
      </div>

      <div class="field">
        <label>Пользователь</label>
        <div class="chips-row">
          <button type="button" class="chip" :class="{ active: local.user === 'all' }" @click="local.user = 'all'">Все</button>
          <button type="button" class="chip" :class="{ active: local.user === 'Сергей' }" @click="local.user = 'Сергей'">👨 Сергей</button>
          <button type="button" class="chip" :class="{ active: local.user === 'Саша' }" @click="local.user = 'Саша'">👩 Саша</button>
        </div>
      </div>

      <div class="field">
        <label>Счёт</label>
        <div class="chips-row">
          <button type="button" class="chip" :class="{ active: local.account === 'all' }" @click="local.account = 'all'">Все счета</button>
          <button
            v-for="acc in filteredAccounts"
            :key="acc.id"
            type="button"
            class="chip"
            :class="{
              active: local.account === acc.id,
              sber: acc.id.startsWith('sber'),
              tbank: acc.id.startsWith('tbank'),
            }"
            @click="local.account = acc.id"
          >
            <img v-if="acc.id.startsWith('sber')" src="/img/sber.png" class="chip-logo" />
            <img v-else-if="acc.id.startsWith('tbank')" src="/img/tbank.png" class="chip-logo" />
            {{ acc.name }}
            <span v-if="local.user === 'all'" class="chip-owner">
              ({{ acc.owner || 'Сергей' }})
            </span>
          </button>
        </div>
      </div>

      <div class="field">
        <label>Категория</label>
        <div class="category-select-wrap">
          <select v-model="local.category" class="category-select">
            <option value="all">Все категории</option>
            <option v-for="c in filteredCategories" :key="c" :value="c">
              {{ categories.icon(c) }} {{ c }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn-reset" type="button" @click="resetAll">🗑 Сбросить</button>
      <button class="btn-cancel" type="button" @click="close">Отмена</button>
      <button class="btn-apply" type="button" @click="apply">✅ Применить</button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.form { display: flex; flex-direction: column; gap: 16px; }

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

.chips-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &.active {
    background: var(--grad-primary);
    color: #fff;
    border-color: transparent;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 6px 16px -8px rgba(139, 92, 246, 0.7);
  }

  &.sber.active {
    background: linear-gradient(135deg, #21a038, #4cd964);
  }
  &.tbank.active {
    background: linear-gradient(135deg, #fbbf24, #ffdd2d);
    color: #000;
  }
}

.chip-logo {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: contain;
  background: #fff;
  padding: 1px;
  box-sizing: border-box;
}

.chip-owner {
  color: var(--muted);
  font-weight: 500;
  font-size: 10px;
}

.category-select-wrap {
  position: relative;
}

.category-select {
  width: 100%;
  padding: 10px 36px 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 18px;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.3s ease;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  }
}

.btn-reset, .btn-cancel, .btn-apply {
  padding: 10px 18px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.btn-reset {
  margin-right: auto;
  background: rgba(244, 63, 94, 0.1);
  color: var(--danger);
  border-color: rgba(244, 63, 94, 0.3);
  &:hover { background: rgba(244, 63, 94, 0.2); }
}

.btn-cancel {
  background: var(--panel-2);
  color: var(--text);
  border-color: var(--border);
  &:hover { border-color: var(--border-strong); }
}

.btn-apply {
  background: var(--grad-primary);
  color: #fff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 6px 18px -6px rgba(139, 92, 246, 0.7);
  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 10px 24px -6px rgba(139, 92, 246, 0.9);
  }
}
</style>